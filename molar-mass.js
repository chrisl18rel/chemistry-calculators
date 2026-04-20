// molar-mass.js

const MolarMass = (() => {

  function init() {
    const input = document.getElementById('mm-formula');
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') calculate(); });
    ['mm-show-breakdown','mm-show-percent'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => {
        const f = document.getElementById('mm-formula');
        if (f && f.value.trim()) calculate();
      });
    });
  }

  // Detect arrow or lone = sign (not => or ==) indicating a full reaction
  function isReaction(s) {
    return /🡪|➜|➝|⟶|→|->|-->/.test(s) || /(?<![=!<>])=(?!=)/.test(s);
  }

  // Extract individual compound tokens from a reaction string
  function extractCompounds(raw) {
    const s = raw
      .replace(/🡪|➜|➝|⟶|→/g, '+')
      .replace(/-->|->|=>|(?<![=!<>])=(?!=)/g, '+')
      .replace(/\(\s*(?:s|l|g|aq)\s*\)/gi, '') // strip state symbols
      .replace(/[_\s]+/g, ' ');
    // Split on + respecting parens
    const parts = [];
    let depth = 0, cur = '';
    for (const ch of s) {
      if (ch === '(') { depth++; cur += ch; }
      else if (ch === ')') { cur += ch; if (depth > 0) depth--; }
      else if (ch === '+' && depth === 0) { parts.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    parts.push(cur.trim());
    // Clean each token: strip leading coefficient and whitespace
    return parts
      .map(p => p.replace(/^\d+\s*/, '').trim())
      .filter(p => p.length > 0);
  }

  function calculate() {
    const formulaEl = document.getElementById('mm-formula');
    if (!formulaEl) return;
    const raw = formulaEl.value.trim();
    if (!raw) { showAlert('Please enter a chemical formula.', true); return; }

    const subMap = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
    const normalized = raw.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, c => subMap[c] || c);

    const showBreakdown = document.getElementById('mm-show-breakdown')?.checked !== false;
    const showPercent   = document.getElementById('mm-show-percent')?.checked !== false;

    if (isReaction(normalized)) {
      const compounds = extractCompounds(normalized);
      if (!compounds.length) {
        showAlert('Could not parse any compounds from the reaction.', true); return;
      }
      const results = [];
      for (const f of compounds) {
        try {
          const r = computeMolarMass(f);
          results.push({ formula: f, result: r, error: null });
        } catch(e) {
          results.push({ formula: f, result: null, error: e.message });
        }
      }
      renderReactionResults(raw, results, showBreakdown, showPercent);
    } else {
      let result;
      try {
        result = computeMolarMass(normalized);
      } catch(e) {
        showAlert('Error: ' + e.message, true);
        document.getElementById('mm-results').innerHTML =
          `<div class="placeholder-msg" style="color:#e74c3c;">⚠ ${e.message}</div>`;
        return;
      }
      renderResults(raw, result, showBreakdown, showPercent);
    }
  }

  function renderReactionResults(raw, results, showBreakdown, showPercent) {
    let html = `<h2>⚛️ Molar Masses: Reaction Compounds</h2>`;
    html += `<div class="mini-note" style="margin-bottom:16px;color:#1a56a8;">
      Showing molar mass breakdown for each compound in the reaction.
    </div>`;

    for (const { formula, result, error } of results) {
      html += `<div style="border:1px solid #dde3f0;border-radius:8px;margin-bottom:18px;overflow:hidden;">`;
      html += `<div style="background:#f0f6ff;padding:10px 14px;border-bottom:1px solid #dde3f0;font-weight:700;font-size:15px;">
        ${formulaToHTML(formula)}
      </div>`;
      if (error) {
        html += `<div style="padding:12px 14px;color:#e74c3c;">⚠ ${error}</div>`;
      } else {
        const { mass, breakdown } = result;
        html += `<div style="padding:12px 14px;">`;
        html += `<div class="answer-box" style="margin-bottom:${showBreakdown ? 12 : 0}px;">
          <span class="answer-label">Molar Mass</span>
          <span class="answer-value">${mass.toFixed(4)}</span>
          <span class="answer-unit">g/mol</span>
        </div>`;
        if (showBreakdown) {
          html += `<table class="result-table" style="margin-top:8px;">
            <thead><tr>
              <th>Element</th><th>Count</th><th>Atomic Mass (g/mol)</th>
              <th>Contribution (g/mol)</th>
              ${showPercent ? '<th>% Composition</th>' : ''}
            </tr></thead><tbody>`;
          for (const row of breakdown) {
            const pct = (row.contribution / mass * 100).toFixed(2);
            const amDisplay = parseFloat(row.atomicMass.toFixed(5)).toString();
            html += `<tr>
              <td><strong>${row.element}</strong></td>
              <td class="num">${row.count}</td>
              <td class="num">${amDisplay}</td>
              <td class="num">${row.contribution.toFixed(4)}</td>
              ${showPercent ? `<td><span class="result-badge blue">${pct}%</span></td>` : ''}
            </tr>`;
          }
          html += `<tr class="total-row">
            <td colspan="3"><strong>Total Molar Mass</strong></td>
            <td class="num">${mass.toFixed(4)}</td>
            ${showPercent ? '<td><span class="result-badge green">100.00%</span></td>' : ''}
          </tr></tbody></table>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }
    document.getElementById('mm-results').innerHTML = html;
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
        // Display atomic mass with enough decimal places to show full precision
        // e.g. 1.00794 stays 1.00794, not 1.0079
        const amDisplay = parseFloat(row.atomicMass.toFixed(5)).toString();
        html += `<tr>
          <td><strong>${row.element}</strong></td>
          <td class="num">${row.count}</td>
          <td class="num">${amDisplay}</td>
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
