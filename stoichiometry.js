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
    const coeff = (n) => n === 1 ? '' : `<span style="color:#e94560;font-weight:700;">${n}</span> `;
    const rStr = balanced.reactants.map(c => coeff(c.coeff) + formulaToHTML(c.formula)).join(' + ');
    const pStr = balanced.products.map(c  => coeff(c.coeff) + formulaToHTML(c.formula)).join(' + ');
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
          <select id="stoi-lim-unit-${i}" class="stoi-select" style="width:80px;background:#fff;color:#111;border-color:#c8d5ee;">
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

    if (isNaN(givenAmt)) { showAlert('Enter a valid amount.', true); return; }
    if (isNaN(givenIdx)) { showAlert('Select a given compound.', true); return; }

    const given = balanced.allCompounds[givenIdx];
    if (!given) { showAlert('Select a given compound.', true); return; }
    if (!given.molarMass) { showAlert('Could not compute molar mass for ' + given.formula, true); return; }

    try {
      const givenMoles = toMoles(givenAmt, givenUnit, given.molarMass);
      const results = balanced.allCompounds.map(c => {
        const moles = givenMoles * (c.coeff / given.coeff);
        const grams = moles * (c.molarMass || 0);
        const kg    = grams / 1000;
        return { ...c, moles, grams, kg, isGiven: c === given };
      });
      renderStandardResults(results, given, givenAmt, givenUnit, dp);
    } catch(e) {
      showAlert('Calculation error: ' + e.message, true);
    }
  }

  function renderStandardResults(results, given, givenAmt, givenUnit, dp) {
    const rSection = document.getElementById('stoi-results-section');
    const rContent = document.getElementById('stoi-results-content');
    if (!rSection || !rContent) return;

    const reactants = results.filter(c => c.role === 'reactant');
    const products  = results.filter(c => c.role === 'product');

    let html = `<div class="stoi-results-title">Stoichiometry Calculation Results</div>`;

    // Balanced eq reminder
    const coeff = (n) => n === 1 ? '' : `<span style="color:#e94560;font-weight:700;">${n}</span> `;
    const rStr = balanced.reactants.map(c => coeff(c.coeff) + formulaToHTML(c.formula)).join(' + ');
    const pStr = balanced.products.map(c  => coeff(c.coeff) + formulaToHTML(c.formula)).join(' + ');
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
        ${formulaToHTML(c.formula)}: ${fmtVal(results.find(r=>r.isGiven).moles,dp)} mol ${formulaToHTML(given.formula)}
        × (${c.coeff} mol ${formulaToHTML(c.formula)} / ${given.coeff} mol ${formulaToHTML(given.formula)})
        = ${fmtVal(c.moles,dp)} mol ${formulaToHTML(c.formula)} (${fmtVal(c.grams,dp)} g)
      </div>`;
    });

    html += `</div>`; // close stoi-steps-box
    rContent.innerHTML = html;
    rSection.style.display = '';

    // Pass product theoretical yields to % yield section
    const productResults = results.filter(c => c.role === 'product');
    populatePyFromResults(productResults, dp);
  }
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
    const coeff = (n) => n === 1 ? '' : `<span style="color:#e94560;font-weight:700;">${n}</span> `;
    const rStr = balanced.reactants.map(c => coeff(c.coeff) + formulaToHTML(c.formula)).join(' + ');
    const pStr = balanced.products.map(c  => coeff(c.coeff) + formulaToHTML(c.formula)).join(' + ');
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

    // Pass product theoretical yields to % yield section
    populatePyFromResults(productResults, dp);
  }
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

  // ── PERCENT YIELD (integrated) ──
  let pyMode = 'yield';
  let pyProducts = []; // theoretical yields from stoichiometry

  // Called after standard or limiting calculation with the product results array
  function populatePyFromResults(products, dp) {
    pyProducts = products.map(p => ({
      formula: p.formula,
      moles: p.moles,
      grams: p.grams,
      kg: p.kg,
      molarMass: p.molarMass,
    }));
    // Show the from-stoichiometry UI
    _pyShowMode('stoi');
    // Build product table
    _pyBuildProductTable(dp);
  }

  function _pyShowMode(mode) {
    const fromEl   = document.getElementById('py-from-stoi');
    const manualEl = document.getElementById('py-manual');
    const phEl     = document.getElementById('py-placeholder');
    if (fromEl)   fromEl.style.display   = mode === 'stoi'   ? '' : 'none';
    if (manualEl) manualEl.style.display = mode === 'manual' ? '' : 'none';
    if (phEl)     phEl.style.display     = mode === 'placeholder' ? '' : 'none';
  }

  function _pyBuildProductTable(dp) {
    const container = document.getElementById('py-product-table');
    if (!container) return;

    let html = `<table class="result-table stoi-result-table">
      <thead><tr>
        <th>Product</th>
        <th>Theoretical Yield (mol)</th>
        <th>Theoretical Yield (g)</th>
        <th>Theoretical Yield (kg)</th>
        <th>Actual Yield</th>
        <th>Unit</th>
      </tr></thead><tbody>`;

    pyProducts.forEach((p, i) => {
      html += `<tr>
        <td class="mono">${formulaToHTML(p.formula)}</td>
        <td class="num">${p.moles.toFixed(dp || 4)}</td>
        <td class="num">${p.grams.toFixed(dp || 4)}</td>
        <td class="num">${p.kg.toFixed(dp || 4)}</td>
        <td><input type="number" id="py-actual-${i}" min="0" step="any" placeholder="0"
              class="stoi-num-input" style="width:100px;" /></td>
        <td>
          <select id="py-actual-unit-${i}" class="stoi-select" style="width:70px;min-width:70px;background:#fff;color:#111;border-color:#c8d5ee;">
            <option value="g">g</option>
            <option value="kg">kg</option>
            <option value="mol">mol</option>
          </select>
        </td>
      </tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  function pyCalcFromStoi() {
    const resEl = document.getElementById('py-stoi-results');
    if (!resEl || !pyProducts.length) return;

    let html = `<div style="font-size:13px;font-weight:700;color:#1a2a4a;margin-bottom:10px;">% Yield Results</div>`;
    html += `<table class="result-table stoi-result-table">
      <thead><tr>
        <th>Product</th>
        <th>Theoretical Yield</th>
        <th>Actual Yield (entered)</th>
        <th>% Yield</th>
      </tr></thead><tbody>`;

    let anyResult = false;
    pyProducts.forEach((p, i) => {
      const actualRaw = parseFloat(document.getElementById(`py-actual-${i}`)?.value);
      if (isNaN(actualRaw)) {
        html += `<tr><td class="mono">${formulaToHTML(p.formula)}</td><td colspan="3" style="color:#aaa;">No actual yield entered</td></tr>`;
        return;
      }
      anyResult = true;
      const unit = document.getElementById(`py-actual-unit-${i}`)?.value || 'g';
      // Convert actual to grams for comparison
      let actualG;
      if (unit === 'g')   actualG = actualRaw;
      else if (unit === 'kg') actualG = actualRaw * 1000;
      else if (unit === 'mol') actualG = actualRaw * (p.molarMass || 1);

      const pct = p.grams > 0 ? (actualG / p.grams) * 100 : 0;
      const yieldClass = pct >= 90 ? 'green' : pct >= 75 ? 'blue' : pct >= 50 ? 'yellow' : 'red';
      const yieldLabel = pct >= 90 ? 'Excellent' : pct >= 75 ? 'Good' : pct >= 50 ? 'Moderate' : 'Low';
      const barColor   = pct >= 90 ? '#4caf50' : pct >= 75 ? '#4a90e2' : pct >= 50 ? '#ffc107' : '#ef5350';

      html += `<tr>
        <td class="mono">${formulaToHTML(p.formula)}</td>
        <td class="num">${p.grams.toFixed(4)} g<br>${p.moles.toFixed(4)} mol</td>
        <td class="num">${actualRaw.toFixed(4)} ${unit} (= ${actualG.toFixed(4)} g)</td>
        <td>
          <span class="result-badge ${yieldClass}" style="font-size:13px;padding:4px 10px;">${pct.toFixed(2)}%</span>
          <span style="font-size:11px;color:#666;margin-left:4px;">${yieldLabel}</span>
          <div style="height:8px;background:#e0e8f5;border-radius:4px;margin-top:4px;overflow:hidden;">
            <div style="width:${Math.min(pct,100).toFixed(1)}%;height:100%;background:${barColor};border-radius:4px;"></div>
          </div>
        </td>
      </tr>`;
    });
    html += `</tbody></table>`;

    if (!anyResult) { showAlert('Enter at least one actual yield.', true); return; }
    resEl.innerHTML = html;
  }

  function pySetManual() {
    _pyShowMode('manual');
    pyBuildFields();
  }

  function pySetMode(m) {
    pyMode = m;
    ['yield','actual','theoretical'].forEach(k => {
      const btn = document.getElementById(`py-mode-${k}`);
      if (btn) btn.classList.toggle('active', k === m);
    });
    pyBuildFields();
  }

  function pyBuildFields() {
    const container = document.getElementById('py-fields-stoi');
    if (!container) return;
    const unitRow = (key) => `
      <div class="stoi-radio-row" style="margin-top:4px;">
        <label class="stoi-radio"><input type="radio" name="py-unit-${key}" value="g" checked /> g</label>
        <label class="stoi-radio"><input type="radio" name="py-unit-${key}" value="kg" /> kg</label>
        <label class="stoi-radio"><input type="radio" name="py-unit-${key}" value="mol" /> mol</label>
      </div>`;
    let html = '';
    if (pyMode === 'yield' || pyMode === 'actual') {
      html += `<div class="stoi-input-grid" style="margin-bottom:8px;">
        <div class="stoi-input-cell"><label class="stoi-lbl">Theoretical Yield</label>
          <input type="number" id="py-man-theoretical" min="0" step="any" placeholder="0" class="stoi-num-input" style="width:120px;"/></div>
        <div class="stoi-input-cell"><label class="stoi-lbl">Unit</label>${unitRow('theoretical')}</div>
      </div>`;
    }
    if (pyMode === 'yield' || pyMode === 'theoretical') {
      html += `<div class="stoi-input-grid" style="margin-bottom:8px;">
        <div class="stoi-input-cell"><label class="stoi-lbl">Actual Yield</label>
          <input type="number" id="py-man-actual" min="0" step="any" placeholder="0" class="stoi-num-input" style="width:120px;"/></div>
        <div class="stoi-input-cell"><label class="stoi-lbl">Unit</label>${unitRow('actual')}</div>
      </div>`;
    }
    if (pyMode === 'actual' || pyMode === 'theoretical') {
      html += `<div class="stoi-input-grid" style="margin-bottom:8px;">
        <div class="stoi-input-cell"><label class="stoi-lbl">% Yield</label>
          <input type="number" id="py-man-pct" min="0" max="100" step="any" placeholder="0" class="stoi-num-input" style="width:120px;"/></div>
        <div class="stoi-input-cell"><label class="stoi-lbl" style="font-size:12px;color:#888;">%</label></div>
      </div>`;
    }
    html += `<div class="mini-note" style="color:#1a56a8;">Solving for: <strong>${
      pyMode === 'yield' ? '% Yield' : pyMode === 'actual' ? 'Actual Yield' : 'Theoretical Yield'
    }</strong></div>`;
    container.innerHTML = html;
  }

  function _getAmt(id, unitName) {
    const v = parseFloat(document.getElementById(id)?.value);
    if (isNaN(v)) return null;
    const unit = document.querySelector(`input[name="${unitName}"]:checked`)?.value || 'g';
    const grams = unit === 'kg' ? v * 1000 : unit === 'mol' ? null : v;
    return { v, unit, grams };
  }

  function pyCalculate() {
    const resEl = document.getElementById('py-results-stoi');
    if (!resEl) return;
    let actual, theoretical, pct, solvedFor;

    const toG = (obj) => obj.unit === 'kg' ? obj.v * 1000 : obj.v; // mol handled separately

    if (pyMode === 'yield') {
      const a = _getAmt('py-man-actual', 'py-unit-actual');
      const t = _getAmt('py-man-theoretical', 'py-unit-theoretical');
      if (!a || !t) { showAlert('Enter both actual and theoretical yield.', true); return; }
      if (toG(t) <= 0) { showAlert('Theoretical yield must be > 0.', true); return; }
      pct = (toG(a) / toG(t)) * 100;
      actual = a; theoretical = t; solvedFor = '% Yield';
    } else if (pyMode === 'actual') {
      const t = _getAmt('py-man-theoretical', 'py-unit-theoretical');
      const pctV = parseFloat(document.getElementById('py-man-pct')?.value);
      if (!t || isNaN(pctV)) { showAlert('Enter theoretical yield and % yield.', true); return; }
      pct = pctV;
      const aG = (pct / 100) * toG(t);
      actual = { v: t.unit === 'kg' ? aG/1000 : aG, unit: t.unit };
      theoretical = t; solvedFor = 'Actual Yield';
    } else {
      const a = _getAmt('py-man-actual', 'py-unit-actual');
      const pctV = parseFloat(document.getElementById('py-man-pct')?.value);
      if (!a || isNaN(pctV) || pctV <= 0) { showAlert('Enter actual yield and % yield.', true); return; }
      pct = pctV;
      const tG = (toG(a) / pct) * 100;
      theoretical = { v: a.unit === 'kg' ? tG/1000 : tG, unit: a.unit };
      actual = a; solvedFor = 'Theoretical Yield';
    }

    const fmt = (o) => `${o.v.toFixed(4)} ${o.unit}`;
    const yieldClass = pct >= 90 ? 'green' : pct >= 75 ? 'blue' : pct >= 50 ? 'yellow' : 'red';
    const yieldLabel = pct >= 90 ? 'Excellent' : pct >= 75 ? 'Good' : pct >= 50 ? 'Moderate' : 'Low';
    const barColor   = pct >= 90 ? '#4caf50' : pct >= 75 ? '#4a90e2' : pct >= 50 ? '#ffc107' : '#ef5350';
    resEl.innerHTML = `
      <table class="result-table" style="margin-bottom:12px;">
        <thead><tr><th>Quantity</th><th>Value</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>Theoretical Yield</td><td class="num">${fmt(theoretical)}</td>
            <td>${solvedFor==='Theoretical Yield'?'<span class="result-badge blue">Solved</span>':'<span class="result-badge green">Given</span>'}</td></tr>
          <tr><td>Actual Yield</td><td class="num">${fmt(actual)}</td>
            <td>${solvedFor==='Actual Yield'?'<span class="result-badge blue">Solved</span>':'<span class="result-badge green">Given</span>'}</td></tr>
        </tbody>
      </table>
      <div class="answer-box" style="margin-bottom:12px;">
        <span class="answer-label">% Yield</span>
        <span class="answer-value">${pct.toFixed(2)}</span>
        <span class="answer-unit">%</span>
        <span class="result-badge ${yieldClass}" style="margin-left:8px;">${yieldLabel}</span>
      </div>
      <div style="height:14px;background:#e0e8f5;border-radius:7px;overflow:hidden;">
        <div style="width:${Math.min(pct,100).toFixed(1)}%;height:100%;background:${barColor};border-radius:7px;"></div>
      </div>`;
  }

  return { init, balanceStep, onModeToggle, calculateStandard, calculateLimiting, exportPNG, clear,
           pySetMode, pySetManual, pyCalculate, pyCalcFromStoi };
})();

window.addEventListener('load', () => Stoichiometry.init());

  function pySetMode(m) {
    pyMode = m;
    ['yield','actual','theoretical'].forEach(k => {
      const btn = document.getElementById(`py-mode-${k}`);
      if (btn) btn.classList.toggle('active', k === m);
    });
    pyBuildFields();
  }

  function pyBuildFields() {
    const container = document.getElementById('py-fields-stoi');
    if (!container) return;

    const unitRow = (key) => `
      <div class="stoi-radio-row" style="margin-top:4px;">
        <label class="stoi-radio"><input type="radio" name="py-stoi-unit-${key}" value="g" checked /> g</label>
        <label class="stoi-radio"><input type="radio" name="py-stoi-unit-${key}" value="kg" /> kg</label>
        <label class="stoi-radio"><input type="radio" name="py-stoi-unit-${key}" value="mol" /> mol</label>
      </div>`;

    let html = '';

    // If solving for % yield or actual, we need theoretical
    // Show dropdown from stoichiometry if available
    if (pyMode === 'yield' || pyMode === 'actual') {
      if (pyTheoreticalOptions.length > 0) {
        html += `<div class="stoi-input-grid" style="margin-bottom:10px;background:#f0f6ff;border:1px solid #c8d5ee;border-radius:6px;padding:10px;">
          <div class="stoi-input-cell" style="width:100%;">
            <label class="stoi-lbl" style="color:#1a56a8;">📊 Use Theoretical Yield from Stoichiometry</label>
            <select id="py-stoi-theo-sel" class="stoi-select" style="width:100%;background:#fff;color:#111;border-color:#c8d5ee;" onchange="Stoichiometry.pyApplyTheo()">
              <option value="">— select a product —</option>
              ${pyTheoreticalOptions.map((p,i) => `<option value="${i}">${p.formula} — ${p.grams.toFixed(4)} g / ${p.moles.toFixed(4)} mol</option>`).join('')}
            </select>
          </div>
        </div>`;
      }
      // Theoretical manual entry
      html += `<div class="stoi-input-grid" style="margin-bottom:8px;">
        <div class="stoi-input-cell">
          <label class="stoi-lbl">Theoretical Yield${pyTheoreticalOptions.length ? ' (or enter manually)' : ''}</label>
          <input type="number" id="py-stoi-theoretical" min="0" step="any" placeholder="0" class="stoi-num-input" style="width:120px;" />
        </div>
        <div class="stoi-input-cell"><label class="stoi-lbl">Unit</label>${unitRow('theoretical')}</div>
      </div>`;
    }

    if (pyMode === 'yield' || pyMode === 'theoretical') {
      html += `<div class="stoi-input-grid" style="margin-bottom:8px;">
        <div class="stoi-input-cell">
          <label class="stoi-lbl">Actual Yield</label>
          <input type="number" id="py-stoi-actual" min="0" step="any" placeholder="0" class="stoi-num-input" style="width:120px;" />
        </div>
        <div class="stoi-input-cell"><label class="stoi-lbl">Unit</label>${unitRow('actual')}</div>
      </div>`;
    }

    if (pyMode === 'actual' || pyMode === 'theoretical') {
      html += `<div class="stoi-input-grid" style="margin-bottom:8px;">
        <div class="stoi-input-cell">
          <label class="stoi-lbl">% Yield</label>
          <input type="number" id="py-stoi-pct" min="0" max="100" step="any" placeholder="0" class="stoi-num-input" style="width:120px;" />
        </div>
        <div class="stoi-input-cell"><label class="stoi-lbl" style="color:#888;font-size:10px;">%</label></div>
      </div>`;
    }

    if (pyMode === 'theoretical' && pyTheoreticalOptions.length === 0) {
      html += `<div class="stoi-input-grid" style="margin-bottom:8px;">
        <div class="stoi-input-cell">
          <label class="stoi-lbl">Theoretical Yield</label>
          <input type="number" id="py-stoi-theoretical" min="0" step="any" placeholder="0" class="stoi-num-input" style="width:120px;" />
        </div>
        <div class="stoi-input-cell"><label class="stoi-lbl">Unit</label>${unitRow('theoretical')}</div>
      </div>`;
    }

    html += `<div class="mini-note" style="color:#1a56a8;">Solving for: <strong>${
      pyMode === 'yield' ? '% Yield' : pyMode === 'actual' ? 'Actual Yield' : 'Theoretical Yield'
    }</strong></div>`;
    container.innerHTML = html;
  }

  function pyApplyTheo() {
    const sel = document.getElementById('py-stoi-theo-sel');
    if (!sel || sel.value === '') return;
    const opt = pyTheoreticalOptions[parseInt(sel.value)];
    if (!opt) return;
    // Populate the theoretical input based on selected unit
    const unit = document.querySelector('input[name="py-stoi-unit-theoretical"]:checked')?.value || 'g';
    const inp = document.getElementById('py-stoi-theoretical');
    if (!inp) return;
    if (unit === 'g')   inp.value = opt.grams.toFixed(6);
    else if (unit === 'kg') inp.value = opt.kg.toFixed(6);
    else if (unit === 'mol') inp.value = opt.moles.toFixed(6);
  }

  function pyGetVal(key) {
    const el = document.getElementById(`py-stoi-${key}`);
    const val = parseFloat(el?.value);
    if (isNaN(val)) return null;
    // Convert to grams for uniform calculation
    if (key === 'pct') return val;
    const unit = document.querySelector(`input[name="py-stoi-unit-${key}"]:checked`)?.value || 'g';
    if (unit === 'kg') return { val: val * 1000, unit };
    if (unit === 'mol') return { val, unit }; // moles — caller handles
    return { val, unit: 'g' };
  }

  function pyCalculate() {
    const resEl = document.getElementById('py-results-stoi');
    if (!resEl) return;

    // Read values
    const getAmt = (key) => {
      const el = document.getElementById(`py-stoi-${key}`);
      const v = parseFloat(el?.value);
      if (isNaN(v)) return null;
      const unit = document.querySelector(`input[name="py-stoi-unit-${key}"]:checked`)?.value || 'g';
      return { v, unit };
    };

    let actual, theoretical, pct, solvedFor;

    if (pyMode === 'yield') {
      const a = getAmt('actual'), t = getAmt('theoretical');
      if (!a || !t) { showAlert('Enter both actual and theoretical yield.', true); return; }
      // Convert to same unit for comparison — use as-is since we just need ratio
      const aVal = a.unit === 'kg' ? a.v * 1000 : a.v;
      const tVal = t.unit === 'kg' ? t.v * 1000 : t.v;
      if (tVal <= 0) { showAlert('Theoretical yield must be > 0.', true); return; }
      pct = (aVal / tVal) * 100;
      actual = { v: a.v, unit: a.unit }; theoretical = { v: t.v, unit: t.unit };
      solvedFor = '% Yield';
    } else if (pyMode === 'actual') {
      const t = getAmt('theoretical');
      const pctEl = document.getElementById('py-stoi-pct');
      const pctV = parseFloat(pctEl?.value);
      if (!t || isNaN(pctV)) { showAlert('Enter theoretical yield and % yield.', true); return; }
      if (pctV <= 0 || pctV > 100) { showAlert('% Yield must be between 0 and 100.', true); return; }
      pct = pctV;
      const tVal = t.unit === 'kg' ? t.v * 1000 : t.v;
      const aGrams = (pct / 100) * tVal;
      actual = { v: t.unit === 'kg' ? aGrams / 1000 : aGrams, unit: t.unit };
      theoretical = t; solvedFor = 'Actual Yield';
    } else {
      const a = getAmt('actual');
      const pctEl = document.getElementById('py-stoi-pct');
      const pctV = parseFloat(pctEl?.value);
      if (!a || isNaN(pctV)) { showAlert('Enter actual yield and % yield.', true); return; }
      if (pctV <= 0) { showAlert('% Yield must be > 0.', true); return; }
      pct = pctV;
      const aVal = a.unit === 'kg' ? a.v * 1000 : a.v;
      const tGrams = (aVal / pct) * 100;
      theoretical = { v: a.unit === 'kg' ? tGrams / 1000 : tGrams, unit: a.unit };
      actual = a; solvedFor = 'Theoretical Yield';
    }

    const fmtAmt = (obj) => `${obj.v.toFixed(4)} ${obj.unit}`;
    const yieldClass = pct >= 90 ? 'green' : pct >= 75 ? 'blue' : pct >= 50 ? 'yellow' : 'red';
    const yieldLabel = pct >= 90 ? 'Excellent' : pct >= 75 ? 'Good' : pct >= 50 ? 'Moderate' : 'Low';
    const barPct = Math.min(pct, 100);
    const barColor = pct >= 90 ? '#4caf50' : pct >= 75 ? '#4a90e2' : pct >= 50 ? '#ffc107' : '#ef5350';

    resEl.innerHTML = `
      <div class="stoi-section" style="background:#fff;border:1px solid #dde3f0;">
        <div style="font-size:13px;font-weight:700;color:#1a2a4a;margin-bottom:10px;">% Yield Results</div>
        <table class="result-table" style="margin-bottom:12px;">
          <thead><tr><th>Quantity</th><th>Value</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>Theoretical Yield</td><td class="num">${fmtAmt(theoretical)}</td>
              <td>${solvedFor === 'Theoretical Yield' ? '<span class="result-badge blue">Solved</span>' : '<span class="result-badge green">Given</span>'}</td></tr>
            <tr><td>Actual Yield</td><td class="num">${fmtAmt(actual)}</td>
              <td>${solvedFor === 'Actual Yield' ? '<span class="result-badge blue">Solved</span>' : '<span class="result-badge green">Given</span>'}</td></tr>
          </tbody>
        </table>
        <div class="answer-box" style="margin-bottom:12px;">
          <span class="answer-label">% Yield</span>
          <span class="answer-value">${pct.toFixed(2)}</span>
          <span class="answer-unit">%</span>
          <span class="result-badge ${yieldClass}" style="margin-left:8px;">${yieldLabel}</span>
        </div>
        <div style="height:14px;background:#e0e8f5;border-radius:7px;overflow:hidden;">
          <div style="width:${barPct.toFixed(1)}%;height:100%;background:${barColor};border-radius:7px;"></div>
        </div>
        <div style="font-size:10px;color:#888;margin-top:3px;display:flex;justify-content:space-between;">
          <span>0%</span><span>50%</span><span>100%</span>
        </div>
      </div>`;
  }

  return { init, balanceStep, onModeToggle, calculateStandard, calculateLimiting, exportPNG, clear,
           pySetMode, pyCalculate, pyApplyTheo };
})();

window.addEventListener('load', () => {
  Stoichiometry.init();
  // Initialize percent yield fields
  setTimeout(() => { if (typeof Stoichiometry.pySetMode === 'function') Stoichiometry.pySetMode('yield'); }, 100);
});
