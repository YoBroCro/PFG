(function () {
    'use strict';

    var CSF_LABELS = [
        'Communication', 'Knowledge & Skills', 'Leadership', 'Measurement',
        'Morale', 'Process & Procedure', 'Recognition',
        'Resource (Qty)', 'Resource (Qual)', 'Standards'
    ];
    var CSF_KEYS = [
        'score_communication', 'score_knowledge', 'score_leadership', 'score_measurement',
        'score_morale', 'score_process', 'score_recognition', 'score_resource_qty',
        'score_resource_qual', 'score_standards'
    ];

    var benchChart = null;
    var allData    = null;

    document.addEventListener('DOMContentLoaded', function () {
        if (!document.getElementById('pfg-dashboard')) return;
        loadData('', '');

        document.getElementById('pfg-dash-filter-btn').addEventListener('click', function () {
            var co   = document.getElementById('pfg-dash-company').value;
            var dept = document.getElementById('pfg-dash-dept').value;
            loadData(co, dept);
        });

        document.getElementById('pfg-dash-export-btn').addEventListener('click', exportCSV);
    });

    // ── Data Fetch ────────────────────────────────────────────────────────
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
                renderAverages(res.data);
                renderBenchChart(res.data.dept_avgs);
                renderTable(res.data.rows);
            })
            .catch(function () { alert('Network error loading dashboard.'); });
    }

    // ── Filters ───────────────────────────────────────────────────────────
    function populateFilters(companies, departments) {
        var coSel   = document.getElementById('pfg-dash-company');
        var deptSel = document.getElementById('pfg-dash-dept');
        var coVal   = coSel.value;
        var deptVal = deptSel.value;

        coSel.innerHTML   = '<option value="">All Companies</option>';
        deptSel.innerHTML = '<option value="">All Departments</option>';

        companies.forEach(function (c) {
            var o = document.createElement('option');
            o.value = c; o.textContent = c;
            if (c === coVal) o.selected = true;
            coSel.appendChild(o);
        });
        departments.forEach(function (d) {
            var o = document.createElement('option');
            o.value = d; o.textContent = d;
            if (d === deptVal) o.selected = true;
            deptSel.appendChild(o);
        });
    }

    // ── Averages Panel ────────────────────────────────────────────────────
    function renderAverages(data) {
        var el = document.getElementById('pfg-dash-avg-content');
        if (!el) return;
        if (!data.global_avg_total) { el.innerHTML = '<p style="color:#94a3b8;">No submissions yet.</p>'; return; }

        var html = '<div class="pfg-dash-avg-grid">';
        html += '<div class="pfg-dash-avg-item pfg-dash-avg-total"><span class="pfg-dash-avg-num">' + data.global_avg_total + '</span><span class="pfg-dash-avg-label">Total Avg / 100</span></div>';
        CSF_KEYS.forEach(function (key, i) {
            var val = data.global_csf_avgs[key] || '–';
            html += '<div class="pfg-dash-avg-item"><span class="pfg-dash-avg-num">' + val + '</span><span class="pfg-dash-avg-label">' + CSF_LABELS[i] + '</span></div>';
        });
        html += '</div>';
        el.innerHTML = html;
    }

    // ── Benchmarking Chart ────────────────────────────────────────────────
    function renderBenchChart(deptAvgs) {
        var ctx = document.getElementById('pfg-bench-chart');
        if (!ctx) return;
        if (benchChart) { benchChart.destroy(); benchChart = null; }
        if (!deptAvgs || !deptAvgs.length) return;

        var labels  = deptAvgs.map(function (d) { return d.department; });
        var totals  = deptAvgs.map(function (d) { return d.avg_total; });

        var colors = deptAvgs.map(function (_, i) {
            var hue = (i * 47) % 360;
            return 'hsla(' + hue + ', 70%, 58%, 0.8)';
        });

        benchChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Avg Total Score',
                    data:  totals,
                    backgroundColor: colors,
                    borderRadius: 6,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        min: 0, max: 100,
                        ticks: { stepSize: 20, font: { size: 11 } },
                        grid:  { color: 'rgba(0,0,0,0.06)' }
                    },
                    x: { ticks: { font: { size: 11, family: 'Inter' } } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) { return ' Avg: ' + ctx.raw + ' / 100'; }
                        }
                    }
                }
            }
        });
    }

    // ── Data Table ────────────────────────────────────────────────────────
    function renderTable(rows) {
        var wrap = document.getElementById('pfg-dash-table-wrap');
        if (!wrap) return;
        if (!rows || !rows.length) {
            wrap.innerHTML = '<p style="color:#94a3b8;padding:1rem 0;">No submissions found.</p>';
            return;
        }

        var html = '<table class="pfg-dash-table"><thead><tr>';
        html += '<th>#</th><th>Name</th><th>Company</th><th>Dept</th><th>Email</th>';
        CSF_LABELS.forEach(function (l) { html += '<th style="min-width:52px;">' + l.split(' ')[0] + '</th>'; });
        html += '<th>Total</th><th>Tier</th><th>Date</th></tr></thead><tbody>';

        rows.forEach(function (row) {
            html += '<tr>';
            html += '<td>' + esc(row.id) + '</td>';
            html += '<td>' + esc(row.user_name) + '</td>';
            html += '<td>' + esc(row.company) + '</td>';
            html += '<td>' + esc(row.department) + '</td>';
            html += '<td>' + esc(row.email || '–') + '</td>';
            CSF_KEYS.forEach(function (k) { html += '<td style="text-align:center;">' + esc(row[k]) + '</td>'; });
            html += '<td style="text-align:center;font-weight:700;">' + esc(row.total_score) + '</td>';
            html += '<td>' + esc(row.tier) + '</td>';
            html += '<td>' + esc(row.submitted_at ? row.submitted_at.split(' ')[0] : '') + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table>';
        wrap.innerHTML = html;
    }

    // ── CSV Export ────────────────────────────────────────────────────────
    function exportCSV() {
        if (!allData || !allData.rows || !allData.rows.length) { alert('No data to export.'); return; }
        var headers = ['ID', 'Name', 'Company', 'Department', 'Email',
            'Communication', 'Knowledge', 'Leadership', 'Measurement', 'Morale',
            'Process', 'Recognition', 'Resource Qty', 'Resource Qual', 'Standards',
            'Total Score', 'Tier', 'Submitted At'];

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
        a.href     = url;
        a.download = 'pfg-assessments-' + new Date().toISOString().split('T')[0] + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    function esc(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function csvCell(val) {
        var s = String(val == null ? '' : val);
        if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }

})();
