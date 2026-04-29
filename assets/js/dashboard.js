(function () {
    'use strict';

    var CSF_LABELS = [
        'Communication', 'Knowledge & Skills', 'Leadership', 'Measurement',
        'Morale', 'Process & Procedure', 'Recognition',
        'Resource (Qty)', 'Resource (Qual)', 'Standards'
    ];
    var CSF_SHORT = [ 'Comm', 'Know', 'Lead', 'Meas', 'Morale', 'Proc', 'Recog', 'R.Qty', 'R.Qual', 'Std' ];
    var CSF_KEYS = [
        'score_communication', 'score_knowledge', 'score_leadership', 'score_measurement',
        'score_morale', 'score_process', 'score_recognition', 'score_resource_qty',
        'score_resource_qual', 'score_standards'
    ];

    var benchChart   = null;
    var allData      = null;

    document.addEventListener('DOMContentLoaded', function () {
        if (!document.getElementById('pfg-dashboard')) return;
        loadData('', '');

        document.getElementById('pfg-dash-filter-btn').addEventListener('click', function () {
            loadData(
                document.getElementById('pfg-dash-company').value,
                document.getElementById('pfg-dash-dept').value
            );
        });
        document.getElementById('pfg-dash-export-btn').addEventListener('click', exportCSV);
        document.getElementById('pfg-bench-co-select').addEventListener('change', onBenchCompanyChange);
    });

    // ── Load ─────────────────────────────────────────────────────────────
    function loadData(company, dept) {
        var body = new FormData();
        body.append('action',  'pfg_dashboard_data');
        body.append('nonce',   pfgDashData.nonce);
        body.append('company', company);
        body.append('dept',    dept);

        fetch(pfgDashData.ajaxUrl, { method: 'POST', body: body })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (!res.success) { alert('Dashboard error: ' + (res.data && res.data.message)); return; }
                allData = res.data;
                populateFilters(res.data.companies, res.data.departments);
                populateBenchSelect(res.data.companies);
                renderAverages(res.data);
                renderTable(res.data.rows);
            })
            .catch(function () { alert('Network error loading dashboard.'); });
    }

    // ── Filters ───────────────────────────────────────────────────────────
    function populateFilters(companies, departments) {
        repopulate('pfg-dash-company', 'All Companies', companies);
        repopulate('pfg-dash-dept',    'All Departments', departments);
    }

    function populateBenchSelect(companies) {
        repopulate('pfg-bench-co-select', '— choose a company —', companies);
    }

    function repopulate(id, placeholder, items) {
        var sel = document.getElementById(id);
        if (!sel) return;
        var prev = sel.value;
        sel.innerHTML = '<option value="">' + placeholder + '</option>';
        (items || []).forEach(function (v) {
            var o = document.createElement('option');
            o.value = v; o.textContent = v;
            if (v === prev) o.selected = true;
            sel.appendChild(o);
        });
    }

    // ── Averages Panel ────────────────────────────────────────────────────
    function renderAverages(data) {
        var el = document.getElementById('pfg-dash-avg-content');
        if (!el) return;
        if (!data.global_avg_total) {
            el.innerHTML = '<p style="color:#94a3b8;font-size:0.875rem;">No submissions yet.</p>';
            return;
        }

        var html = '<div class="pfg-avg-grid">';

        // Total card
        html += avgCard(data.global_avg_total, '/ 100', 'Global Total Avg', true);

        // Per-CSF cards
        CSF_KEYS.forEach(function (key, i) {
            var val = data.global_csf_avgs[key] !== undefined ? data.global_csf_avgs[key] : '–';
            html += avgCard(val, '/ 10', CSF_LABELS[i], false);
        });

        html += '</div>';
        el.innerHTML = html;
    }

    function avgCard(num, denom, label, highlight) {
        var cls = highlight ? 'pfg-avg-card pfg-avg-card--highlight' : 'pfg-avg-card';
        return '<div class="' + cls + '">'
            + '<div class="pfg-avg-num">' + num + '<span class="pfg-avg-denom">&thinsp;' + denom + '</span></div>'
            + '<div class="pfg-avg-label">' + label + '</div>'
            + '</div>';
    }

    // ── Benchmarking ──────────────────────────────────────────────────────
    function onBenchCompanyChange() {
        var co  = document.getElementById('pfg-bench-co-select').value;
        var ph  = document.getElementById('pfg-bench-placeholder');
        var wrap = document.getElementById('pfg-bench-chart-wrap');

        if (!co || !allData) {
            if (wrap)  wrap.style.display = 'none';
            if (ph)    ph.style.display   = 'block';
            if (benchChart) { benchChart.destroy(); benchChart = null; }
            return;
        }

        if (ph)   ph.style.display  = 'none';
        if (wrap) wrap.style.display = 'block';

        var coData = null;
        (allData.company_avgs || []).forEach(function (c) {
            if (c.company === co) coData = c;
        });
        if (!coData) return;

        renderBenchChart(co, coData, allData.global_csf_avgs, allData.global_avg_total);
    }

    function renderBenchChart(coName, coData, globalAvgs, globalTotal) {
        var ctx = document.getElementById('pfg-bench-chart');
        if (!ctx) return;
        if (benchChart) { benchChart.destroy(); benchChart = null; }

        var coVals     = CSF_KEYS.map(function (k) { return coData[k] || 0; });
        var globalVals = CSF_KEYS.map(function (k) { return globalAvgs[k] || 0; });

        // Add total at end
        var labels = CSF_SHORT.concat(['Total']);
        coVals.push(coData.avg_total || 0);
        globalVals.push(globalTotal || 0);

        // Scale total to /10 for visual parity
        coVals[10]     = parseFloat((coVals[10] / 10).toFixed(1));
        globalVals[10] = parseFloat((globalVals[10] / 10).toFixed(1));

        benchChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: coName,
                        data: coVals,
                        backgroundColor: 'rgba(240, 180, 41, 0.75)',
                        borderRadius: 5,
                        borderSkipped: false,
                    },
                    {
                        label: 'Global Average',
                        data: globalVals,
                        backgroundColor: 'rgba(34, 197, 94, 0.6)',
                        borderRadius: 5,
                        borderSkipped: false,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        min: 0, max: 10,
                        ticks: { stepSize: 2, font: { size: 10 } },
                        grid:  { color: 'rgba(0,0,0,0.06)' },
                        title: { display: true, text: 'Score (/ 10)', font: { size: 10 } }
                    },
                    x: { ticks: { font: { size: 10, family: 'Inter' } } }
                },
                plugins: {
                    legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 14 } },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                var raw = ctx.raw;
                                if (ctx.dataIndex === 10) return ' ' + ctx.dataset.label + ': ' + (raw * 10).toFixed(1) + ' / 100';
                                return ' ' + ctx.dataset.label + ': ' + raw + ' / 10';
                            }
                        }
                    }
                }
            }
        });
    }

    // ── Table ─────────────────────────────────────────────────────────────
    function renderTable(rows) {
        var wrap = document.getElementById('pfg-dash-table-wrap');
        if (!wrap) return;
        if (!rows || !rows.length) {
            wrap.innerHTML = '<p style="color:#94a3b8;font-size:0.875rem;padding:1rem 0;">No submissions found.</p>';
            return;
        }

        var html = '<div style="overflow-x:auto;"><table class="pfg-dash-table"><thead><tr>';
        html += '<th>PDF</th><th>Name</th><th>Company</th><th>Dept</th><th>Email</th>';
        CSF_SHORT.forEach(function (l) { html += '<th>' + l + '</th>'; });
        html += '<th>Total</th><th>Tier</th><th style="white-space:nowrap;">Date</th></tr></thead><tbody>';

        rows.forEach(function (row, idx) {
            html += '<tr data-idx="' + idx + '">';
            html += '<td><button class="pfg-pdf-row-btn" data-idx="' + idx + '" title="Download PDF">&#8595;</button></td>';
            html += '<td>' + esc(row.user_name) + '</td>';
            html += '<td>' + esc(row.company) + '</td>';
            html += '<td>' + esc(row.department) + '</td>';
            html += '<td>' + esc(row.email || '&#8211;') + '</td>';
            CSF_KEYS.forEach(function (k) { html += '<td style="text-align:center;">' + esc(row[k]) + '</td>'; });
            html += '<td style="text-align:center;font-weight:700;">' + esc(row.total_score) + '</td>';
            html += '<td style="white-space:nowrap;">' + esc(row.tier) + '</td>';
            html += '<td style="white-space:nowrap;">' + esc((row.submitted_at || '').split(' ')[0]) + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        wrap.innerHTML = html;

        wrap.querySelectorAll('.pfg-pdf-row-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idx = parseInt(btn.getAttribute('data-idx'), 10);
                generateRowPDF(rows[idx]);
            });
        });
    }

    // ── Per-Row PDF ───────────────────────────────────────────────────────
    function generateRowPDF(row) {
        if (typeof html2pdf === 'undefined') { alert('PDF library not loaded.'); return; }

        var csf_full = [
            'Communication', 'Knowledge & Skills', 'Leadership', 'Measurement', 'Morale',
            'Process & Procedure', 'Recognition', 'Resource (Quantity)', 'Resource (Quality)', 'Standards'
        ];

        var rows = '';
        CSF_KEYS.forEach(function (k, i) {
            rows += '<tr><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;">' + csf_full[i] + '</td>'
                  + '<td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:600;">' + (row[k] || '–') + ' / 10</td></tr>';
        });

        var html = '<div style="font-family:Arial,sans-serif;padding:32px;max-width:600px;color:#1a1a2e;">'
            + '<div style="text-align:center;margin-bottom:24px;">'
            + '<div style="font-size:28px;font-weight:700;letter-spacing:4px;background:linear-gradient(135deg,#F0B429,#22C55E);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">GLO</div>'
            + '<h1 style="font-size:20px;font-weight:700;margin:4px 0;">PFG Predictive Index</h1>'
            + '<p style="color:#64748b;font-size:13px;margin:0;">Assessment Report</p>'
            + '</div>'
            + '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:#f8fafc;border-radius:8px;">'
            + '<tr><td style="padding:8px 12px;font-size:13px;color:#64748b;">Name</td><td style="padding:8px 12px;font-weight:600;">' + esc(row.user_name) + '</td></tr>'
            + '<tr><td style="padding:8px 12px;font-size:13px;color:#64748b;">Company</td><td style="padding:8px 12px;font-weight:600;">' + esc(row.company) + '</td></tr>'
            + '<tr><td style="padding:8px 12px;font-size:13px;color:#64748b;">Department</td><td style="padding:8px 12px;font-weight:600;">' + esc(row.department) + '</td></tr>'
            + '<tr><td style="padding:8px 12px;font-size:13px;color:#64748b;">Date</td><td style="padding:8px 12px;font-weight:600;">' + esc((row.submitted_at || '').split(' ')[0]) + '</td></tr>'
            + '</table>'
            + '<h2 style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#64748b;margin-bottom:8px;">CSF Scores</h2>'
            + '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">' + rows + '</table>'
            + '<div style="text-align:center;padding:20px;background:linear-gradient(135deg,rgba(240,180,41,0.1),rgba(34,197,94,0.1));border-radius:12px;">'
            + '<div style="font-size:48px;font-weight:700;color:#1a1a2e;">' + (row.total_score || '–') + '</div>'
            + '<div style="font-size:13px;color:#94a3b8;margin-bottom:8px;">/ 100</div>'
            + '<div style="display:inline-block;padding:6px 24px;border-radius:999px;background:linear-gradient(135deg,#F0B429,#22C55E);color:#fff;font-weight:600;font-size:14px;">' + esc(row.tier || '') + '</div>'
            + '</div></div>';

        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        tmp.style.cssText = 'position:fixed;left:-9999px;top:0;width:600px;';
        document.body.appendChild(tmp);

        var filename = 'PFG-' + (row.user_name || 'Report').replace(/\s+/g, '-') + '-' + ((row.submitted_at || '').split(' ')[0]) + '.pdf';
        html2pdf().set({
            margin: [10, 10, 10, 10],
            filename: filename,
            image: { type: 'jpeg', quality: 0.97 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(tmp).save().then(function () {
            document.body.removeChild(tmp);
        });
    }

    // ── CSV Export ────────────────────────────────────────────────────────
    function exportCSV() {
        if (!allData || !allData.rows || !allData.rows.length) { alert('No data to export.'); return; }
        var headers = ['ID','Name','Company','Department','Email',
            'Communication','Knowledge','Leadership','Measurement','Morale',
            'Process','Recognition','Resource Qty','Resource Qual','Standards',
            'Total Score','Tier','Submitted At'];
        var lines = [ headers.join(',') ];
        allData.rows.forEach(function (r) {
            lines.push([
                r.id, csvCell(r.user_name), csvCell(r.company), csvCell(r.department), csvCell(r.email || ''),
                r.score_communication, r.score_knowledge, r.score_leadership, r.score_measurement, r.score_morale,
                r.score_process, r.score_recognition, r.score_resource_qty, r.score_resource_qual, r.score_standards,
                r.total_score, csvCell(r.tier), r.submitted_at
            ].join(','));
        });
        var blob = new Blob([ lines.join('\r\n') ], { type: 'text/csv;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url; a.download = 'pfg-assessments-' + new Date().toISOString().split('T')[0] + '.csv';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function csvCell(val) {
        var s = String(val == null ? '' : val);
        return (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1)
            ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

})();
