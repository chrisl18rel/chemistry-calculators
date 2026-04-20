// stoichiometry.js

const Stoichiometry = (() => {
  const AVOGADRO = 6.02214076e23;
  const MOLAR_VOL_STP = 22.414;

  // State after balancing
  let balanced = null; // { reactants:[{formula,coeff}], products:[{formula,coeff}], allCompounds:[...] }

  // ── INIT ──
  function init() {
    const ta = document.getElementById('stoi-eq-input');
    if (ta) ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.shiftKey)) { e.preventDefault(); balanceStep(); }
    });
  }

  // ── PARSE EQUATION STRING (reuse same logic as equation balancer) ──
  function parseEquationString(raw) {
    if (!raw || !raw.trim()) throw new Error('Please enter an equation.');
    let s = raw
      .replace(/🡪|➜|➝|⟶|→|→/g, '→')
      .replace(/--?>|=>/g, '→')
      .replace(/(?<![→])==(?![→])/g, '→'); // lone = sign

    const arrowCount = (s.match(/→/g) || []).length;
    if (arrowCount === 0) throw new Error('No arrow found. Use → or -> to separate reactants from products.');
    if (arrowCount > 1)  throw new Error('Multiple arrows found. Enter one equation at a time.');

    const [leftSide, rightSide] = s.split('→');
    const reactants = parseSide(leftSide);
    const products  = parseSide(rightSide);
    if (!reactants.length) throw new Error('No reactants found.');
    if (!products.length)  throw new Error('No products found.');
    return { reactants, products };
  }

  function parseSide(side) {
    return splitOnPlus(side).map(cleanToken).filter(Boolean);
  }

  function splitOnPlus(str) {
    const parts = []; let depth = 0, cur = '';
    for (const ch of str) {
      if (ch === '(') { depth++; cur += ch; }
      else if (ch === ')') { cur += ch; if (depth > 0) depth--; }
      else if (ch === '+' && depth === 0) { parts.push(cur); cur = ''; }
      else cur += ch;
    }
    parts.push(cur);
    return parts;
  }

  function cleanToken(raw) {
    let s = raw.trim();
    if (!s) return null;
    s = s.replace(/_{1,}/g, ' ').trim();
    s = s.replace(/\(\s*(?:s|l|g|aq)\s*\)\s*$/gi, '').trim();
    s = s.replace(/^\d+(?=[A-Z(])/, '').trim();
    s = s.replace(/\s+/g, '');
    return s || null;
  }

  // ── STEP 1: BALANCE ──
  function balanceStep() {
    const ta = document.getElementById('stoi-eq-input');
    if (!ta) return;
    const raw = ta.value.trim();

    let parsed;
    try { parsed = parseEquationString(raw); }
    catch(e) { showAlert(e.message, true); return; }

    let coeffs;
    try { coeffs = balanceEquation(parsed.reactants, parsed.products); }
    catch(e) { showAlert('Could not balance: ' + e.message, true); return; }

    const rCoeffs = coeffs.slice(0, parsed.reactants.length);
    const pCoeffs = coeffs.slice(parsed.reactants.length);

    const allCompounds = [
      ...parsed.reactants.map((f, i) => ({ formula: f, coeff: rCoeffs[i], role: 'reactant' })),
      ...parsed.products.map((f, i)  => ({ formula: f, coeff: pCoeffs[i], role: 'product'  })),
    ];

    // Compute molar masses
    allCompounds.forEach(c => {
      try { c.molarMass = computeMolarMass(c.formula).mass; }
      catch(e) { c.molarMass = null; }
    });

    balanced = {
      reactants: allCompounds.filter(c => c.role === 'reactant'),
      products:  allCompounds.filter(c => c.role === 'product'),
      allCompounds,
    };

    // Display balanced equation
    const rStr = balanced.reactants.map(c => (c.coeff > 1 ? c.coeff : '') + formulaToHTML(c.formula)).join(' + ');
    const pStr = balanced.products.map(c  => (c.coeff > 1 ? c.coeff : '') + formulaToHTML(c.formula)).join(' + ');
    const eqEl = document.getElementById('stoi-balanced-eq');
    if (eqEl) eqEl.innerHTML = rStr + ' → ' + pStr;

    const dispEl = document.getElementById('stoi-balanced-display');
    if (dispEl) dispEl.style.display = '';

    // Show mode section
    const modeEl = document.getElementById('stoi-mode-section');
    if (modeEl) modeEl.style.display = '';

    // Apply current mode
    onModeToggle();
  }

  // ── MODE TOGGLE ──
  function onModeToggle() {
    if (!balanced) return;
    const isLimiting = document.getElementById('stoi-mode-chk')?.checked;

    const stdLbl = document.getElementById('stoi-label-standard');
    const limLbl = document.getElementById('stoi-label-limiting');
    if (stdLbl) stdLbl.style.fontWeight = isLimiting ? '400' : '700';
    if (limLbl) limLbl.style.fontWeight = isLimiting ? '700' : '400';

    const stdEl = document.getElementById('stoi-standard-section');
    const limEl = document.getElementById('stoi-limiting-section');
    const resEl = document.getElementById('stoi-results-section');
    if (stdEl) stdEl.style.display = isLimiting ? 'none' : '';
    if (limEl) limEl.style.display = isLimiting ? '' : 'none';
    if (resEl) resEl.style.display = 'none';

    if (!isLimiting) buildStandardInputs();
    else             buildLimitingInputs();
  }

  // ── STANDARD INPUTS ──
  function buildStandardInputs() {
    const sel = document.getElementById('stoi-given-sel');
    if (!sel || !balanced) return;
    sel.innerHTML = '';
    balanced.allCompounds.forEach((c, i) => {
      const o = document.createElement('option');
      o.value = i;
      o.textContent = `${c.formula} (${c.role === 'reactant' ? 'Reactant' : 'Product'})`;
      sel.appendChild(o);
    });
  }

  // ── LIMITING INPUTS ──
  function buildLimitingInputs() {
    const container = document.getElementById('stoi-limit-inputs-container');
    if (!container || !balanced) return;
    container.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'result-table';
    table.style.marginBottom = '8px';
    table.innerHTML = `<thead><tr>
      <th>Reactant</th>
      <th>Coefficient</th>
      <th>Molar Mass (g/mol)</th>
      <th>Amount</th>
      <th>Unit</th>
    </tr></thead>`;
    const tbody = document.createElement('tbody');

    balanced.reactants.forEach((c, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono">${formulaToHTML(c.formula)}</td>
        <td class="num">${c.coeff}</td>
        <td class="num">${c.molarMass ? c.molarMass.toFixed(4) : '—'}</td>
        <td><input type="number" id="stoi-lim-amt-${i}" min="0" step="any"
              class="stoi-num-input" placeholder="0" style="width:100px;" /></td>
        <td>
          <select id="stoi-lim-unit-${i}" class="stoi-select" style="width:80px;">
            <option value="mol">mol</option>
            <option value="g">g</option>
            <option value="kg">kg</option>
          </select>
        </td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  // ── UNIT CONVERSION HELPERS ──
  function toMoles(amount, unit, molarMass) {
    if (unit === 'mol') return amount;
    if (unit === 'g')   return amount / molarMass;
    if (unit === 'kg')  return (amount * 1000) / molarMass;
    return amount;
  }
  function fmtVal(val, dp) { return val.toFixed(dp); }
  function round(val, dp)  { return parseFloat(val.toFixed(dp)); }

  // ── CALCULATE STANDARD ──
  function calculateStandard() {
    if (!balanced) { showAlert('Balance the equation first.', true); return; }
    const givenIdx = parseInt(document.getElementById('stoi-given-sel')?.value);
    const givenAmt = parseFloat(document.getElementById('stoi-given-amt')?.value);
    const givenUnit= document.querySelector('input[name="stoi-unit"]:checked')?.value || 'mol';
    const dp       = parseInt(document.getElementById('stoi-sig-figs')?.value) || 4;

    if (isNaN(givenAmt) || givenAmt < 0) { showAlert('Enter a valid amount.', true); return; }

    const given = balanced.allCompounds[givenIdx];
    if (!given) { showAlert('Select a given compound.', true); return; }
    if (!given.molarMass) { showAlert('Could not compute molar mass for ' + given.formula, true); return; }

    const givenMoles = toMoles(givenAmt, givenUnit, given.molarMass);

    // Calculate moles for all compounds
    const results = balanced.allCompounds.map(c => {
      const moles = givenMoles * (c.coeff / given.coeff);
      const grams = moles * (c.molarMass || 0);
      const kg    = grams / 1000;
      return { ...c, moles, grams, kg, isGiven: c === given };
    });

    renderStandardResults(results, given, givenAmt, givenUnit, dp);
  }

  function renderStandardResults(results, given, givenAmt, givenUnit, dp) {
    const rSection = document.getElementById('stoi-results-section');
    const rContent = document.getElementById('stoi-results-content');
    if (!rSection || !rContent) return;

    const reactants = results.filter(c => c.role === 'reactant');
    const products  = results.filter(c => c.role === 'product');

    let html = `<div class="stoi-results-title">Stoichiometry Calculation Results</div>`;

    // Balanced eq reminder
    const rStr = balanced.reactants.map(c => (c.coeff>1?c.coeff:'') + formulaToHTML(c.formula)).join(' + ');
    const pStr = balanced.products.map(c  => (c.coeff>1?c.coeff:'') + formulaToHTML(c.formula)).join(' + ');
    html += `<div class="stoi-balanced-eq" style="margin-bottom:16px;">${rStr} → ${pStr}</div>`;

    // Results table
    html += buildResultsTable(results, dp);

    // Step-by-step
    html += `<div class="stoi-steps-box" id="stoi-steps-exportable">`;
    html += `<div class="stoi-steps-title">Step-by-Step Solution</div>`;

    const unitLabel = givenUnit === 'mol' ? 'mol' : givenUnit === 'g' ? 'g' : 'kg';
    html += `<div class="stoi-step"><strong>Step 1:</strong> Given: ${fmtVal(givenAmt, dp)} ${unitLabel} of ${formulaToHTML(given.formula)}</div>`;

    // Convert to moles if needed
    if (givenUnit !== 'mol') {
      const givenMoles = toMoles(givenAmt, givenUnit, given.molarMass);
      html += `<div class="stoi-step"><strong>Step 2:</strong> Convert to moles:<br>
        &nbsp;&nbsp;${formulaToHTML(given.formula)}: ${fmtVal(givenAmt,dp)} ${givenUnit} ÷ ${fmtVal(given.molarMass,4)} g/mol = ${fmtVal(givenMoles,dp)} mol</div>`;
    }

    const stepNum = givenUnit !== 'mol' ? 3 : 2;
    html += `<div class="stoi-step"><strong>Step ${stepNum}:</strong> Use balanced equation coefficients to find amounts of all other compounds:</div>`;

    results.filter(c => c !== given).forEach(c => {
      html += `<div class="stoi-step-sub">
        ${formulaToHTML(c.formula)}: ${fmtVal(results.find(r=>r===given).moles,dp)} mol ${formulaToHTML(given.formula)}
        × (${c.coeff} mol ${formulaToHTML(c.formula)} / ${given.coeff} mol ${formulaToHTML(given.formula)})
        = ${fmtVal(c.moles,dp)} mol ${formulaToHTML(c.formula)} (${fmtVal(c.grams,dp)} g)
      </div>`;
    });

    html += `</div>`; // close stoi-steps-box
    rContent.innerHTML = html;
    rSection.style.display = '';
  }

  // ── CALCULATE LIMITING ──
  function calculateLimiting() {
    if (!balanced) { showAlert('Balance the equation first.', true); return; }
    const dp = parseInt(document.getElementById('stoi-limit-sig-figs')?.value) || 4;

    const reactantData = balanced.reactants.map((c, i) => {
      const amt  = parseFloat(document.getElementById(`stoi-lim-amt-${i}`)?.value);
      const unit = document.getElementById(`stoi-lim-unit-${i}`)?.value || 'mol';
      if (isNaN(amt) || amt < 0) throw new Error(`Enter a valid amount for ${c.formula}`);
      const moles = toMoles(amt, unit, c.molarMass);
      return { ...c, inputAmt: amt, inputUnit: unit, moles };
    });

    // Check all amounts present
    if (reactantData.some(r => isNaN(r.inputAmt))) {
      showAlert('Enter amounts for all reactants.', true); return;
    }

    // Find limiting reagent: normalize moles by coefficient
    const ratios = reactantData.map(r => r.moles / r.coeff);
    const minRatio = Math.min(...ratios);
    const limitingIdx = ratios.indexOf(minRatio);

    // Calculate consumed, leftover, and products
    const reactantResults = reactantData.map((r, i) => {
      const consumed = minRatio * r.coeff;
      const leftover = r.moles - consumed;
      return {
        ...r,
        consumed,
        leftover: Math.max(0, leftover),
        isLimiting: i === limitingIdx,
      };
    });

    const productResults = balanced.products.map(p => {
      const moles = minRatio * p.coeff;
      const grams = moles * (p.molarMass || 0);
      const kg    = grams / 1000;
      return { ...p, moles, grams, kg };
    });

    renderLimitingResults(reactantResults, productResults, dp);
  }

  function renderLimitingResults(reactants, products, dp) {
    const rSection = document.getElementById('stoi-results-section');
    const rContent = document.getElementById('stoi-results-content');
    if (!rSection || !rContent) return;

    const limiting = reactants.find(r => r.isLimiting);
    let html = `<div class="stoi-results-title">Limiting Reactant: <span class="stoi-limiting-name">${formulaToHTML(limiting.formula)}</span></div>`;

    // Balanced eq reminder
    const rStr = balanced.reactants.map(c => (c.coeff>1?c.coeff:'') + formulaToHTML(c.formula)).join(' + ');
    const pStr = balanced.products.map(c  => (c.coeff>1?c.coeff:'') + formulaToHTML(c.formula)).join(' + ');
    html += `<div class="stoi-balanced-eq" style="margin-bottom:16px;">${rStr} → ${pStr}</div>`;

    // Reactants table
    html += `<div class="stoi-table-section-label">Reagents</div>`;
    html += `<table class="result-table stoi-result-table">
      <thead><tr>
        <th>Compound</th><th>Coefficient</th><th>Molar Mass (g/mol)</th>
        <th>Given</th><th>Used</th><th>Left Over</th>
      </tr></thead><tbody>`;

    reactants.forEach(r => {
      const givenG  = r.moles * r.molarMass;
      const givenKg = givenG / 1000;
      const usedG   = r.consumed * r.molarMass;
      const usedKg  = usedG / 1000;
      const leftG   = r.leftover * r.molarMass;
      const leftKg  = leftG / 1000;
      const rowClass = r.isLimiting ? 'stoi-limiting-row' : '';
      html += `<tr class="${rowClass}">
        <td class="mono">${formulaToHTML(r.formula)}${r.isLimiting ? ' <span class="result-badge red" style="font-size:9px;">Limiting</span>' : ''}</td>
        <td class="num">${r.coeff}</td>
        <td class="num">${r.molarMass ? r.molarMass.toFixed(4) : '—'}</td>
        <td>${fmtVal(r.moles,dp)} mol<br>${fmtVal(givenG,dp)} g<br>${fmtVal(givenKg,dp)} kg</td>
        <td>${fmtVal(r.consumed,dp)} mol<br>${fmtVal(usedG,dp)} g<br>${fmtVal(usedKg,dp)} kg</td>
        <td>${fmtVal(r.leftover,dp)} mol<br>${fmtVal(leftG,dp)} g<br>${fmtVal(leftKg,dp)} kg</td>
      </tr>`;
    });
    html += `</tbody></table>`;

    // Products table
    html += `<div class="stoi-table-section-label" style="margin-top:14px;">Products</div>`;
    html += `<table class="result-table stoi-result-table">
      <thead><tr>
        <th>Compound</th><th>Coefficient</th><th>Molar Mass (g/mol)</th><th>Produced</th>
      </tr></thead><tbody>`;
    products.forEach(p => {
      html += `<tr>
        <td class="mono">${formulaToHTML(p.formula)}</td>
        <td class="num">${p.coeff}</td>
        <td class="num">${p.molarMass ? p.molarMass.toFixed(4) : '—'}</td>
        <td>${fmtVal(p.moles,dp)} mol<br>${fmtVal(p.grams,dp)} g<br>${fmtVal(p.kg,dp)} kg</td>
      </tr>`;
    });
    html += `</tbody></table>`;

    // Step-by-step
    html += `<div class="stoi-steps-box" id="stoi-steps-exportable">`;
    html += `<div class="stoi-steps-title">Step-by-Step Solution</div>`;

    html += `<div class="stoi-step"><strong>Step 1: Convert all reactant amounts to moles</strong></div>`;
    reactants.forEach(r => {
      if (r.inputUnit !== 'mol') {
        html += `<div class="stoi-step-sub">${formulaToHTML(r.formula)}: ${fmtVal(r.inputAmt,dp)} ${r.inputUnit}
          ÷ ${fmtVal(r.molarMass,4)} g/mol${r.inputUnit==='kg'?' × 1000':''} = ${fmtVal(r.moles,dp)} mol</div>`;
      } else {
        html += `<div class="stoi-step-sub">${formulaToHTML(r.formula)}: ${fmtVal(r.moles,dp)} mol (given)</div>`;
      }
    });

    html += `<div class="stoi-step"><strong>Step 2: Calculate theoretical yield ratios (moles ÷ coefficient)</strong></div>`;
    reactants.forEach(r => {
      const ratio = r.moles / r.coeff;
      html += `<div class="stoi-step-sub">${formulaToHTML(r.formula)}: ${fmtVal(r.moles,dp)} mol ÷ ${r.coeff} = ${fmtVal(ratio,dp)}</div>`;
    });

    const ratioVals = reactants.map(r => round(r.moles / r.coeff, dp));
    const minRatio  = Math.min(...ratioVals);
    html += `<div class="stoi-step"><strong>Step 3: Identify limiting reactant</strong><br>
      The smallest ratio is ${fmtVal(minRatio,dp)}, so <strong>${formulaToHTML(limiting.formula)}</strong> is the limiting reactant.</div>`;

    html += `<div class="stoi-step"><strong>Step 4: Calculate amounts consumed and products formed</strong></div>`;
    reactants.forEach(r => {
      const usedG = r.consumed * r.molarMass;
      const leftG = r.leftover * r.molarMass;
      html += `<div class="stoi-step-sub">${formulaToHTML(r.formula)} consumed: ${fmtVal(r.consumed,dp)} mol (${fmtVal(usedG,dp)} g)</div>`;
      html += `<div class="stoi-step-sub">${formulaToHTML(r.formula)} remaining: ${fmtVal(r.leftover,dp)} mol (${fmtVal(leftG,dp)} g)</div>`;
    });
    products.forEach(p => {
      html += `<div class="stoi-step-sub">${formulaToHTML(p.formula)} produced: ${fmtVal(p.moles,dp)} mol (${fmtVal(p.grams,dp)} g)</div>`;
    });

    html += `</div>`; // close steps-box
    rContent.innerHTML = html;
    rSection.style.display = '';
  }

  // ── STANDARD RESULTS TABLE ──
  function buildResultsTable(results, dp) {
    const reactants = results.filter(c => c.role === 'reactant');
    const products  = results.filter(c => c.role === 'product');

    let html = `<table class="result-table stoi-result-table">
      <thead><tr>
        <th>Compound</th><th>Coefficient</th><th>Molar Mass (g/mol)</th>
        <th>Moles</th><th>Grams (g)</th><th>Kilograms (kg)</th>
      </tr></thead><tbody>`;

    html += `<tr><td colspan="6" class="stoi-table-subheader">Reactants</td></tr>`;
    reactants.forEach(c => {
      html += `<tr${c.isGiven ? ' class="stoi-given-row"' : ''}>
        <td class="mono">${formulaToHTML(c.formula)}${c.isGiven ? ' <span class="result-badge green" style="font-size:9px;">Given</span>' : ''}</td>
        <td class="num">${c.coeff}</td>
        <td class="num">${c.molarMass ? c.molarMass.toFixed(4) : '—'}</td>
        <td class="num">${fmtVal(c.moles,dp)}</td>
        <td class="num">${fmtVal(c.grams,dp)}</td>
        <td class="num">${fmtVal(c.kg,dp)}</td>
      </tr>`;
    });

    html += `<tr><td colspan="6" class="stoi-table-subheader">Products</td></tr>`;
    products.forEach(c => {
      html += `<tr${c.isGiven ? ' class="stoi-given-row"' : ''}>
        <td class="mono">${formulaToHTML(c.formula)}${c.isGiven ? ' <span class="result-badge green" style="font-size:9px;">Given</span>' : ''}</td>
        <td class="num">${c.coeff}</td>
        <td class="num">${c.molarMass ? c.molarMass.toFixed(4) : '—'}</td>
        <td class="num">${fmtVal(c.moles,dp)}</td>
        <td class="num">${fmtVal(c.grams,dp)}</td>
        <td class="num">${fmtVal(c.kg,dp)}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    return html;
  }

  // ── EXPORT PNG ──
  function exportPNG() {
    const el = document.getElementById('stoi-steps-exportable') ||
               document.getElementById('stoi-results-content');
    if (!el) { showAlert('No results to export.', true); return; }

    // Use html2canvas if available, otherwise fall back to canvas drawing
    if (typeof html2canvas !== 'undefined') {
      html2canvas(el, { backgroundColor: '#ffffff', scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'stoichiometry-results.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    } else {
      // Fallback: draw results to a canvas manually
      const canvas = document.createElement('canvas');
      const lines = el.innerText.split('\n').filter(l => l.trim());
      const lineH = 22, pad = 20, maxW = 700;
      canvas.width  = maxW;
      canvas.height = lines.length * lineH + pad * 2;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#111';
      ctx.font = '13px "Segoe UI", sans-serif';
      lines.forEach((line, i) => {
        ctx.fillText(line.trim(), pad, pad + (i + 1) * lineH);
      });
      const link = document.createElement('a');
      link.download = 'stoichiometry-results.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  }

  function clear() {
    balanced = null;
    const ta = document.getElementById('stoi-eq-input');
    if (ta) { ta.value = ''; }
    ['stoi-balanced-display','stoi-mode-section','stoi-standard-section',
     'stoi-limiting-section','stoi-results-section'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  return { init, balanceStep, onModeToggle, calculateStandard, calculateLimiting, exportPNG, clear };
})();

window.addEventListener('load', () => Stoichiometry.init());
