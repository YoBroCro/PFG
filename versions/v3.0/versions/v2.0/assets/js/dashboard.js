/* PFG Dashboard v2.1 | build 2026-04-30 */
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
        var dateFrom = (document.getElementById('pfg-dash-date-from') || {}).value || '';
        var dateTo   = (document.getElementById('pfg-dash-date-to')   || {}).value || '';
        var body = new FormData();
        body.append('action',    'pfg_dashboard_data');
        body.append('nonce',     pfgDashData.nonce);
        body.append('company',   company);
        body.append('dept',      dept);
        body.append('date_from', dateFrom);
        body.append('date_to',   dateTo);

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
            var emailVal = (row.email && row.email !== '&#8211;') ? row.email : '-';
            html += '<td>' + esc(emailVal) + '</td>';
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

    // ── Per-Row PDF ───────────────────────────────────────────────────────
    function generateRowPDF(row) {
        if (typeof html2pdf === 'undefined') { alert('PDF library not loaded.'); return; }

        var csf_full = [
            'Communication', 'Knowledge & Skills', 'Leadership', 'Measurement', 'Morale',
            'Process & Procedure', 'Recognition', 'Resource (Quantity)', 'Resource (Quality)', 'Standards'
        ];
        var scoreRows = '';
        CSF_KEYS.forEach(function (k, i) {
            scoreRows += '<tr>'
                + '<td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;">' + csf_full[i] + '</td>'
                + '<td style="padding:5px 10px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:600;font-size:12px;">' + (row[k] || '–') + ' / 10</td>'
                + '</tr>';
        });

        // Build off-screen div with a real canvas for Chart.js
        var div = document.createElement('div');
        div.style.cssText = 'position:absolute;left:0;top:0;z-index:-1000;opacity:0.01;pointer-events:none;background:white;width:800px;padding:30px;font-family:Helvetica,Arial,sans-serif;color:#1a1a2e;';
        div.innerHTML = '<div style="text-align:center;padding-bottom:20px;margin-bottom:20px;border-bottom:2px solid #f1f5f9;">'
            + '<div style="font-size:26px;font-weight:700;letter-spacing:5px;color:#111827;">GLO</div>'
            + '<div style="font-size:18px;font-weight:700;margin:5px 0;color:#111827;">PFG Predictive Index</div>'
            + '<div style="font-size:12px;color:#64748b;">Assessment Report</div>'
            + '</div>'
            + '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:#f8fafc;border-radius:8px;overflow:hidden;">'
            + '<tr><td style="padding:10px 15px;font-size:11px;color:#64748b;width:120px;border-bottom:1px solid #e2e8f0;">Name</td><td style="padding:10px 15px;font-weight:600;font-size:13px;border-bottom:1px solid #e2e8f0;">' + esc(row.user_name) + '</td></tr>'
            + '<tr><td style="padding:10px 15px;font-size:11px;color:#64748b;width:120px;border-bottom:1px solid #e2e8f0;">Company</td><td style="padding:10px 15px;font-weight:600;font-size:13px;border-bottom:1px solid #e2e8f0;">' + esc(row.company) + '</td></tr>'
            + '<tr><td style="padding:10px 15px;font-size:11px;color:#64748b;width:120px;border-bottom:1px solid #e2e8f0;">Department</td><td style="padding:10px 15px;font-weight:600;font-size:13px;border-bottom:1px solid #e2e8f0;">' + esc(row.department) + '</td></tr>'
            + '<tr><td style="padding:10px 15px;font-size:11px;color:#64748b;width:120px;">Date</td><td style="padding:10px 15px;font-weight:600;font-size:13px;">' + esc((row.submitted_at || '').split(' ')[0]) + '</td></tr>'
            + '</table>'
            + '<div style="display:flex;gap:30px;align-items:flex-start;margin-bottom:30px;">'
            + '<div style="flex:1;">'
            + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#64748b;margin-bottom:10px;border-bottom:1px solid #e2e8f0;padding-bottom:5px;">CSF Scores</div>'
            + '<table style="width:100%;border-collapse:collapse;">' + scoreRows + '</table>'
            + '</div>'
            + '<div style="flex-shrink:0;"><canvas id="pfg-row-pdf-canvas" width="300" height="300"></canvas></div>'
            + '</div>'
            + '<div style="text-align:center;padding:24px;background:#f0fdf4;border-radius:12px;border:1px solid #dcfce7;">'
            + '<div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:5px;">Aggregate Score</div>'
            + '<div style="font-size:54px;font-weight:800;color:#166534;line-height:1;">' + (row.total_score || '\u2013') + '</div>'
            + '<div style="font-size:13px;color:#166534;margin-bottom:12px;font-weight:500;">/ 100</div>'
            + '<div style="display:inline-block;padding:6px 30px;border-radius:999px;background:#22C55E;color:#fff;font-weight:700;font-size:14px;box-shadow:0 2px 4px rgba(34,197,94,0.2);">' + esc(row.tier || '') + '</div>'
            + '</div>';

        document.body.appendChild(div);

        var chartCanvas = div.querySelector('#pfg-row-pdf-canvas');
        var chartValues = CSF_KEYS.map(function (k) { return parseFloat(row[k]) || 0; });
        var tmpChart = new Chart(chartCanvas, {
            type: 'radar',
            data: {
                labels: CSF_LABELS,
                datasets: [{
                    data:                 chartValues,
                    backgroundColor:      'rgba(34,197,94,0.15)',
                    borderColor:          'rgba(34,197,94,0.85)',
                    pointBackgroundColor: '#F0B429',
                    borderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                animation:  false,
                responsive: false,
                plugins:    { legend: { display: false } },
                scales: { r: { min: 0, max: 10, ticks: { stepSize: 2, backdropColor: 'transparent' } } }
            }
        });

        var fname = 'PFG-' + (row.user_name || 'Report').replace(/[^a-zA-Z0-9]/g, '-') + '.pdf';
        setTimeout(function () {
            html2pdf().set({
                margin:      [8, 8, 8, 8],
                filename:    fname,
                image:       { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
                jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(div).save().then(function () {
                tmpChart.destroy();
                document.body.removeChild(div);
            });
        }, 800);

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
