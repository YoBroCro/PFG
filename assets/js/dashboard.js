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

    var avgRadarChart = null;
    var benchChart    = null;
    var allData       = null;

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

        // Cascading: Company → Department
        document.getElementById('pfg-dash-company').addEventListener('change', onCompanyFilter);
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
                populateTopFilters(res.data.companies, res.data.departments);
                populateBenchSelect(res.data.companies);
                renderAverages(res.data);
                renderTable(res.data.rows);
            })
            .catch(function () { alert('Network error loading dashboard.'); });
    }

    // ── Step 20: Cascading Filters ────────────────────────────────────────
    function populateTopFilters(companies, departments) {
        repopulate('pfg-dash-company', 'All Companies', companies);
        repopulate('pfg-dash-dept',    'All Departments', departments);
    }

    function onCompanyFilter() {
        if (!allData || !allData.company_dept_map) return;
        var co   = document.getElementById('pfg-dash-company').value;
        var map  = allData.company_dept_map;
        var opts = co ? (map[co] || []) : allData.departments;
        repopulate('pfg-dash-dept', 'All Departments', opts);
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

    // ── Step 19: Visual Averages ──────────────────────────────────────────
    function renderAverages(data) {
        var el = document.getElementById('pfg-dash-avg-content');
        if (!el) return;
        if (!data.global_avg_total) {
            el.innerHTML = '<p class="pfg-dash-loading">No submissions yet.</p>';
            return;
        }

        // Layout: [big total card + radar] on left | [2-col CSF grid] on right
        var html = '<div class="pfg-avg-layout">';

        // Left column: total metric + radar
        html += '<div class="pfg-avg-left">';
        html += '<div class="pfg-avg-hero">'
            + '<div class="pfg-avg-hero-num">' + data.global_avg_total + '</div>'
            + '<div class="pfg-avg-hero-denom">/ 100</div>'
            + '<div class="pfg-avg-hero-label">Global Total Average</div>'
            + '</div>';
        html += '<div class="pfg-avg-radar-wrap"><canvas id="pfg-avg-radar"></canvas></div>';
        html += '</div>';

        // Right column: 2-col CSF cards
        html += '<div class="pfg-avg-csf-grid">';
        CSF_KEYS.forEach(function (key, i) {
            var val = data.global_csf_avgs[key] !== undefined ? data.global_csf_avgs[key] : '–';
            html += '<div class="pfg-avg-csf-card">'
                + '<div class="pfg-avg-csf-num">' + val + '</div>'
                + '<div class="pfg-avg-csf-label">' + CSF_LABELS[i] + '</div>'
                + '</div>';
        });
        html += '</div>';

        html += '</div>';
        el.innerHTML = html;

        // Render radar chart for global averages
        var radarVals = CSF_KEYS.map(function (k) { return data.global_csf_avgs[k] || 0; });
        var radarCtx  = document.getElementById('pfg-avg-radar');
        if (radarCtx) {
            if (avgRadarChart) { avgRadarChart.destroy(); avgRadarChart = null; }
            avgRadarChart = new Chart(radarCtx, {
                type: 'radar',
                data: {
                    labels: CSF_LABELS,
                    datasets: [{
                        label: 'Global Avg',
                        data: radarVals,
                        backgroundColor: 'rgba(240, 180, 41, 0.15)',
                        borderColor:     'rgba(240, 180, 41, 0.9)',
                        pointBackgroundColor: '#22C55E',
                        pointBorderColor:     '#fff',
                        borderWidth: 2,
                        pointRadius: 4
                    }]
                },
                options: {
                    animation: { duration: 0 },
                    responsive: true,
                    scales: {
                        r: {
                            min: 0, max: 10,
                            ticks:       { stepSize: 2, font: { size: 9 }, backdropColor: 'transparent' },
                            grid:        { color: 'rgba(0,0,0,0.07)' },
                            pointLabels: { font: { size: 9, family: 'Inter' } }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: function (c) { return ' Avg: ' + c.raw + ' / 10'; } } }
                    }
                }
            });
        }
    }

    // ── Benchmarking ──────────────────────────────────────────────────────
    function onBenchCompanyChange() {
        var co   = document.getElementById('pfg-bench-co-select').value;
        var ph   = document.getElementById('pfg-bench-placeholder');
        var wrap = document.getElementById('pfg-bench-chart-wrap');
        if (!co || !allData) {
            if (wrap) wrap.style.display = 'none';
            if (ph)   ph.style.display   = 'block';
            if (benchChart) { benchChart.destroy(); benchChart = null; }
            return;
        }
        if (ph)   ph.style.display  = 'none';
        if (wrap) wrap.style.display = 'block';

        var coData = null;
        (allData.company_avgs || []).forEach(function (c) { if (c.company === co) coData = c; });
        if (!coData) return;
        renderBenchChart(co, coData, allData.global_csf_avgs, allData.global_avg_total);
    }

    function renderBenchChart(coName, coData, globalAvgs, globalTotal) {
        var ctx = document.getElementById('pfg-bench-chart');
        if (!ctx) return;
        if (benchChart) { benchChart.destroy(); benchChart = null; }

        var coVals     = CSF_KEYS.map(function (k) { return coData[k] || 0; });
        var globalVals = CSF_KEYS.map(function (k) { return globalAvgs[k] || 0; });
        var labels     = CSF_SHORT.concat(['Total']);
        coVals.push(parseFloat((( coData.avg_total || 0) / 10).toFixed(1)));
        globalVals.push(parseFloat(((globalTotal || 0) / 10).toFixed(1)));

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
                        borderSkipped: false
                    },
                    {
                        label: 'Global Average',
                        data: globalVals,
                        backgroundColor: 'rgba(34, 197, 94, 0.6)',
                        borderRadius: 5,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                animation: { duration: 0 },
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
                            label: function (c) {
                                if (c.dataIndex === 10) return ' ' + c.dataset.label + ': ' + (c.raw * 10).toFixed(1) + ' / 100';
                                return ' ' + c.dataset.label + ': ' + c.raw + ' / 10';
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
        html += '<th>Total</th><th>Tier</th><th>Date</th></tr></thead><tbody>';
        rows.forEach(function (row, idx) {
            html += '<tr>';
            html += '<td><button class="pfg-pdf-row-btn" data-idx="' + idx + '" title="Download PDF">&#8595;</button></td>';
            html += '<td>' + esc(row.user_name) + '</td>';
            html += '<td>' + esc(row.company) + '</td>';
            html += '<td>' + esc(row.department) + '</td>';
            html += '<td>' + esc(row.email || '&#8211;') + '</td>';
            CSF_KEYS.forEach(function (k) { html += '<td style="text-align:center;">' + esc(row[k]) + '</td>'; });
            html += '<td style="text-align:center;font-weight:700;">' + esc(row.total_score) + '</td>';
            html += '<td>' + esc(row.tier) + '</td>';
            html += '<td>' + esc((row.submitted_at || '').split(' ')[0]) + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        wrap.innerHTML = html;
        wrap.querySelectorAll('.pfg-pdf-row-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                generateRowPDF(rows[parseInt(btn.getAttribute('data-idx'), 10)]);
            });
        });
    }

    // ── Step 21: Per-Row PDF (fixed) ──────────────────────────────────────
    function generateRowPDF(row) {
        if (typeof html2pdf === 'undefined') { alert('PDF library not loaded.'); return; }
        var csf_full = [
            'Communication', 'Knowledge & Skills', 'Leadership', 'Measurement', 'Morale',
            'Process & Procedure', 'Recognition', 'Resource (Quantity)', 'Resource (Quality)', 'Standards'
        ];
        var scoreRows = '';
        CSF_KEYS.forEach(function (k, i) {
            scoreRows += '<tr><td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;">' + csf_full[i] + '</td>'
                + '<td style="padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:600;">'
                + (row[k] || '–') + ' / 10</td></tr>';
        });
        var content = '<div style="font-family:Arial,sans-serif;padding:32px;width:580px;background:#fff;color:#1a1a2e;">'
            + '<div style="text-align:center;margin-bottom:24px;border-bottom:2px solid #f1f5f9;padding-bottom:16px;">'
            + '<div style="font-size:24px;font-weight:700;letter-spacing:4px;color:#1a1a2e;">GLO</div>'
            + '<h1 style="font-size:18px;font-weight:700;margin:4px 0;color:#1a1a2e;">PFG Predictive Index</h1>'
            + '<p style="color:#64748b;font-size:12px;margin:0;">Assessment Report</p>'
            + '</div>'
            + '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:#f8fafc;">'
            + '<tr><td style="padding:7px 12px;font-size:12px;color:#64748b;width:120px;">Name</td><td style="padding:7px 12px;font-weight:600;">' + esc(row.user_name) + '</td></tr>'
            + '<tr><td style="padding:7px 12px;font-size:12px;color:#64748b;">Company</td><td style="padding:7px 12px;font-weight:600;">' + esc(row.company) + '</td></tr>'
            + '<tr><td style="padding:7px 12px;font-size:12px;color:#64748b;">Department</td><td style="padding:7px 12px;font-weight:600;">' + esc(row.department) + '</td></tr>'
            + '<tr><td style="padding:7px 12px;font-size:12px;color:#64748b;">Date</td><td style="padding:7px 12px;font-weight:600;">' + esc((row.submitted_at || '').split(' ')[0]) + '</td></tr>'
            + '</table>'
            + '<h2 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#64748b;margin-bottom:8px;">CSF Scores</h2>'
            + '<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">' + scoreRows + '</table>'
            + '<div style="text-align:center;padding:20px;background:#f0fdf4;border-radius:12px;">'
            + '<div style="font-size:48px;font-weight:700;color:#1a1a2e;">' + (row.total_score || '–') + '</div>'
            + '<div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">/ 100</div>'
            + '<div style="display:inline-block;padding:6px 24px;border-radius:999px;background:#22C55E;color:#fff;font-weight:600;font-size:13px;">' + esc(row.tier || '') + '</div>'
            + '</div></div>';

        var tmp = document.createElement('div');
        tmp.style.cssText = 'position:fixed;left:-9999px;top:0;width:600px;background:#fff;';
        tmp.innerHTML = content;
        document.body.appendChild(tmp);

        var fname = 'PFG-' + (row.user_name || 'Report').replace(/[^a-zA-Z0-9]/g, '-') + '.pdf';
        setTimeout(function () {
            html2pdf().set({
                margin:      [8, 8, 8, 8],
                filename:    fname,
                image:       { type: 'jpeg', quality: 0.97 },
                html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
                jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(tmp).save().then(function () {
                document.body.removeChild(tmp);
            });
        }, 150);
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
        var blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.href = url; a.download = 'pfg-assessments-' + new Date().toISOString().split('T')[0] + '.csv';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    function csvCell(val) {
        var s = String(val == null ? '' : val);
        return (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1)
            ? '"' + s.replace(/"/g,'""') + '"' : s;
    }

})();
