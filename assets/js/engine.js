/* PFG Engine v2.1 | build 2026-04-30 */
(function () {
    'use strict';

    const CSF_LABELS = [
        'Communication', 'Knowledge & Skills', 'Leadership', 'Measurement',
        'Morale', 'Process & Procedure', 'Recognition',
        'Resource (Qty)', 'Resource (Qual)', 'Standards'
    ];

    const CSF_KEYS = [
        'communication', 'knowledge', 'leadership', 'measurement', 'morale',
        'process', 'recognition', 'resource_qty', 'resource_qual', 'standards'
    ];

    let pfgChart = null;

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        const form = document.getElementById('pfg-form');
        if (!form) return;
        initSliders();
        initMobileTooltips();
        form.addEventListener('submit', handleSubmit);
        const retakeBtn = document.getElementById('pfg-retake-btn');
        if (retakeBtn) retakeBtn.addEventListener('click', resetForm);
        const pdfBtn = document.getElementById('pfg-pdf-btn');
        if (pdfBtn) pdfBtn.addEventListener('click', downloadPDF);
    }

    function initMobileTooltips() {
        var tip = document.getElementById('pfg-mobile-tooltip');
        if (!tip) return;
        document.querySelectorAll('.pfg-tooltip-icon').forEach(function (icon) {
            icon.addEventListener('click', function (e) {
                e.stopPropagation();
                if (tip.dataset.src === icon.dataset.tip && tip.style.display === 'block') {
                    tip.style.display = 'none';
                    return;
                }
                var rect = icon.getBoundingClientRect();
                tip.textContent = icon.getAttribute('data-tip');
                tip.dataset.src = icon.dataset.tip;
                tip.style.top  = (rect.bottom + window.scrollY + 10) + 'px';
                tip.style.display = 'block';
            });
        });
        document.addEventListener('click', function () {
            tip.style.display = 'none';
        });
    }

    // ── Sliders ───────────────────────────────────────────────────────────
    function initSliders() {
        CSF_KEYS.forEach(key => {
            const slider = document.getElementById('csf-' + key);
            const valEl  = document.getElementById('val-' + key);
            if (!slider || !valEl) return;
            slider.dataset.unset = 'false';
            valEl.textContent    = slider.value;
            valEl.style.color    = scoreColor(parseInt(slider.value, 10));
            updateTrack(slider, parseInt(slider.value, 10));
            slider.addEventListener('input', () => {
                const v = parseInt(slider.value, 10);
                slider.dataset.unset = 'false';
                valEl.textContent    = v;
                valEl.style.color    = scoreColor(v);
                updateTrack(slider, v);
                updateLiveTotal();
            });
        });
        updateLiveTotal();
    }

    function updateTrack(slider, v) {
        const pct = ((v - 1) / 9) * 100;
        slider.style.background =
            'linear-gradient(to right, #22C55E ' + pct + '%, #E0FFFF ' + pct + '%)';
    }

    function scoreColor(v) {
        if (v >= 9) return '#22C55E';
        if (v >= 7) return '#84cc16';
        if (v >= 5) return '#F0B429';
        if (v >= 3) return '#fb923c';
        return '#ef4444';
    }

    function updateLiveTotal() {
        var total  = 0;
        var allSet = true;
        CSF_KEYS.forEach(function (key) {
            var s = document.getElementById('csf-' + key);
            if (!s || s.dataset.unset !== 'false') { allSet = false; return; }
            total += parseInt(s.value, 10);
        });
        var el = document.getElementById('pfg-live-total');
        if (el) el.textContent = allSet ? total : '–';
    }

    // ── Submit ────────────────────────────────────────────────────────────
    function handleSubmit(e) {
        e.preventDefault();
        hideError();

        var form      = e.target;
        var submitBtn = document.getElementById('pfg-submit-btn');

        var nameEl    = form.querySelector('[name="user_name"]');
        var emailEl   = form.querySelector('[name="email"]');
        var companyEl = form.querySelector('[name="company"]');
        var deptEl    = form.querySelector('[name="department"]');

        var name    = nameEl    ? nameEl.value.trim()    : '';
        var email   = emailEl   ? emailEl.value.trim()   : '';
        var company = companyEl ? companyEl.value.trim() : '';
        var dept    = deptEl    ? deptEl.value.trim()    : '';

        if (!name || !company || !dept) {
            showError('Please fill in your name, company, and department.');
            return;
        }

        var unset = CSF_KEYS.filter(function (key) {
            var s = document.getElementById('csf-' + key);
            return !s || s.dataset.unset !== 'false';
        });

        if (unset.length > 0) {
            showError('Please rate all 10 Critical Success Factors before submitting.');
            return;
        }

        var data = new FormData();
        data.append('action',     'pfg_submit');
        data.append('nonce',      pfgData.nonce);
        data.append('user_name',  name);
        data.append('email',      email);
        data.append('company',    company);
        data.append('department', dept);
        CSF_KEYS.forEach(function (key) {
            data.append('score_' + key, document.getElementById('csf-' + key).value);
        });

        submitBtn.disabled = true;
        submitBtn.querySelector('.btn-text').style.display    = 'none';
        submitBtn.querySelector('.btn-loading').style.display = 'inline';

        fetch(pfgData.ajaxUrl, { method: 'POST', body: data })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (res.success) {
                    showResults(res.data);
                } else {
                    showError((res.data && res.data.message) || 'Submission failed. Please try again.');
                    resetBtn(submitBtn);
                }
            })
            .catch(function () {
                showError('Network error. Please check your connection and try again.');
                resetBtn(submitBtn);
            });
    }

    function resetBtn(btn) {
        btn.disabled = false;
        btn.querySelector('.btn-text').style.display    = 'inline';
        btn.querySelector('.btn-loading').style.display = 'none';
    }

    // ── Results ───────────────────────────────────────────────────────────
    function showResults(data) {
        document.getElementById('pfg-form-section').style.display = 'none';
        var resultsEl = document.getElementById('pfg-results');
        resultsEl.style.display = 'block';
        document.getElementById('res-total').textContent = data.total;
        document.getElementById('res-tier').textContent  = data.tier;
        var interp = document.getElementById('res-interpretation');
        if (interp) interp.textContent = data.interpretation || '';
        renderChart(data.scores);
        resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function downloadPDF() {
        var jsPDFLib = window.jspdf && window.jspdf.jsPDF;
        if (!jsPDFLib) { alert('PDF library not loaded.'); return; }
        var btn = document.getElementById('pfg-pdf-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Generating\u2026'; }

        var name    = (document.querySelector('[name="user_name"]')  || {}).value || '';
        var company = (document.querySelector('[name="company"]')    || {}).value || '';
        var dept    = (document.querySelector('[name="department"]') || {}).value || '';
        var email   = (document.querySelector('[name="email"]')      || {}).value || '';
        var total   = (document.getElementById('res-total') || {}).textContent || '';
        var tier    = (document.getElementById('res-tier')  || {}).textContent || '';

        var chartImg = pfgChart ? pfgChart.toBase64Image() : null;

        var doc = new jsPDFLib({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        var W = 210, margin = 14, y = 14;

        // Logo or title
        if (pfgData.pluginUrl && chartImg !== null) {
            try {
                var logoImg = new Image();
                logoImg.src = pfgData.pluginUrl + 'assets/images/logo.png';
                doc.addImage(logoImg, 'PNG', W / 2 - 20, y, 40, 14);
                y += 18;
            } catch(e) { /* fallback below */ }
        }
        doc.setFontSize(14).setFont(undefined, 'bold');
        doc.text('PFG Predictive Index', W / 2, y, { align: 'center' });
        y += 6;
        doc.setFontSize(9).setFont(undefined, 'normal').setTextColor(100, 116, 139);
        doc.text('Assessment Report', W / 2, y, { align: 'center' });
        y += 8;
        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y, W - margin, y);
        y += 6;

        // Info table
        doc.setTextColor(30, 41, 59);
        var infoRows = [['Name', name], ['Company', company], ['Department', dept]];
        if (email) infoRows.push(['Email', email]);
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

        // CSF scores + chart side by side
        var scoreColX = margin, chartX = 110, chartSize = 72;
        doc.setFontSize(7).setFont(undefined, 'bold').setTextColor(100, 116, 139);
        doc.text('CSF SCORES', scoreColX, y);
        y += 4;
        CSF_KEYS.forEach(function (k, i) {
            var el = document.getElementById('val-' + k);
            var val = el ? el.textContent : '-';
            doc.setFont(undefined, 'normal').setTextColor(30, 41, 59).setFontSize(8);
            doc.text(CSF_LABELS[i], scoreColX, y);
            doc.setFont(undefined, 'bold');
            doc.text(val + ' / 10', scoreColX + 60, y, { align: 'right' });
            doc.setDrawColor(241, 245, 249);
            doc.line(scoreColX, y + 1, scoreColX + 60, y + 1);
            y += 5.5;
        });

        if (chartImg) {
            doc.addImage(chartImg, 'PNG', chartX, y - (CSF_KEYS.length * 5.5) - 4, chartSize, chartSize);
        }
        y += 6;

        // Score card
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(margin, y, W - margin * 2, 28, 4, 4, 'F');
        doc.setFontSize(28).setFont(undefined, 'bold').setTextColor(22, 101, 52);
        doc.text(total, W / 2, y + 14, { align: 'center' });
        doc.setFontSize(9).setFont(undefined, 'normal').setTextColor(22, 101, 52);
        doc.text('/ 100', W / 2, y + 20, { align: 'center' });
        doc.setFillColor(34, 197, 94);
        doc.roundedRect(W / 2 - 18, y + 22, 36, 5, 2, 2, 'F');
        doc.setFontSize(8).setFont(undefined, 'bold').setTextColor(255, 255, 255);
        doc.text(tier, W / 2, y + 25.5, { align: 'center' });

        var interp = (document.getElementById('res-interpretation') || {}).textContent || '';
        if (interp) {
            y += 34;
            doc.setFontSize(8).setFont(undefined, 'normal').setTextColor(30, 41, 59);
            var interpLines = doc.splitTextToSize(interp, W - margin * 2);
            doc.text(interpLines, margin, y);
        }

        doc.save('PFG-Assessment-Results.pdf');
        if (btn) { btn.disabled = false; btn.textContent = '\u2193 Download PDF Report'; }
    }




    function renderChart(scores) {
        var ctx = document.getElementById('pfg-chart');
        if (!ctx) return;
        if (pfgChart) { pfgChart.destroy(); pfgChart = null; }
        pfgChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: CSF_LABELS,
                datasets: [{
                    label: 'Your Scores',
                    data:  scores,
                    backgroundColor:           'rgba(34, 197, 94, 0.15)',
                    borderColor:               'rgba(34, 197, 94, 0.85)',
                    pointBackgroundColor:      '#F0B429',
                    pointBorderColor:          '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor:     '#F0B429',
                    borderWidth: 2,
                    pointRadius: 5
                }]
            },
            options: {
                animation: false,
                responsive: true,
                scales: {
                    r: {
                        min: 0, max: 10,
                        ticks:       { stepSize: 2, font: { size: 10 } },
                        grid:        { color: 'rgba(0,0,0,0.07)' },
                        pointLabels: { font: { size: 11, family: 'Inter' } }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) { return ' Score: ' + ctx.raw + ' / 10'; }
                        }
                    }
                }
            }
        });
    }

    // ── Reset ─────────────────────────────────────────────────────────────
    function resetForm() {
        document.getElementById('pfg-results').style.display = 'none';
        var formSection = document.getElementById('pfg-form-section');
        formSection.style.display = 'block';
        document.getElementById('pfg-form').reset();
        CSF_KEYS.forEach(function (key) {
            var s = document.getElementById('csf-' + key);
            var v = document.getElementById('val-' + key);
            if (s) { s.value = 5; s.dataset.unset = 'true'; updateTrack(s, 5); }
            if (v) { v.textContent = '–'; v.style.color = '#94a3b8'; }
        });
        var lt = document.getElementById('pfg-live-total');
        if (lt) lt.textContent = '–';
        resetBtn(document.getElementById('pfg-submit-btn'));
        hideError();
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    function showError(msg) {
        var el = document.getElementById('pfg-error-msg');
        if (el) { el.textContent = msg; el.style.display = 'block'; }
    }

    function hideError() {
        var el = document.getElementById('pfg-error-msg');
        if (el) el.style.display = 'none';
    }

})();
