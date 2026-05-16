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
    var trendChart    = null;
    var allData       = null;

    var BENCH_PALETTE = [
        'rgba(240,180,41,1)', 'rgba(59,130,246,1)', 'rgba(239,68,68,1)',
        'rgba(168,85,247,1)', 'rgba(20,184,166,1)', 'rgba(245,158,11,1)'
    ];
    function benchColor(name) {
        var hash = 0;
        for (var j = 0; j < name.length; j++) {
            hash = (hash * 31 + name.charCodeAt(j)) >>> 0;
        }
        return BENCH_PALETTE[hash % BENCH_PALETTE.length];
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!document.getElementById('pfg-dashboard')) return;
        var slug = pfgDashData.companySlug || '';

        loadData('', '');

        document.getElementById('pfg-dash-filter-btn').addEventListener('click', function () {
            loadData(
                slug ? '' : document.getElementById('pfg-dash-company').value,
                document.getElementById('pfg-dash-dept').value
            );
        });
        var subFilterBtn = document.getElementById('pfg-sub-filter-btn');
        if (subFilterBtn) {
            subFilterBtn.addEventListener('click', function () {
                loadData(
                    slug ? '' : document.getElementById('pfg-dash-company').value,
                    document.getElementById('pfg-dash-dept').value,
                    (document.getElementById('pfg-sub-date-from') || {}).value || '',
                    (document.getElementById('pfg-sub-date-to')   || {}).value || ''
                );
            });
        }
        document.getElementById('pfg-dash-export-btn').addEventListener('click', exportCSV);

        var timeframeSel = document.getElementById('pfg-dash-timeframe');
        if (timeframeSel) timeframeSel.addEventListener('change', onTimeframeChange);

        var trendGranSel = document.getElementById('pfg-trend-granularity');
        if (trendGranSel) {
            trendGranSel.addEventListener('change', function () {
                if (allData) renderTrendChart(allData.rows);
            });
        }

        var trendDeptSel = document.getElementById('pfg-trend-dept');
        if (trendDeptSel) {
            if (pfgDashData.trendDepts && pfgDashData.trendDepts.length) {
                pfgDashData.trendDepts.forEach(function (dept) {
                    var o = document.createElement('option');
                    o.value = dept; o.textContent = dept;
                    trendDeptSel.appendChild(o);
                });
            }
            trendDeptSel.addEventListener('change', function () {
                if (allData) renderTrendChart(allData.rows);
            });
        }

        if (slug) {
            var coDrop = document.getElementById('pfg-dash-company');
            if (coDrop) coDrop.style.display = 'none';
            var benchControls = document.getElementById('pfg-bench-co-controls');
            if (benchControls) benchControls.style.display = 'none';
            var benchPh = document.getElementById('pfg-bench-placeholder');
            if (benchPh) benchPh.textContent = 'Loading department comparison…';
        } else {
            var coDrop2 = document.getElementById('pfg-dash-company');
            if (coDrop2) coDrop2.addEventListener('change', onCompanyFilter);
        }

        initCompanyManager();
    });

    // ── Load ─────────────────────────────────────────────────────────────
    function loadData(company, dept, dateFrom, dateTo) {
        var slug = pfgDashData.companySlug || '';
        if (dateFrom === undefined) dateFrom = (document.getElementById('pfg-dash-date-from') || {}).value || '';
        if (dateTo   === undefined) dateTo   = (document.getElementById('pfg-dash-date-to')   || {}).value || '';
        var body = new FormData();
        body.append('action',       'pfg_dashboard_data');
        body.append('nonce',        pfgDashData.nonce);
        body.append('company',      slug ? '' : company);
        body.append('dept',         dept);
        body.append('date_from',    dateFrom);
        body.append('date_to',      dateTo);
        body.append('company_slug', slug);

        fetch(pfgDashData.ajaxUrl, { method: 'POST', body: body })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (!res.success) { alert('Dashboard error: ' + (res.data && res.data.message)); return; }
                allData = res.data;
                populateTopFilters(res.data.companies, res.data.departments);
                if (!slug && document.getElementById('pfg-dash-company').value) onCompanyFilter();
                if (!slug) populateBenchSelect(res.data.companies);
                renderAverages(res.data);
                renderTable(res.data.rows);
                if (slug) {
                    renderDeptBenchChart(res.data);
                    renderTrendChart(res.data.rows);
                }
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

    function onTimeframeChange() {
        var val  = (document.getElementById('pfg-dash-timeframe') || {}).value || 'all';
        var from = document.getElementById('pfg-dash-date-from');
        var to   = document.getElementById('pfg-dash-date-to');
        var now  = new Date();
        var toStr = now.toISOString().split('T')[0];
        if (val === 'all') {
            if (from) from.value = '';
            if (to)   to.value   = '';
        } else if (val !== 'custom') {
            var start = new Date(now);
            if (val === '30d')    start.setDate(start.getDate() - 30);
            else if (val === 'quarter') start.setMonth(start.getMonth() - 3);
            else if (val === '12m')     start.setFullYear(start.getFullYear() - 1);
            if (from) from.value = start.toISOString().split('T')[0];
            if (to)   to.value   = toStr;
        }
        if (val !== 'custom') {
            var slug = pfgDashData.companySlug || '';
            loadData(
                slug ? '' : document.getElementById('pfg-dash-company').value,
                document.getElementById('pfg-dash-dept').value
            );
        }
    }

    function populateBenchSelect(companies) {
        var container = document.getElementById('pfg-bench-co-checkboxes');
        if (!container) return;
        container.innerHTML = '';
        if (!companies || !companies.length) {
            container.innerHTML = '<span style="color:#94a3b8;font-size:0.8rem;">No companies yet.</span>';
            return;
        }
        companies.forEach(function (co, i) {
            var label = document.createElement('label');
            label.style.cssText = 'display:flex;align-items:center;gap:0.4rem;cursor:pointer;font-size:0.85rem;';
            var cb = document.createElement('input');
            cb.type = 'checkbox'; cb.value = co; cb.id = 'pfg-bench-cb-' + i;
            cb.addEventListener('change', onBenchSelectionChange);
            label.appendChild(cb);
            label.appendChild(document.createTextNode(co));
            container.appendChild(label);
        });
    }

    function onBenchSelectionChange() {
        var container = document.getElementById('pfg-bench-co-checkboxes');
        if (!container || !allData) return;
        var selected = [];
        container.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
            selected.push(cb.value);
        });
        var ph   = document.getElementById('pfg-bench-placeholder');
        var wrap = document.getElementById('pfg-bench-chart-wrap');
        if (!selected.length) {
            if (wrap) wrap.style.display = 'none';
            if (ph)   ph.style.display   = 'block';
            if (benchChart) { benchChart.destroy(); benchChart = null; }
            return;
        }
        if (ph)   ph.style.display   = 'none';
        if (wrap) wrap.style.display = 'block';
        renderBenchChart(selected, allData.company_avgs, allData.global_csf_avgs, allData.global_avg_total);
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

    // ── Benchmarking (multi-company radar) ───────────────────────────────
    function renderBenchChart(companies, companyAvgs, globalAvgs, globalTotal) {
        var ctx = document.getElementById('pfg-bench-chart');
        if (!ctx) return;
        if (benchChart) { benchChart.destroy(); benchChart = null; }

        var datasets = [];
        datasets.push({
            label: 'Global Average',
            data: CSF_KEYS.map(function (k) { return globalAvgs[k] || 0; }),
            borderColor: 'rgba(34,197,94,0.9)',
            backgroundColor: 'rgba(34,197,94,0.08)',
            borderWidth: 2, borderDash: [4, 3], pointRadius: 3
        });
        companies.forEach(function (coName) {
            var coData = null;
            (companyAvgs || []).forEach(function (c) { if (c.company === coName) coData = c; });
            if (!coData) return;
            var c = benchColor(coName);
            datasets.push({
                label: coName,
                data: CSF_KEYS.map(function (k) { return coData[k] || 0; }),
                borderColor: c,
                backgroundColor: c.replace(',1)', ',0.1)'),
                borderWidth: 2, pointRadius: 3
            });
        });
        benchChart = new Chart(ctx, {
            type: 'radar',
            data: { labels: CSF_LABELS, datasets: datasets },
            options: {
                animation: { duration: 0 }, responsive: true, maintainAspectRatio: false,
                scales: { r: { min: 0, max: 10, ticks: { stepSize: 2, font: { size: 9 }, backdropColor: 'transparent' }, grid: { color: 'rgba(0,0,0,0.07)' }, pointLabels: { font: { size: 9, family: 'Inter' } } } },
                plugins: { legend: { position: 'top', labels: { font: { size: 10 }, boxWidth: 12 } }, tooltip: { callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + c.raw + ' / 10'; } } } }
            }
        });
    }

    // ── Dept Bench Chart (client view) ────────────────────────────────────
    function renderDeptBenchChart(data) {
        var wrap = document.getElementById('pfg-bench-chart-wrap');
        var ph   = document.getElementById('pfg-bench-placeholder');
        if (!data.dept_avgs || !data.dept_avgs.length) {
            if (ph) { ph.style.display = 'block'; ph.textContent = 'No department data yet.'; }
            return;
        }
        if (ph)   ph.style.display   = 'none';
        if (wrap) wrap.style.display = 'block';
        var ctx = document.getElementById('pfg-bench-chart');
        if (!ctx) return;
        if (benchChart) { benchChart.destroy(); benchChart = null; }

        var palette = [
            'rgba(34,197,94,0.8)', 'rgba(240,180,41,0.8)', 'rgba(59,130,246,0.8)',
            'rgba(239,68,68,0.8)', 'rgba(168,85,247,0.8)', 'rgba(20,184,166,0.8)'
        ];
        var datasets = [];
        var coAvg = (data.company_avgs && data.company_avgs[0]) || null;
        if (coAvg) {
            datasets.push({
                label: 'Company Avg',
                data: CSF_KEYS.map(function (k) { return coAvg[k] || 0; }),
                borderColor: 'rgba(100,116,139,0.9)',
                backgroundColor: 'rgba(100,116,139,0.08)',
                borderWidth: 2, borderDash: [4, 3], pointRadius: 3
            });
        }
        if (data.true_global_csf_avgs) {
            datasets.push({
                label: 'Global Average',
                data: CSF_KEYS.map(function (k) { return data.true_global_csf_avgs[k] || 0; }),
                borderColor: 'rgba(34,197,94,0.9)',
                backgroundColor: 'rgba(34,197,94,0.06)',
                borderWidth: 2, borderDash: [2, 4], pointRadius: 3
            });
        }
        data.dept_avgs.forEach(function (dept, i) {
            var c = palette[i % palette.length];
            datasets.push({
                label: dept.department,
                data: CSF_KEYS.map(function (k) { return dept[k] || 0; }),
                borderColor: c.replace('0.8', '1'),
                backgroundColor: c.replace('0.8', '0.1'),
                borderWidth: 2, pointRadius: 3
            });
        });
        benchChart = new Chart(ctx, {
            type: 'radar',
            data: { labels: CSF_LABELS, datasets: datasets },
            options: {
                animation: { duration: 0 }, responsive: true, maintainAspectRatio: false,
                scales: { r: { min: 0, max: 10, ticks: { stepSize: 2, font: { size: 9 }, backdropColor: 'transparent' }, grid: { color: 'rgba(0,0,0,0.07)' }, pointLabels: { font: { size: 9, family: 'Inter' } } } },
                plugins: { legend: { position: 'top', labels: { font: { size: 10 }, boxWidth: 12 } }, tooltip: { callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + c.raw + ' / 10'; } } } }
            }
        });
    }

    // ── Trend Chart (client view) ─────────────────────────────────────────
    function isoWeek(d) {
        var t = new Date(d.getTime());
        t.setHours(0, 0, 0, 0);
        t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7);
        var w1 = new Date(t.getFullYear(), 0, 4);
        return 1 + Math.round(((t.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
    }

    function trendGroupKey(dateStr, gran) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (gran === 'day')  return dateStr.substring(0, 10);
        if (gran === 'week') { var w = isoWeek(d); return d.getFullYear() + '-W' + (w < 10 ? '0' : '') + w; }
        if (gran === 'year') return String(d.getFullYear());
        return dateStr.substring(0, 7);
    }

    function renderTrendChart(rows) {
        var ctx = document.getElementById('pfg-trend-chart');
        if (!ctx) return;
        if (trendChart) { trendChart.destroy(); trendChart = null; }
        if (!rows || !rows.length) return;
        var granSel    = document.getElementById('pfg-trend-granularity');
        var gran       = granSel ? granSel.value : 'month';
        var deptFilter = (document.getElementById('pfg-trend-dept') || {}).value || '';
        var filtered   = deptFilter ? rows.filter(function (r) { return r.department === deptFilter; }) : rows;
        var grouped = {};
        filtered.forEach(function (row) {
            var key = trendGroupKey(row.submitted_at || '', gran);
            if (!key) return;
            if (!grouped[key]) grouped[key] = { sum: 0, count: 0 };
            grouped[key].sum   += parseFloat(row.total_score) || 0;
            grouped[key].count += 1;
        });
        var keys = Object.keys(grouped).sort();
        var avgs = keys.map(function (k) { return parseFloat((grouped[k].sum / grouped[k].count).toFixed(1)); });
        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: keys,
                datasets: [{ label: 'Avg Total Score', data: avgs, borderColor: 'rgba(34,197,94,0.9)', backgroundColor: 'rgba(34,197,94,0.1)', fill: true, tension: 0.3, pointBackgroundColor: '#22C55E', pointRadius: 4, borderWidth: 2 }]
            },
            options: {
                animation: { duration: 0 }, responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { min: 0, max: 100, ticks: { stepSize: 20, font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.06)' }, title: { display: true, text: 'Avg Score / 100', font: { size: 10 } } },
                    x: { ticks: { font: { size: 10 } } }
                },
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return ' Avg: ' + c.raw + ' / 100'; } } } }
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

        // Calculate averages
        var n = rows.length;
        var avgTotal = 0;
        var avgCSF = {};
        CSF_KEYS.forEach(function (k) { avgCSF[k] = 0; });
        rows.forEach(function (row) {
            avgTotal += parseFloat(row.total_score) || 0;
            CSF_KEYS.forEach(function (k) { avgCSF[k] += parseFloat(row[k]) || 0; });
        });
        avgTotal = (avgTotal / n).toFixed(1);
        CSF_KEYS.forEach(function (k) { avgCSF[k] = (avgCSF[k] / n).toFixed(1); });

        var isClient   = !!(pfgDashData && pfgDashData.companySlug);
        var hideDelete = !!(pfgDashData && pfgDashData.hideDelete);
        var html = '<div style="overflow-x:auto;"><table class="pfg-dash-table"><thead><tr>';
        html += '<th>PDF</th><th>Name</th>';
        if (!isClient) html += '<th>Company</th>';
        html += '<th>Dept</th><th>Email</th>';
        CSF_SHORT.forEach(function (l) { html += '<th>' + l + '</th>'; });
        html += '<th>Total</th><th>Tier</th><th>Date</th>';
        if (!hideDelete) html += '<th>Del</th>';
        html += '</tr></thead><tbody>';
        rows.forEach(function (row, idx) {
            html += '<tr>';
            html += '<td><button class="pfg-pdf-row-btn" data-idx="' + idx + '" title="Download PDF">&#8595;</button></td>';
            html += '<td>' + esc(row.user_name) + '</td>';
            if (!isClient) html += '<td>' + esc(row.company) + '</td>';
            html += '<td>' + esc(row.department) + '</td>';
            var emailVal = (row.email && row.email !== '&#8211;') ? row.email : '-';
            html += '<td>' + esc(emailVal) + '</td>';
            CSF_KEYS.forEach(function (k) { html += '<td style="text-align:center;">' + esc(row[k]) + '</td>'; });
            html += '<td style="text-align:center;font-weight:700;">' + esc(row.total_score) + '</td>';
            html += '<td>' + esc(row.tier) + '</td>';
            html += '<td>' + esc((row.submitted_at || '').split(' ')[0]) + '</td>';
            if (!hideDelete) html += '<td><button class="pfg-del-row-btn" data-id="' + esc(row.id) + '" title="Delete">&#10005;</button></td>';
            html += '</tr>';
        });
        html += '</tbody>';
        html += '<tfoot><tr style="background:#f0fdf4;font-weight:700;border-top:2px solid #22C55E;">';
        html += '<td></td>';
        html += '<td style="text-align:left;padding:6px 8px;color:#64748b;white-space:nowrap;">Averages</td>';
        html += isClient ? '<td colspan="2"></td>' : '<td colspan="3"></td>';
        CSF_KEYS.forEach(function (k) { html += '<td style="text-align:center;color:#16a34a;">' + avgCSF[k] + '</td>'; });
        html += '<td style="text-align:center;color:#16a34a;">' + avgTotal + '</td>';
        html += hideDelete ? '<td colspan="2"></td>' : '<td colspan="3"></td>';
        html += '</tr></tfoot>';
        html += '</table></div>';
        wrap.innerHTML = html;
        wrap.querySelectorAll('.pfg-pdf-row-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                generateRowPDF(rows[parseInt(btn.getAttribute('data-idx'), 10)]);
            });
        });
        wrap.querySelectorAll('.pfg-del-row-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (!confirm('Delete this entry? This cannot be undone.')) return;
                var id = btn.getAttribute('data-id');
                var body = new FormData();
                body.append('action', 'pfg_delete_entry');
                body.append('nonce',  pfgDashData.nonce);
                body.append('id',     id);
                fetch(pfgDashData.ajaxUrl, { method: 'POST', body: body })
                    .then(function (r) { return r.json(); })
                    .then(function (res) {
                        if (res.success) {
                            loadData(
                                document.getElementById('pfg-dash-company').value,
                                document.getElementById('pfg-dash-dept').value
                            );
                        } else {
                            alert('Delete failed: ' + (res.data && res.data.message));
                        }
                    });
            });
        });
    }

    // ── Per-Row PDF (jsPDF direct) ────────────────────────────────────────
    function generateRowPDF(row) {
        var jsPDFLib = window.jspdf && window.jspdf.jsPDF;
        if (!jsPDFLib) { alert('PDF library not loaded.'); return; }

        var offCanvas = document.createElement('canvas');
        offCanvas.width = 300; offCanvas.height = 300;
        offCanvas.style.cssText = 'position:absolute;left:-9999px;top:0;';
        document.body.appendChild(offCanvas);
        var chartValues = CSF_KEYS.map(function (k) { return parseFloat(row[k]) || 0; });
        var tmpChart = new Chart(offCanvas, {
            type: 'radar',
            data: { labels: CSF_LABELS, datasets: [{ data: chartValues, backgroundColor: 'rgba(34,197,94,0.15)', borderColor: 'rgba(34,197,94,0.85)', pointBackgroundColor: '#F0B429', borderWidth: 2, pointRadius: 4 }] },
            options: { animation: false, responsive: false, plugins: { legend: { display: false } }, scales: { r: { min: 0, max: 10, ticks: { stepSize: 2, backdropColor: 'transparent' } } } }
        });
        var chartImg = offCanvas.toDataURL('image/png');
        tmpChart.destroy();
        document.body.removeChild(offCanvas);

        var doc = new jsPDFLib({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        var W = 210, margin = 14, y = 14;

        var logoSrc = (allData && allData.company_logo_map && allData.company_logo_map[row.company])
            || pfgDashData.logoUrl
            || '';
        if (logoSrc && logoSrc.indexOf('assets/images/logo.png') !== -1) logoSrc = '';
        if (logoSrc) {
            try {
                var logoImg = new Image();
                logoImg.src = logoSrc;
                var logoMaxW = 60, logoMaxH = 18;
                var logoW = logoImg.naturalWidth  || logoImg.width  || 1;
                var logoH = logoImg.naturalHeight || logoImg.height || 1;
                var ratio = logoW / logoH;
                var rendW = logoMaxW, rendH = rendW / ratio;
                if (rendH > logoMaxH) { rendH = logoMaxH; rendW = rendH * ratio; }
                var logoX = W / 2 - rendW / 2;
                doc.addImage(logoImg, 'PNG', logoX, y, rendW, rendH);
                y += rendH + 6;
            } catch(e) {}
        } else {
            var rowCo = row.company || 'Company Name';
            var cNameDash = rowCo.charAt(0).toUpperCase() + rowCo.slice(1);
            doc.setFontSize(22).setFont(undefined, 'bold').setTextColor(30, 41, 59);
            doc.text(cNameDash, W / 2, y + 8, { align: 'center' });
            y += 18;
        }
        doc.setFontSize(14).setFont(undefined, 'bold').setTextColor(30, 41, 59);
        doc.text('PFG Predictive Index', W / 2, y, { align: 'center' });
        y += 6;
        doc.setFontSize(9).setFont(undefined, 'normal').setTextColor(100, 116, 139);
        doc.text('Assessment Report', W / 2, y, { align: 'center' });
        y += 8;
        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, W - margin, y);
        y += 6;

        var cNameDashCap = (row.company || '').charAt(0).toUpperCase() + (row.company || '').slice(1);
        var infoRows = [['Name', row.user_name || ''], ['Company', cNameDashCap], ['Department', row.department || ''], ['Date', (row.submitted_at || '').split(' ')[0]]];
        if (row.email && row.email !== '-') infoRows.push(['Email', row.email]);
        doc.setFontSize(9);
        infoRows.forEach(function (r) {
            doc.setFont(undefined, 'normal').setTextColor(100, 116, 139);
            doc.text(r[0], margin, y);
            doc.setFont(undefined, 'bold').setTextColor(30, 41, 59);
            doc.text(r[1], margin + 32, y);
            y += 6;
        });
        y += 2;
        doc.line(margin, y, W - margin, y);
        y += 6;

        var csf_full = ['Communication', 'Knowledge & Skills', 'Leadership', 'Measurement', 'Morale', 'Process & Procedure', 'Recognition', 'Resource (Quantity)', 'Resource (Quality)', 'Standards'];
        var scoreStartY = y;
        doc.setFontSize(7).setFont(undefined, 'bold').setTextColor(100, 116, 139);
        doc.text('CSF SCORES', margin, y);
        y += 4;
        CSF_KEYS.forEach(function (k, i) {
            var val = row[k] || '-';
            doc.setFont(undefined, 'normal').setTextColor(30, 41, 59).setFontSize(8);
            doc.text(csf_full[i], margin, y);
            doc.setFont(undefined, 'bold');
            doc.text(String(val) + ' / 10', margin + 68, y, { align: 'right' });
            doc.setDrawColor(241, 245, 249);
            doc.line(margin, y + 1, margin + 68, y + 1);
            y += 5.5;
        });
        doc.addImage(chartImg, 'PNG', 115, scoreStartY - 2, 72, 72);
        y += 6;

        doc.setFillColor(240, 253, 244);
        doc.roundedRect(margin, y, W - margin * 2, 28, 4, 4, 'F');
        doc.setFontSize(28).setFont(undefined, 'bold').setTextColor(22, 101, 52);
        doc.text(String(row.total_score || '-'), W / 2, y + 14, { align: 'center' });
        doc.setFontSize(9).setFont(undefined, 'normal');
        doc.text('/ 100', W / 2, y + 20, { align: 'center' });
        doc.setFillColor(34, 197, 94);
        doc.roundedRect(W / 2 - 18, y + 22, 36, 5, 2, 2, 'F');
        doc.setFontSize(8).setFont(undefined, 'bold').setTextColor(255, 255, 255);
        doc.text(row.tier || '', W / 2, y + 25.5, { align: 'center' });

        if (row.interpretation) {
            y += 34;
            doc.setFontSize(8).setFont(undefined, 'normal').setTextColor(30, 41, 59);
            var interpLines = doc.splitTextToSize(row.interpretation, W - margin * 2);
            doc.text(interpLines, margin, y);
        }

        var fname = 'PFG-' + (row.user_name || 'Report').replace(/[^a-zA-Z0-9]/g, '-') + '.pdf';
        doc.save(fname);
    }

    // ── Company Manager ───────────────────────────────────────────────────
    function initCompanyManager() {
        var addForm = document.getElementById('pfg-add-company-form');
        if (!addForm) return;

        addForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var name  = document.getElementById('pfg-co-name').value.trim();
            var errEl = document.getElementById('pfg-co-error');
            if (!name) { errEl.textContent = 'Company name is required.'; errEl.style.display = 'block'; return; }
            errEl.style.display = 'none';
            var body = new FormData();
            body.append('action', 'pfg_add_company');
            body.append('nonce',  pfgDashData.nonce);
            body.append('name',   name);
            var fileInput = document.getElementById('pfg-co-logo-file');
            if (fileInput && fileInput.files && fileInput.files[0]) {
                body.append('logo_file', fileInput.files[0]);
            }
            fetch(pfgDashData.ajaxUrl, { method: 'POST', body: body })
                .then(function (r) { return r.json(); })
                .then(function (res) {
                    if (res.success) {
                        var d = res.data || {};
                        var msg = 'Company added!\n\nAssessment URL:\n' + (d.assess_url || 'N/A') +
                                  '\n\nDashboard URL:\n' + (d.dash_url || 'N/A') +
                                  '\n\nAdmin URL:\n' + (d.admin_url || 'N/A') +
                                  '\n\nDashboard Password: ' + (d.dash_password || 'N/A');
                        alert(msg);
                        location.reload();
                    } else {
                        errEl.textContent = (res.data && res.data.message) || 'Error adding company.';
                        errEl.style.display = 'block';
                    }
                });
        });

        document.querySelectorAll('.pfg-del-company-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (!confirm('Delete this company and ALL its submissions? This cannot be undone.')) return;
                var id = btn.getAttribute('data-id');
                var body = new FormData();
                body.append('action', 'pfg_delete_company');
                body.append('nonce',  pfgDashData.nonce);
                body.append('id',     id);
                fetch(pfgDashData.ajaxUrl, { method: 'POST', body: body })
                    .then(function (r) { return r.json(); })
                    .then(function (res) {
                        if (res.success) { location.reload(); }
                        else { alert('Delete failed: ' + (res.data && res.data.message)); }
                    });
            });
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
        var sums = [0,0,0,0,0,0,0,0,0,0,0];
        allData.rows.forEach(function (r) {
            lines.push([
                r.id, csvCell(r.user_name), csvCell(r.company), csvCell(r.department), csvCell(r.email || ''),
                r.score_communication, r.score_knowledge, r.score_leadership, r.score_measurement, r.score_morale,
                r.score_process, r.score_recognition, r.score_resource_qty, r.score_resource_qual, r.score_standards,
                r.total_score, csvCell(r.tier), r.submitted_at
            ].join(','));
            sums[0]  += parseFloat(r.score_communication)  || 0;
            sums[1]  += parseFloat(r.score_knowledge)       || 0;
            sums[2]  += parseFloat(r.score_leadership)      || 0;
            sums[3]  += parseFloat(r.score_measurement)     || 0;
            sums[4]  += parseFloat(r.score_morale)          || 0;
            sums[5]  += parseFloat(r.score_process)         || 0;
            sums[6]  += parseFloat(r.score_recognition)     || 0;
            sums[7]  += parseFloat(r.score_resource_qty)    || 0;
            sums[8]  += parseFloat(r.score_resource_qual)   || 0;
            sums[9]  += parseFloat(r.score_standards)       || 0;
            sums[10] += parseFloat(r.total_score)           || 0;
        });
        var counts = allData.rows.length;
        if (counts > 0) {
            lines.push([
                '', 'AVERAGE', '', '', '',
                (sums[0]/counts).toFixed(1),  (sums[1]/counts).toFixed(1),
                (sums[2]/counts).toFixed(1),  (sums[3]/counts).toFixed(1),
                (sums[4]/counts).toFixed(1),  (sums[5]/counts).toFixed(1),
                (sums[6]/counts).toFixed(1),  (sums[7]/counts).toFixed(1),
                (sums[8]/counts).toFixed(1),  (sums[9]/counts).toFixed(1),
                (sums[10]/counts).toFixed(1), '', ''
            ].join(','));
        }
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
