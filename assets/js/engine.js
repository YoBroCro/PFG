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
        document.querySelectorAll('.pfg-tooltip-icon').forEach(function (icon) {
            icon.addEventListener('click', function (e) {
                e.stopPropagation();
                var rect = icon.getBoundingClientRect();
                var isActive = icon.classList.contains('pfg-tt-active');
                document.querySelectorAll('.pfg-tooltip-icon.pfg-tt-active').forEach(function (el) {
                    el.classList.remove('pfg-tt-active');
                });
                if (!isActive) {
                    icon.style.setProperty('--pfg-tt-top', (rect.top + 30) + 'px');
                    icon.classList.add('pfg-tt-active');
                }
            });
        });
        document.addEventListener('click', function () {
            document.querySelectorAll('.pfg-tooltip-icon.pfg-tt-active').forEach(function (el) {
                el.classList.remove('pfg-tt-active');
            });
        });
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
        if (typeof html2pdf === 'undefined') { alert('PDF library not loaded.'); return; }
        var btn = document.getElementById('pfg-pdf-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Generating\u2026'; }

        // Get data from displayed results
        var name    = (document.getElementById('res-name')  || {}).textContent || '';
        var company = (document.getElementById('res-company')|| {}).textContent || '';
        var dept    = (document.getElementById('res-dept')   || {}).textContent || '';
        var email   = (document.getElementById('res-email')  || {}).textContent || '';
        var total   = (document.getElementById('res-total')  || {}).textContent || '';
        var tier    = (document.getElementById('res-tier')   || {}).textContent || '';

        // Extract chart as image
        var chartImg = '';
        if (pfgChart) {
            try { chartImg = pfgChart.toBase64Image(); } catch(e) {}
        }

        // Build CSF score rows
        var scoreHtml = '';
        CSF_KEYS.forEach(function(k, i) {
            var el = document.getElementById('val-' + k);
            var val = el ? el.textContent : '\u2013';
            scoreHtml += '<tr>'
                + '<td style="padding:4px 10px;font-size:11px;border-bottom:1px solid #f1f5f9;color:#1e293b;">' + CSF_LABELS[i] + '</td>'
                + '<td style="padding:4px 10px;font-size:11px;font-weight:600;text-align:center;border-bottom:1px solid #f1f5f9;color:#1e293b;">' + val + ' / 10</td>'
                + '</tr>';
        });

        var html = '<div style="font-family:Helvetica,Arial,sans-serif;color:#1a1a2e;padding:30px;background:#ffffff;width:650px;box-sizing:border-box;">'
            + '<div style="text-align:center;border-bottom:2px solid #f1f5f9;padding-bottom:15px;margin-bottom:20px;">'
            + (pfgData.pluginUrl ? '<img src="' + pfgData.pluginUrl + 'assets/images/logo.png" style="max-height:60px;width:auto;display:block;margin:0 auto 8px;" alt="Logo">' : '<div style="font-size:26px;font-weight:700;letter-spacing:5px;color:#111827;">GLO</div>')
            + '<div style="font-size:16px;font-weight:700;color:#111827;">PFG Predictive Index</div>'
            + '<div style="font-size:12px;color:#64748b;">Assessment Report</div>'
            + '</div>'
            + '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;background:#f8fafc;border-radius:8px;overflow:hidden;">'
            + '<tr><td style="padding:8px 12px;font-size:11px;color:#64748b;width:120px;border-bottom:1px solid #e2e8f0;">Name</td><td style="padding:8px 12px;font-weight:600;font-size:12px;border-bottom:1px solid #e2e8f0;">' + name + '</td></tr>'
            + '<tr><td style="padding:8px 12px;font-size:11px;color:#64748b;width:120px;border-bottom:1px solid #e2e8f0;">Company</td><td style="padding:8px 12px;font-weight:600;font-size:12px;border-bottom:1px solid #e2e8f0;">' + company + '</td></tr>'
            + '<tr><td style="padding:8px 12px;font-size:11px;color:#64748b;width:120px;border-bottom:1px solid #e2e8f0;">Department</td><td style="padding:8px 12px;font-weight:600;font-size:12px;border-bottom:1px solid #e2e8f0;">' + dept + '</td></tr>'
            + (email ? '<tr><td style="padding:8px 12px;font-size:11px;color:#64748b;width:120px;">Email</td><td style="padding:8px 12px;font-weight:600;font-size:12px;">' + email + '</td></tr>' : '')
            + '</table>'
            + '<div style="display:flex;gap:30px;align-items:flex-start;margin-bottom:25px;">'
            + '<div style="flex:1;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#64748b;margin-bottom:10px;border-bottom:1px solid #e2e8f0;padding-bottom:5px;">CSF Scores</div>'
            + '<table style="width:100%;border-collapse:collapse;">' + scoreHtml + '</table></div>'
            + (chartImg ? '<div style="flex-shrink:0;"><img src="' + chartImg + '" width="240" height="240" style="display:block;"/></div>' : '')
            + '</div>'
            + '<div style="text-align:center;padding:20px;background:#f0fdf4;border-radius:12px;border:1px solid #dcfce7;">'
            + '<div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:5px;">Aggregate Score</div>'
            + '<div style="font-size:48px;font-weight:800;color:#166534;line-height:1;">' + total + '</div>'
            + '<div style="font-size:12px;color:#166534;margin-bottom:12px;font-weight:500;">/ 100</div>'
            + '<div style="display:inline-block;padding:6px 24px;border-radius:999px;background:#22C55E;color:#fff;font-weight:700;font-size:13px;box-shadow:0 2px 4px rgba(34,197,94,0.2);">' + tier + '</div>'
            + '</div>'
            + '</div>';

        var div = document.createElement('div');
        // Use position:absolute at top:0 to stay in-viewport for html2canvas
        // but hidden via opacity and z-index.
        div.style.cssText = 'position:absolute;left:0;top:0;z-index:-1000;opacity:0.01;pointer-events:none;width:650px;';
        div.innerHTML = html;
        document.body.appendChild(div);

        setTimeout(function () {
            var opt = {
                margin:      [5, 5, 5, 5],
                filename:    'PFG-Assessment-Results.pdf',
                image:       { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
                jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(div).save().then(function () {
                document.body.removeChild(div);
                if (btn) { btn.disabled = false; btn.textContent = '\u2193 Download PDF Report'; }
            });
        }, 400);
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
