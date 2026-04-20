// empirical-molecular.js

const EmpiricalMolecular = (() => {
  let inputMode = 'percent'; // 'percent' | 'mass'
  let rows = [
    { element: 'C', value: '' },
    { element: 'H', value: '' },
    { element: 'O', value: '' },
  ];

  const EXAMPLES = {
    water:    { mode:'percent', rows:[{element:'H',value:'11.19'},{element:'O',value:'88.81'}],          molarMass:18.02 },
    glucose:  { mode:'percent', rows:[{element:'C',value:'40.00'},{element:'H',value:'6.72'},{element:'O',value:'53.28'}], molarMass:180.16 },
    empirical:{ mode:'percent', rows:[{element:'C',value:'85.63'},{element:'H',value:'14.37'}],          molarMass:null },
    feo:      { mode:'mass',    rows:[{element:'Fe',value:'2.79'},{element:'O',value:'1.20'}],            molarMass:null },
  };

  function init() {
    setMode('percent');
    rebuildRows();
  }

  function setMode(m) {
    inputMode = m;
    const pBtn = document.getElementById('em-mode-pct');
    const mBtn = document.getElementById('em-mode-mass');
    const note = document.getElementById('em-mode-note');
    const hdr  = document.getElementById('em-col-header');
    if (pBtn) pBtn.classList.toggle('active', m === 'percent');
    if (mBtn) mBtn.classList.toggle('active', m === 'mass');
    if (note) note.textContent = m === 'percent'
      ? 'Enter the percent by mass of each element. Values should add up to ~100%.'
      : 'Enter the actual mass (in grams) of each element in your sample.';
    if (hdr) hdr.textContent = m === 'percent' ? '% by Mass' : 'Mass (g)';
    rebuildRows();
  }

  function rebuildRows() {
    const container = document.getElementById('em-element-rows');
    if (!container) return;
    container.innerHTML = '';
    rows.forEach((row, i) => {
      const div = document.createElement('div');
      div.className = 'element-row';

      const elInp = document.createElement('input');
      elInp.type = 'text'; elInp.value = row.element;
      elInp.placeholder = 'e.g. C'; elInp.autocomplete = 'off'; elInp.spellcheck = false;
      elInp.style.textAlign = 'center';
      elInp.addEventListener('input', () => { rows[i].element = elInp.value.trim(); });

      const valInp = document.createElement('input');
      valInp.type = 'number'; valInp.min = '0'; valInp.step = '0.001';
      valInp.value = row.value;
      valInp.placeholder = inputMode === 'percent' ? '% mass' : 'grams';
      valInp.addEventListener('input', () => { rows[i].value = valInp.value; });
      valInp.addEventListener('keydown', e => { if (e.key === 'Enter') EmpiricalMolecular.calculate(); });

      const del = document.createElement('button');
      del.className = 'del-btn'; del.textContent = '×';
      del.onclick = () => {
        if (rows.length <= 2) { showAlert('Need at least 2 elements.', true); return; }
        rows.splice(i, 1); rebuildRows();
      };

      div.appendChild(elInp); div.appendChild(valInp); div.appendChild(del);
      container.appendChild(div);
    });
  }

  function addRow() {
    rows.push({ element: '', value: '' });
    rebuildRows();
    // Focus the new element input
    const inputs = document.querySelectorAll('.element-row input[type="text"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }

  function calculate() {
    // Read current values from DOM
    const elInputs  = document.querySelectorAll('.element-row input[type="text"]');
    const valInputs = document.querySelectorAll('.element-row input[type="number"]');
    rows = [...elInputs].map((el, i) => ({
      element: el.value.trim(),
      value:   valInputs[i]?.value.trim() || ''
    }));

    const molarMassInput = parseFloat(document.getElementById('em-molar-mass')?.value);
    const hasMolarMass   = !isNaN(molarMassInput) && molarMassInput > 0;

    // Validate
    if (rows.some(r => !r.element)) { showAlert('All elements must have a symbol.', true); return; }
    if (rows.some(r => r.value === '' || isNaN(parseFloat(r.value)))) {
      showAlert('All elements must have a value.', true); return;
    }

    const elements = rows.map(r => r.element);
    const values   = rows.map(r => parseFloat(r.value));

    // Check for unknown elements
    for (const el of elements) {
      if (!(el in ATOMIC_MASSES)) {
        showAlert(`Unknown element symbol: "${el}"`, true); return;
      }
    }

    // If percent mode, optionally check sum ≈ 100
    if (inputMode === 'percent') {
      const total = values.reduce((a, b) => a + b, 0);
      if (Math.abs(total - 100) > 2) {
        showAlert(`Warning: percentages sum to ${total.toFixed(2)}% (expected ~100%)`, false);
      }
    }

    // Step 1: Convert percent → assume 100g sample → grams = percent value
    const masses = inputMode === 'percent' ? values : values;

    // Step 2: Divide by atomic mass to get moles
    const moles = elements.map((el, i) => masses[i] / ATOMIC_MASSES[el]);

    // Step 3: Divide by smallest to get ratios
    const minMoles = Math.min(...moles);
    const ratios   = moles.map(m => m / minMoles);

    // Step 4: Round to whole numbers (multiply by factor if needed to clear fractions)
    const MAX_MULT = 8;
    let integers = null;
    for (let mult = 1; mult <= MAX_MULT; mult++) {
      const trial = ratios.map(r => Math.round(r * mult));
      const valid = trial.every(t => t > 0 && Math.abs(t - ratios[ratios.indexOf(ratios[trial.indexOf(t)])] * mult) < 0.15);
      // Verify: divide trial by GCD and check it makes sense
      const g = trial.reduce((a, b) => gcd(a, b), trial[0]);
      if (valid && g >= 1) {
        // Check if this is consistent
        const normalized = trial.map(t => t / g);
        if (normalized.every(t => Number.isInteger(t) && t > 0)) {
          integers = normalized;
          break;
        }
        integers = trial;
        break;
      }
    }
    if (!integers) integers = ratios.map(r => Math.round(r));

    // Ensure GCD = 1
    const g = integers.reduce((a, b) => gcd(Math.abs(a), Math.abs(b)), 0);
    if (g > 1) integers = integers.map(t => t / g);

    // Build empirical formula
    const empiricalFormula = elements.map((el, i) => el + (integers[i] > 1 ? integers[i] : '')).join('');
    let empiricalMass;
    try { empiricalMass = computeMolarMass(empiricalFormula).mass; }
    catch(e) { empiricalMass = null; }

    // Molecular formula
    let molecularFormula = null;
    let n = null;
    if (hasMolarMass && empiricalMass) {
      n = Math.round(molarMassInput / empiricalMass);
      if (n < 1) n = 1;
      molecularFormula = elements.map((el, i) => el + (integers[i] * n > 1 ? integers[i] * n : '')).join('');
    }

    renderResults(elements, values, moles, ratios, integers, empiricalFormula, empiricalMass,
                  molecularFormula, n, molarMassInput, hasMolarMass);
  }

  function renderResults(elements, values, moles, ratios, integers, empiricalFormula, empiricalMass,
                         molecularFormula, n, molarMassInput, hasMolarMass) {
    const resultsEl = document.getElementById('em-results');
    const unitLabel = inputMode === 'percent' ? '%' : 'g';

    let html = `<h2>🔬 Empirical${hasMolarMass ? ' &amp; Molecular' : ''} Formula</h2>`;

    // Step-by-step table
    html += `<div class="results-section-title">Step-by-Step Calculation</div>`;
    html += `<table class="result-table">
      <thead><tr>
        <th>Element</th>
        <th>${inputMode === 'percent' ? '% by Mass' : 'Mass (g)'}</th>
        <th>÷ Atomic Mass</th>
        <th>= Moles</th>
        <th>÷ Smallest</th>
        <th>≈ Ratio</th>
        <th>Integer</th>
      </tr></thead><tbody>`;

    const minMoles = Math.min(...moles);
    elements.forEach((el, i) => {
      html += `<tr>
        <td><strong>${el}</strong></td>
        <td class="num">${values[i].toFixed(3)} ${unitLabel}</td>
        <td class="num">÷ ${ATOMIC_MASSES[el]}</td>
        <td class="num">${moles[i].toFixed(5)}</td>
        <td class="num">÷ ${minMoles.toFixed(5)}</td>
        <td class="num">${ratios[i].toFixed(4)}</td>
        <td class="num" style="font-weight:700;color:#1a56a8;">${integers[i]}</td>
      </tr>`;
    });
    html += `</tbody></table>`;

    // Empirical formula answer
    html += `<div class="results-section-title">Empirical Formula</div>`;
    html += `<div class="answer-box">
      <span class="answer-label">Empirical Formula</span>
      <span class="answer-value" style="font-size:20px;">${formulaToHTML(empiricalFormula)}</span>
      ${empiricalMass ? `<span class="answer-unit">M = ${empiricalMass.toFixed(3)} g/mol</span>` : ''}
    </div>`;

    // Molecular formula
    if (hasMolarMass) {
      html += `<div class="results-section-title">Molecular Formula</div>`;
      if (molecularFormula) {
        html += `<div class="step-card">
          <div class="step-title">Find the multiplier n</div>
          <div class="step-eq">
            n = Molar Mass / Empirical Formula Mass = ${molarMassInput} / ${empiricalMass?.toFixed(3)} ≈ <strong>${n}</strong>
          </div>
        </div>`;
        let molMass = null;
        try { molMass = computeMolarMass(molecularFormula).mass; } catch(e) {}
        html += `<div class="answer-box">
          <span class="answer-label">Molecular Formula</span>
          <span class="answer-value" style="font-size:20px;">${formulaToHTML(molecularFormula)}</span>
          ${molMass ? `<span class="answer-unit">M = ${molMass.toFixed(3)} g/mol</span>` : ''}
        </div>`;
        if (n === 1) {
          html += `<div class="mini-note" style="margin-top:8px;color:#555;">n = 1: The empirical and molecular formulas are the same.</div>`;
        }
      }
    }

    resultsEl.innerHTML = html;
  }

  function clear() {
    rows = [
      { element: 'C', value: '' },
      { element: 'H', value: '' },
      { element: 'O', value: '' },
    ];
    const mm = document.getElementById('em-molar-mass');
    if (mm) mm.value = '';
    rebuildRows();
    document.getElementById('em-results').innerHTML =
      '<div class="placeholder-msg">🔬 Enter element data and click <strong>Calculate</strong> to find the empirical formula.</div>';
  }

  function loadExample(key) {
    const ex = EXAMPLES[key];
    if (!ex) return;
    rows = ex.rows.map(r => ({...r}));
    setMode(ex.mode);
    rebuildRows();
    const mm = document.getElementById('em-molar-mass');
    if (mm) mm.value = ex.molarMass !== null ? ex.molarMass : '';
    const valInputs = document.querySelectorAll('.element-row input[type="number"]');
    rows.forEach((r, i) => { if (valInputs[i]) valInputs[i].value = r.value; });
    const elInputs = document.querySelectorAll('.element-row input[type="text"]');
    rows.forEach((r, i) => { if (elInputs[i]) elInputs[i].value = r.element; });
    calculate();
  }

  return { init, calculate, clear, setMode, addRow, loadExample };
})();

window.addEventListener('load', () => EmpiricalMolecular.init());
