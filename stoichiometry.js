// stoichiometry.js

const Stoichiometry = (() => {
  const AVOGADRO = 6.02214076e23;
  const MOLAR_VOL_STP = 22.414; // L/mol at STP

  let reactants = [
    { formula: 'CH4', coeff: 1 },
    { formula: 'O2',  coeff: 2 },
  ];
  let products = [
    { formula: 'CO2', coeff: 1 },
    { formula: 'H2O', coeff: 2 },
  ];
  let limitingMode = false;

  const EXAMPLES = {
    combustion: {
      r: [{ formula:'CH4', coeff:1 },{ formula:'O2', coeff:2 }],
      p: [{ formula:'CO2', coeff:1 },{ formula:'H2O', coeff:2 }]
    },
    haber: {
      r: [{ formula:'N2', coeff:1 },{ formula:'H2', coeff:3 }],
      p: [{ formula:'NH3', coeff:2 }]
    },
    ironrust: {
      r: [{ formula:'Fe', coeff:4 },{ formula:'O2', coeff:3 }],
      p: [{ formula:'Fe2O3', coeff:2 }]
    },
  };

  function init() {
    fetch('stoichiometry.html')
      .then(r => r.text())
      .then(html => {
        loadTemplate('stoichiometry-container', html);
        rebuildAll();
      })
      .catch(() => {});
  }

  function toggleMode() {
    limitingMode = document.getElementById('stoi-limiting-toggle')?.checked || false;
    const label = document.getElementById('stoi-mode-label');
    const note  = document.getElementById('stoi-mode-note');
    const kg    = document.getElementById('stoi-known-group');
    const lg    = document.getElementById('stoi-limiting-group');
    if (label) label.textContent = limitingMode ? 'Limiting Reactant' : 'Standard Stoichiometry';
    if (note)  note.textContent  = limitingMode
      ? 'Find the limiting reactant and calculate maximum product yield.'
      : 'Calculate the amount of product produced or reactant consumed from a known quantity of one substance.';
    if (kg) kg.style.display = limitingMode ? 'none' : '';
    if (lg) lg.style.display = limitingMode ? '' : 'none';
    if (limitingMode) rebuildLimitingInputs();
  }

  function rebuildAll() {
    rebuildCompoundList('stoi-reactants-list', reactants, 'reactant',
      (i, key, val) => { reactants[i][key] = val; rebuildSelects(); rebuildLimitingInputs(); },
      (i) => { if (reactants.length <= 1) { showAlert('Need at least 1 reactant.', true); return; } reactants.splice(i, 1); rebuildAll(); }
    );
    rebuildCompoundList('stoi-products-list', products, 'product',
      (i, key, val) => { products[i][key] = val; rebuildSelects(); },
      (i) => { if (products.length <= 1) { showAlert('Need at least 1 product.', true); return; } products.splice(i, 1); rebuildAll(); }
    );
    rebuildSelects();
    rebuildLimitingInputs();
  }

  function rebuildCompoundList(listId, arr, role, onChange, onDelete) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = '';
    arr.forEach((item, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:5px;align-items:center;margin-bottom:5px;';

      const coeffInp = document.createElement('input');
      coeffInp.type = 'number'; coeffInp.min = '1'; coeffInp.step = '1';
      coeffInp.value = item.coeff;
      coeffInp.style.cssText = 'width:48px;min-width:48px;flex-shrink:0;text-align:center;';
      coeffInp.title = 'Coefficient';
      coeffInp.addEventListener('change', () => { onChange(i, 'coeff', parseInt(coeffInp.value) || 1); });

      const badge = document.createElement('span');
      badge.className = `role-badge ${role}`;
      badge.textContent = role === 'reactant' ? 'R' : 'P';

      const formulaInp = document.createElement('input');
      formulaInp.type = 'text'; formulaInp.className = 'formula-input';
      formulaInp.value = item.formula;
      formulaInp.placeholder = 'Formula';
      formulaInp.autocomplete = 'off'; formulaInp.spellcheck = false;
      formulaInp.addEventListener('input', () => { onChange(i, 'formula', formulaInp.value.trim()); });

      const del = document.createElement('button');
      del.className = 'del-btn'; del.textContent = '×';
      del.onclick = () => onDelete(i);

      row.appendChild(coeffInp); row.appendChild(badge); row.appendChild(formulaInp); row.appendChild(del);
      list.appendChild(row);
    });
  }

  function rebuildSelects() {
    const all = [...reactants, ...products];
    ['stoi-given-compound','stoi-target-compound'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const prev = sel.value;
      sel.innerHTML = '';
      all.forEach((item, i) => {
        const o = document.createElement('option');
        o.value = i;
        o.textContent = `${item.coeff} ${item.formula}`;
        sel.appendChild(o);
      });
      if (prev) sel.value = prev;
    });
    // Default target to last product
    const targetSel = document.getElementById('stoi-target-compound');
    if (targetSel && !targetSel.value) targetSel.value = reactants.length;
  }

  function rebuildLimitingInputs() {
    const container = document.getElementById('stoi-limiting-inputs');
    if (!container) return;
    container.innerHTML = '';
    reactants.forEach((item, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:5px;';

      const lbl = document.createElement('span');
      lbl.style.cssText = 'font-size:12px;width:80px;flex-shrink:0;font-family:monospace;';
      lbl.textContent = `${item.coeff} ${item.formula}`;

      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = '0'; inp.step = '0.001'; inp.value = '1';
      inp.id = `stoi-limit-amt-${i}`;

      row.appendChild(lbl); row.appendChild(inp);
      container.appendChild(row);
    });
  }

  function addReactant() { reactants.push({ formula: '', coeff: 1 }); rebuildAll(); }
  function addProduct()  { products.push({ formula: '', coeff: 1 }); rebuildAll(); }

  // Convert amount to moles
  function toMoles(amount, unit, formula) {
    switch(unit) {
      case 'mol': return amount;
      case 'g': {
        const mm = computeMolarMass(formula).mass;
        return amount / mm;
      }
      case 'L': return amount / MOLAR_VOL_STP;
      case 'particles': return amount / AVOGADRO;
    }
    return amount;
  }

  // Convert moles to target unit
  function fromMoles(moles, unit, formula) {
    switch(unit) {
      case 'mol': return moles;
      case 'g': {
        const mm = computeMolarMass(formula).mass;
        return moles * mm;
      }
      case 'L': return moles * MOLAR_VOL_STP;
      case 'particles': return moles * AVOGADRO;
    }
    return moles;
  }

  function unitLabel(unit) {
    return { mol:'mol', g:'g', L:'L', particles:'particles' }[unit] || unit;
  }

  function calculate() {
    if (limitingMode) calculateLimiting();
    else calculateStandard();
  }

  function calculateStandard() {
    // Read values from DOM
    const rInputs = document.querySelectorAll('#stoi-reactants-list input[type="number"]');
    const rForms  = document.querySelectorAll('#stoi-reactants-list input[type="text"]');
    const pInputs = document.querySelectorAll('#stoi-products-list input[type="number"]');
    const pForms  = document.querySelectorAll('#stoi-products-list input[type="text"]');
    reactants = [...rInputs].map((inp, i) => ({ coeff: parseInt(inp.value)||1, formula: rForms[i]?.value.trim()||'' }));
    products  = [...pInputs].map((inp, i) => ({ coeff: parseInt(inp.value)||1, formula: pForms[i]?.value.trim()||'' }));

    const all = [...reactants, ...products];
    const givenIdx  = parseInt(document.getElementById('stoi-given-compound')?.value) || 0;
    const targetIdx = parseInt(document.getElementById('stoi-target-compound')?.value) || reactants.length;
    const givenAmt  = parseFloat(document.getElementById('stoi-given-amount')?.value) || 1;
    const givenUnit = document.getElementById('stoi-given-unit')?.value || 'mol';
    const resultUnit= document.getElementById('stoi-result-unit')?.value || 'mol';

    if (givenIdx === targetIdx) { showAlert('Given and target compounds must be different.', true); return; }

    const given  = all[givenIdx];
    const target = all[targetIdx];
    if (!given?.formula || !target?.formula) { showAlert('Please fill in all compound formulas.', true); return; }

    let givenMoles, targetMoles, givenMolarMass, targetMolarMass;
    try {
      givenMolarMass  = computeMolarMass(given.formula).mass;
      targetMolarMass = computeMolarMass(target.formula).mass;
      givenMoles  = toMoles(givenAmt, givenUnit, given.formula);
      const moleRatio = target.coeff / given.coeff;
      targetMoles = givenMoles * moleRatio;
    } catch(e) {
      showAlert('Error: ' + e.message, true); return;
    }

    const targetAmt = fromMoles(targetMoles, resultUnit, target.formula);

    const resultsEl = document.getElementById('stoi-results');
    const eqStr = buildEqDisplay();
    let html = `<h2>🧮 Stoichiometry Result</h2>`;
    html += `<div class="equation-display">${eqStr}</div>`;

    html += `<div class="results-section-title">Calculation Steps</div>`;
    // Step 1: Convert given to moles
    html += `<div class="step-card">
      <div class="step-title">Step 1: Convert given quantity to moles</div>
      <div class="step-eq">
        ${givenAmt} ${unitLabel(givenUnit)} ${formulaToHTML(given.formula)}
        ${givenUnit !== 'mol' ? ` × (1 mol / ${givenUnit === 'g' ? givenMolarMass.toFixed(4) + ' g' : givenUnit === 'L' ? MOLAR_VOL_STP + ' L' : AVOGADRO.toExponential(3) + ' particles'}) = ` : ' = '}
        <strong>${givenMoles.toFixed(4)} mol ${formulaToHTML(given.formula)}</strong>
      </div>
    </div>`;
    // Step 2: Mole ratio
    html += `<div class="step-card">
      <div class="step-title">Step 2: Apply mole ratio</div>
      <div class="step-eq">
        ${givenMoles.toFixed(4)} mol ${formulaToHTML(given.formula)} × (${target.coeff} mol ${formulaToHTML(target.formula)} / ${given.coeff} mol ${formulaToHTML(given.formula)}) = <strong>${targetMoles.toFixed(4)} mol ${formulaToHTML(target.formula)}</strong>
      </div>
    </div>`;
    // Step 3: Convert to target unit
    if (resultUnit !== 'mol') {
      const convFactor = resultUnit === 'g' ? `${targetMolarMass.toFixed(4)} g/mol` : resultUnit === 'L' ? `${MOLAR_VOL_STP} L/mol` : `${AVOGADRO.toExponential(3)} particles/mol`;
      html += `<div class="step-card">
        <div class="step-title">Step 3: Convert moles to ${unitLabel(resultUnit)}</div>
        <div class="step-eq">
          ${targetMoles.toFixed(4)} mol ${formulaToHTML(target.formula)} × ${convFactor} = <strong>${targetAmt.toPrecision ? targetAmt.toPrecision(5) : targetAmt.toFixed(4)} ${unitLabel(resultUnit)} ${formulaToHTML(target.formula)}</strong>
        </div>
      </div>`;
    }

    // Answer box
    html += `<div class="answer-box">
      <span class="answer-label">Result</span>
      <span class="answer-value">${typeof targetAmt === 'number' && targetAmt >= 1e6 ? targetAmt.toExponential(4) : targetAmt.toFixed ? targetAmt.toFixed(4) : targetAmt}</span>
      <span class="answer-unit">${unitLabel(resultUnit)} ${formulaToHTML(target.formula)}</span>
    </div>`;

    resultsEl.innerHTML = html;
  }

  function calculateLimiting() {
    const rInputs = document.querySelectorAll('#stoi-reactants-list input[type="number"]');
    const rForms  = document.querySelectorAll('#stoi-reactants-list input[type="text"]');
    const pInputs = document.querySelectorAll('#stoi-products-list input[type="number"]');
    const pForms  = document.querySelectorAll('#stoi-products-list input[type="text"]');
    reactants = [...rInputs].map((inp, i) => ({ coeff: parseInt(inp.value)||1, formula: rForms[i]?.value.trim()||'' }));
    products  = [...pInputs].map((inp, i) => ({ coeff: parseInt(inp.value)||1, formula: pForms[i]?.value.trim()||'' }));

    const limitUnit  = document.getElementById('stoi-limit-unit')?.value  || 'mol';
    const resultUnit = document.getElementById('stoi-limit-result-unit')?.value || 'mol';

    // Read available amounts
    const available = reactants.map((r, i) => {
      const el = document.getElementById(`stoi-limit-amt-${i}`);
      return parseFloat(el?.value) || 0;
    });

    if (reactants.some(r => !r.formula)) { showAlert('Please fill in all reactant formulas.', true); return; }
    if (products.some(p => !p.formula))  { showAlert('Please fill in all product formulas.', true);  return; }

    // Convert to moles
    let reactantMoles;
    try {
      reactantMoles = reactants.map((r, i) => toMoles(available[i], limitUnit, r.formula));
    } catch(e) { showAlert('Error: ' + e.message, true); return; }

    // For each reactant, find how many moles of first product it could make
    const firstProduct = products[0];
    const molesOfProduct = reactantMoles.map((mol, i) => mol * (firstProduct.coeff / reactants[i].coeff));

    const limitingIdx = molesOfProduct.indexOf(Math.min(...molesOfProduct));
    const maxProductMoles = molesOfProduct[limitingIdx];

    // Moles of each reactant consumed
    const consumed = reactants.map((r, i) => maxProductMoles * (r.coeff / firstProduct.coeff));
    const excess   = reactantMoles.map((mol, i) => mol - consumed[i]);

    const resultsEl = document.getElementById('stoi-results');
    const eqStr = buildEqDisplay();
    let html = `<h2>🧮 Limiting Reactant Analysis</h2>`;
    html += `<div class="equation-display">${eqStr}</div>`;

    html += `<div class="results-section-title">Reactant Analysis</div>`;
    html += `<table class="result-table">
      <thead><tr>
        <th>Reactant</th><th>Available</th><th>Moles Available</th>
        <th>Moles to Make ${firstProduct.coeff} mol ${formulaToHTML(firstProduct.formula)}</th>
        <th>Role</th>
      </tr></thead><tbody>`;
    reactants.forEach((r, i) => {
      const isLimiting = i === limitingIdx;
      html += `<tr>
        <td class="mono">${formulaToHTML(r.formula)}</td>
        <td class="num">${available[i]} ${unitLabel(limitUnit)}</td>
        <td class="num">${reactantMoles[i].toFixed(4)} mol</td>
        <td class="num">${molesOfProduct[i].toFixed(4)} mol product</td>
        <td>${isLimiting ? '<span class="result-badge red">⚠ Limiting</span>' : '<span class="result-badge green">Excess</span>'}</td>
      </tr>`;
    });
    html += `</tbody></table>`;

    html += `<div class="results-section-title">Amounts Consumed and Remaining</div>`;
    html += `<table class="result-table">
      <thead><tr><th>Reactant</th><th>Consumed (mol)</th><th>Remaining (mol)</th><th>Remaining (${unitLabel(limitUnit)})</th></tr></thead><tbody>`;
    reactants.forEach((r, i) => {
      let remAmt = 0;
      try { remAmt = fromMoles(excess[i], limitUnit, r.formula); } catch(e) {}
      html += `<tr>
        <td class="mono">${formulaToHTML(r.formula)}</td>
        <td class="num">${consumed[i].toFixed(4)}</td>
        <td class="num">${Math.max(0, excess[i]).toFixed(4)}</td>
        <td class="num">${Math.max(0, remAmt).toFixed(4)}</td>
      </tr>`;
    });
    html += `</tbody></table>`;

    html += `<div class="results-section-title">Products Formed</div>`;
    html += `<table class="result-table">
      <thead><tr><th>Product</th><th>Moles Formed</th><th>Amount (${unitLabel(resultUnit)})</th></tr></thead><tbody>`;
    products.forEach(p => {
      const pMoles = maxProductMoles * p.coeff / firstProduct.coeff;
      let pAmt = 0;
      try { pAmt = fromMoles(pMoles, resultUnit, p.formula); } catch(e) {}
      html += `<tr>
        <td class="mono">${formulaToHTML(p.formula)}</td>
        <td class="num">${pMoles.toFixed(4)}</td>
        <td class="num">${pAmt.toFixed(4)}</td>
      </tr>`;
    });
    html += `</tbody></table>`;

    html += `<div class="answer-box">
      <span class="answer-label">Limiting Reactant</span>
      <span class="answer-value" style="font-size:18px;">${formulaToHTML(reactants[limitingIdx].formula)}</span>
    </div>`;

    resultsEl.innerHTML = html;
  }

  function buildEqDisplay() {
    const rSide = reactants.map(r => `${r.coeff > 1 ? r.coeff : ''}${formulaToHTML(r.formula)}`).join(' + ');
    const pSide = products.map(p =>  `${p.coeff > 1 ? p.coeff : ''}${formulaToHTML(p.formula)}`).join(' + ');
    return rSide + ' → ' + pSide;
  }

  function clear() {
    reactants = [{ formula:'', coeff:1 },{ formula:'', coeff:2 }];
    products  = [{ formula:'', coeff:1 }];
    rebuildAll();
    document.getElementById('stoi-results').innerHTML =
      '<div class="placeholder-msg">🧮 Set up your balanced equation and known quantity, then click <strong>Calculate</strong>.</div>';
  }

  function loadExample(key) {
    const ex = EXAMPLES[key];
    if (!ex) return;
    reactants = ex.r.map(r => ({...r}));
    products  = ex.p.map(p => ({...p}));
    rebuildAll();
  }

  return { init, calculate, clear, toggleMode, addReactant, addProduct, loadExample };
})();

window.addEventListener('load', () => Stoichiometry.init());
