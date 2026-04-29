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

        // Extract chart as image (works on the REAL rendered canvas)
        var chartImg = '';
        if (pfgChart) {
            try { chartImg = pfgChart.toBase64Image(); } catch(e) {}
        }

        // Build CSF score rows
        var scoreHtml = '';
        CSF_KEYS.forEach(function(k, i) {
            var el = document.getElementById('val-' + k);
            var val = el ? el.textContent : '–';
            scoreHtml += '<tr>'
                + '<td style="padding:4px 10px;font-size:11px;border-bottom:1px solid #f1f5f9;">' + CSF_LABELS[i] + '</td>'
                + '<td style="padding:4px 10px;font-size:11px;font-weight:600;text-align:center;border-bottom:1px solid #f1f5f9;">' + val + ' / 10</td>'
                + '</tr>';
        });

        var html = '<div style="font-family:Arial,sans-serif;color:#1a1a2e;padding:24px;background:#fff;width:680px;box-sizing:border-box;">'
            + '<div style="text-align:center;border-bottom:2px solid #f1f5f9;padding-bottom:12px;margin-bottom:16px;">'
            + '<div style="font-size:24px;font-weight:700;letter-spacing:4px;">GLO</div>'
            + '<div style="font-size:15px;font-weight:700;">PFG Predictive Index</div>'
            + '<div style="font-size:11px;color:#64748b;">Assessment Report</div>'
            + '</div>'
            + '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;background:#f8fafc;">'
            + '<tr><td style="padding:6px 10px;font-size:10px;color:#64748b;width:100px;">Name</td><td style="padding:6px 10px;font-weight:600;font-size:11px;">' + name + '</td></tr>'
            + '<tr><td style="padding:6px 10px;font-size:10px;color:#64748b;">Company</td><td style="padding:6px 10px;font-weight:600;font-size:11px;">' + company + '</td></tr>'
            + '<tr><td style="padding:6px 10px;font-size:10px;color:#64748b;">Department</td><td style="padding:6px 10px;font-weight:600;font-size:11px;">' + dept + '</td></tr>'
            + (email ? '<tr><td style="padding:6px 10px;font-size:10px;color:#64748b;">Email</td><td style="padding:6px 10px;font-weight:600;font-size:11px;">' + email + '</td></tr>' : '')
            + '</table>'
            + '<div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:16px;">'
            + '<div style="flex:1;"><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#64748b;margin-bottom:6px;">CSF Scores</div>'
            + '<table style="width:100%;border-collapse:collapse;">' + scoreHtml + '</table></div>'
            + (chartImg ? '<div style="flex-shrink:0;"><img src="' + chartImg + '" width="220" height="220" style="display:block;"/></div>' : '')
            + '</div>'
            + '<div style="text-align:center;padding:14px;background:#f0fdf4;border-radius:10px;">'
            + '<div style="font-size:40px;font-weight:700;">' + total + '</div>'
            + '<div style="font-size:10px;color:#94a3b8;margin-bottom:6px;">/ 100</div>'
            + '<div style="display:inline-block;padding:4px 18px;border-radius:999px;background:#22C55E;color:#fff;font-weight:600;font-size:11px;">' + tier + '</div>'
            + '</div>'
            + '</div>';

        var div = document.createElement('div');
        div.style.cssText = 'position:absolute;left:-9999px;top:0;';
        div.innerHTML = html;
        document.body.appendChild(div);

        setTimeout(function () {
            html2pdf().set({
                margin:      [5, 5, 5, 5],
                filename:    'PFG-Assessment-Results.pdf',
                image:       { type: 'jpeg', quality: 0.97 },
                html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: 680 },
                jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).from(div.firstChild).save().then(function () {
                document.body.removeChild(div);
                if (btn) { btn.disabled = false; btn.textContent = '\u2193 Download PDF Report'; }
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
