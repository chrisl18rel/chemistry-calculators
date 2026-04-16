// percent-composition.js

const PercentComposition = (() => {

  function init() {
    fetch('percent-composition.html')
      .then(r => r.text())
      .then(html => {
        loadTemplate('percent-composition-container', html);
        const inp = document.getElementById('pc-formula');
        if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') calculate(); });
      })
      .catch(() => {});
  }

  function calculate() {
    const el = document.getElementById('pc-formula');
    if (!el) return;
    const raw = el.value.trim();
    if (!raw) { showAlert('Please enter a chemical formula.', true); return; }

    let result;
    try { result = computeMolarMass(raw); }
    catch(e) {
      showAlert('Error: ' + e.message, true);
      document.getElementById('pc-results').innerHTML =
        `<div class="placeholder-msg" style="color:#e74c3c;">⚠ ${e.message}</div>`;
      return;
    }

    const { mass, breakdown } = result;
    let html = `<h2>📊 Percent Composition: ${formulaToHTML(raw)}</h2>`;

    html += `<div class="answer-box">
      <span class="answer-label">Molar Mass</span>
      <span class="answer-value">${mass.toFixed(4)}</span>
      <span class="answer-unit">g/mol</span>
    </div>`;

    html += `<div class="results-section-title">Composition by Element</div>`;
    html += `<table class="result-table">
      <thead><tr>
        <th>Element</th>
        <th>Atoms</th>
        <th>Atomic Mass (g/mol)</th>
        <th>Mass Contribution (g/mol)</th>
        <th>% by Mass</th>
      </tr></thead><tbody>`;

    let totalPct = 0;
    for (const row of breakdown) {
      const pct = (row.contribution / mass * 100);
      totalPct += pct;
      html += `<tr>
        <td><strong>${row.element}</strong></td>
        <td class="num">${row.count}</td>
        <td class="num">${row.atomicMass.toFixed(4)}</td>
        <td class="num">${row.contribution.toFixed(4)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="result-badge blue">${pct.toFixed(2)}%</span>
            <div style="flex:1;height:8px;background:#e0e8f5;border-radius:4px;min-width:60px;">
              <div style="width:${Math.min(pct,100).toFixed(1)}%;height:100%;background:#4a90e2;border-radius:4px;"></div>
            </div>
          </div>
        </td>
      </tr>`;
    }

    html += `<tr class="total-row">
      <td colspan="4"><strong>Total</strong></td>
      <td><span class="result-badge green">${totalPct.toFixed(2)}%</span></td>
    </tr></tbody></table>`;

    // Visual summary
    if (breakdown.length >= 2 && breakdown.length <= 8) {
      const COLORS = ['#4a90e2','#e94560','#4caf50','#ffc107','#ab47bc','#26a69a','#ff7043','#78909c'];
      html += `<div class="results-section-title">Visual Breakdown</div>`;
      html += `<div style="display:flex;height:28px;border-radius:6px;overflow:hidden;margin-top:6px;">`;
      breakdown.forEach((row, i) => {
        const pct = (row.contribution / mass * 100);
        html += `<div style="width:${pct.toFixed(2)}%;background:${COLORS[i%COLORS.length]};display:flex;align-items:center;justify-content:center;" title="${row.element}: ${pct.toFixed(2)}%">
          ${pct > 6 ? `<span style="color:#fff;font-size:10px;font-weight:700;white-space:nowrap;">${row.element}</span>` : ''}
        </div>`;
      });
      html += `</div>`;
      // Legend
      html += `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">`;
      breakdown.forEach((row, i) => {
        const pct = (row.contribution / mass * 100);
        html += `<div style="display:flex;align-items:center;gap:4px;">
          <div style="width:12px;height:12px;border-radius:2px;background:${COLORS[i%COLORS.length]};flex-shrink:0;"></div>
          <span style="font-size:11px;color:#444;">${row.element} ${pct.toFixed(1)}%</span>
        </div>`;
      });
      html += `</div>`;
    }

    document.getElementById('pc-results').innerHTML = html;
  }

  function clear() {
    const el = document.getElementById('pc-formula');
    if (el) { el.value = ''; el.focus(); }
    document.getElementById('pc-results').innerHTML =
      '<div class="placeholder-msg">📊 Enter a chemical formula and click <strong>Calculate % Composition</strong>.</div>';
  }

  function loadExample(formula) {
    const el = document.getElementById('pc-formula');
    if (el) { el.value = formula; calculate(); }
  }

  return { init, calculate, clear, loadExample };
})();

window.addEventListener('load', () => PercentComposition.init());
