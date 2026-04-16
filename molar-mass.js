// molar-mass.js

const MolarMass = (() => {

  function init() {
    fetch('molar-mass.html')
      .then(r => r.text())
      .then(html => {
        loadTemplate('molar-mass-container', html);
        // Enter key triggers calculate
        const input = document.getElementById('mm-formula');
        if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') calculate(); });
        // Checkbox listeners
        ['mm-show-breakdown','mm-show-percent'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.addEventListener('change', () => {
            const f = document.getElementById('mm-formula');
            if (f && f.value.trim()) calculate();
          });
        });
      })
      .catch(() => {
        // Fallback if fetch not available (file:// protocol)
        loadTemplate('molar-mass-container', '<div style="padding:20px;color:var(--text-dim)">Load via a local server to use file includes.</div>');
      });
  }

  function calculate() {
    const formulaEl = document.getElementById('mm-formula');
    if (!formulaEl) return;
    const raw = formulaEl.value.trim();
    if (!raw) { showAlert('Please enter a chemical formula.', true); return; }

    // Normalize subscript digits
    const subMap = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
    const formula = raw.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, c => subMap[c] || c);

    let result;
    try {
      result = computeMolarMass(formula);
    } catch(e) {
      showAlert('Error: ' + e.message, true);
      document.getElementById('mm-results').innerHTML =
        `<div class="placeholder-msg" style="color:#e74c3c;">⚠ ${e.message}</div>`;
      return;
    }

    const showBreakdown = document.getElementById('mm-show-breakdown')?.checked !== false;
    const showPercent   = document.getElementById('mm-show-percent')?.checked !== false;

    renderResults(raw, result, showBreakdown, showPercent);
  }

  function renderResults(rawFormula, result, showBreakdown, showPercent) {
    const { mass, breakdown } = result;
    const displayFormula = formulaToHTML(rawFormula);

    let html = `<h2>⚛️ Molar Mass: ${displayFormula}</h2>`;

    // Answer box
    html += `
      <div class="answer-box">
        <span class="answer-label">Molar Mass</span>
        <span class="answer-value">${mass.toFixed(4)}</span>
        <span class="answer-unit">g/mol</span>
      </div>`;

    if (showBreakdown) {
      html += `<div class="results-section-title">Element Breakdown</div>`;
      html += `<table class="result-table">
        <thead><tr>
          <th>Element</th>
          <th>Count</th>
          <th>Atomic Mass (g/mol)</th>
          <th>Contribution (g/mol)</th>
          ${showPercent ? '<th>% Composition</th>' : ''}
        </tr></thead><tbody>`;

      for (const row of breakdown) {
        const pct = (row.contribution / mass * 100).toFixed(2);
        html += `<tr>
          <td><strong>${row.element}</strong></td>
          <td class="num">${row.count}</td>
          <td class="num">${row.atomicMass.toFixed(4)}</td>
          <td class="num">${row.contribution.toFixed(4)}</td>
          ${showPercent ? `<td><span class="result-badge blue">${pct}%</span></td>` : ''}
        </tr>`;
      }

      html += `<tr class="total-row">
        <td colspan="3"><strong>Total Molar Mass</strong></td>
        <td class="num">${mass.toFixed(4)}</td>
        ${showPercent ? '<td><span class="result-badge green">100.00%</span></td>' : ''}
      </tr></tbody></table>`;
    } else if (showPercent) {
      // Show percent-only table
      html += `<div class="results-section-title">Percent Composition</div>`;
      html += `<table class="result-table">
        <thead><tr><th>Element</th><th>% Composition</th></tr></thead><tbody>`;
      for (const row of breakdown) {
        const pct = (row.contribution / mass * 100).toFixed(2);
        html += `<tr><td><strong>${row.element}</strong></td><td><span class="result-badge blue">${pct}%</span></td></tr>`;
      }
      html += `</tbody></table>`;
    }

    // Empirical formula hint
    const elCount = breakdown.length;
    if (elCount >= 2 && elCount <= 5) {
      const counts = breakdown.map(r => r.count);
      const g = counts.reduce((a, b) => gcd(a, b), counts[0]);
      if (g > 1) {
        const empirical = breakdown.map(r => r.element + (r.count / g > 1 ? (r.count / g) : '')).join('');
        html += `<div class="mini-note" style="margin-top:12px;">
          💡 Empirical formula: <strong>${formulaToHTML(empirical)}</strong> (ratio simplified by ${g})
        </div>`;
      }
    }

    document.getElementById('mm-results').innerHTML = html;
  }

  function clear() {
    const el = document.getElementById('mm-formula');
    if (el) { el.value = ''; el.focus(); }
    document.getElementById('mm-results').innerHTML =
      '<div class="placeholder-msg">⚛️ Enter a chemical formula and click <strong>Calculate</strong> to see results.</div>';
  }

  function loadExample(formula) {
    const el = document.getElementById('mm-formula');
    if (el) { el.value = formula; calculate(); }
  }

  return { init, calculate, clear, loadExample };
})();

window.addEventListener('load', () => MolarMass.init());
