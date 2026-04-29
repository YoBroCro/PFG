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
        form.addEventListener('submit', handleSubmit);
        const retakeBtn = document.getElementById('pfg-retake-btn');
        if (retakeBtn) retakeBtn.addEventListener('click', resetForm);
        const pdfBtn = document.getElementById('pfg-pdf-btn');
        if (pdfBtn) pdfBtn.addEventListener('click', downloadPDF);
    }

    // ── Sliders ───────────────────────────────────────────────────────────
    function initSliders() {
        CSF_KEYS.forEach(key => {
            const slider = document.getElementById('csf-' + key);
            const valEl  = document.getElementById('val-' + key);
            if (!slider || !valEl) return;
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
        var el = document.getElementById('pfg-results');
        if (!el || typeof html2pdf === 'undefined') return;
        var btn = document.getElementById('pfg-pdf-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
        setTimeout(function () {
            var opt = {
                margin:       [ 10, 10, 10, 10 ],
                filename:     'PFG-Assessment-Results.pdf',
                image:        { type: 'jpeg', quality: 0.97 },
                html2canvas:  { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(el).save().then(function () {
                if (btn) { btn.disabled = false; btn.textContent = '↓ Download PDF Report'; }
            });
        }, 300);
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
                animation: { duration: 0 },
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
