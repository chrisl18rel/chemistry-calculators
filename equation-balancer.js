// equation-balancer.js

const EqBalancer = (() => {

  const EXAMPLES = {
    combustion:    'CH4 + O2 → CO2 + H2O',
    photosynthesis:'CO2 + H2O → C6H12O6 + O2',
    ironrust:      'Fe + O2 → Fe2O3',
    haber:         'N2 + H2 → NH3',
    thermite:      'Al + Fe2O3 → Al2O3 + Fe',
    al4c3:         '___Al4C3 + ___H2O → ___CH4 + ___Al(OH)3',
    fecuso4:       '____ Fe(s) + ____ CuSO4(aq) → ____ Fe2(SO4)3(aq) + ____ Cu(s)',
  };

  function init() {
    fetch('equation-balancer.html')
      .then(r => r.text())
      .then(html => {
        loadTemplate('equation-balancer-container', html);
        // Ctrl+Enter or Shift+Enter triggers balance
        const ta = document.getElementById('eb-equation');
        if (ta) {
          ta.addEventListener('keydown', e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.shiftKey)) {
              e.preventDefault();
              balance();
            }
          });
        }
      })
      .catch(() => {});
  }

  // ── EQUATION STRING PARSER ──
  // Handles:
  //   - Blank placeholders: ___, ____, __ etc.
  //   - State symbols: (s), (l), (g), (aq)  — must come right after formula
  //   - Leading coefficients: a plain integer before the formula
  //   - Unicode arrows: →, 🡪, ➜, ➝, ⟶
  //   - ASCII arrows: ->, =>, -->, -->
  //   - Equals sign as arrow: =
  //   - Unicode subscripts auto-handled by formula-parser
  // Returns { reactants: string[], products: string[] } or throws
  function parseEquationString(raw) {
    if (!raw || !raw.trim()) throw new Error('Please enter an equation.');

    // Normalise unicode arrows and ASCII arrows to a single marker
    let s = raw
      .replace(/🡪|➜|➝|⟶|→|→/g, '→')   // various unicode right arrows
      .replace(/--?>|=>|=/g, '→');          // ASCII arrows and equals

    // Must contain exactly one arrow
    const arrowCount = (s.match(/→/g) || []).length;
    if (arrowCount === 0) throw new Error('No reaction arrow found. Use → or -> to separate reactants from products.');
    if (arrowCount > 1)  throw new Error('Multiple arrows found. Enter one equation at a time.');

    const [leftSide, rightSide] = s.split('→');

    const reactants = parseSide(leftSide);
    const products  = parseSide(rightSide);

    if (reactants.length === 0) throw new Error('No reactants found. Check the left side of your equation.');
    if (products.length  === 0) throw new Error('No products found. Check the right side of your equation.');

    return { reactants, products };
  }

  // Parse one side of the equation into an array of clean formula strings
  function parseSide(side) {
    // Split on + but NOT on + inside parentheses
    // Simple approach: split on + that are outside any ()
    const compounds = splitOnPlus(side);
    const result = [];
    for (const raw of compounds) {
      const clean = cleanCompound(raw);
      if (clean) result.push(clean);
    }
    return result;
  }

  // Split a string on top-level + signs (not inside parentheses)
  function splitOnPlus(str) {
    const parts = [];
    let depth = 0, current = '';
    for (const ch of str) {
      if (ch === '(') { depth++; current += ch; }
      else if (ch === ')') { depth--; current += ch; }
      else if (ch === '+' && depth === 0) { parts.push(current); current = ''; }
      else { current += ch; }
    }
    parts.push(current);
    return parts;
  }

  // Strip blanks, state symbols, leading coefficient, and whitespace from a compound token
  function cleanCompound(raw) {
    let s = raw.trim();
    if (!s) return '';

    // Remove blank placeholders: sequences of underscores (with optional spaces around them)
    s = s.replace(/_{1,}/g, ' ').trim();

    // Remove state symbols: (s), (l), (g), (aq) — case-insensitive, anywhere in the token
    s = s.replace(/\(\s*(?:s|l|g|aq)\s*\)/gi, '').trim();

    // Remove a leading integer coefficient (digits only, before any letter)
    // e.g. "2H2O" → "H2O", "12C6H12O6" → tricky — only strip if followed by an uppercase letter
    s = s.replace(/^\d+(?=[A-Z(])/, '').trim();

    // Remove any remaining whitespace inside the formula
    s = s.replace(/\s+/g, '');

    return s || '';
  }

  function balance() {
    const ta = document.getElementById('eb-equation');
    if (!ta) return;
    const raw = ta.value;

    const resultsEl = document.getElementById('eb-results');
    let reactants, products;
    try {
      ({ reactants, products } = parseEquationString(raw));
    } catch(e) {
      resultsEl.innerHTML = `<div class="placeholder-msg" style="color:#e74c3c;">⚠ ${e.message}</div>`;
      showAlert(e.message, true);
      return;
    }

    let coeffs;
    try {
      coeffs = balanceEquation(reactants, products);
    } catch(e) {
      resultsEl.innerHTML = `<div class="placeholder-msg" style="color:#e74c3c;">⚠ ${e.message}</div>`;
      showAlert('Could not balance: ' + e.message, true);
      return;
    }

    const rCoeffs = coeffs.slice(0, reactants.length);
    const pCoeffs = coeffs.slice(reactants.length);

    // Build balanced equation display string
    const rSide = reactants.map((f, i) => (rCoeffs[i] === 1 ? '' : rCoeffs[i]) + formulaToHTML(f)).join(' + ');
    const pSide = products.map((f, i)  => (pCoeffs[i] === 1 ? '' : pCoeffs[i]) + formulaToHTML(f)).join(' + ');
    const eqStr = rSide + ' → ' + pSide;

    // Collect all elements for verification table
    const elementSet = new Set();
    [...reactants, ...products].forEach(f => {
      try { Object.keys(parseFormula(f)).forEach(el => elementSet.add(el)); } catch(e) {}
    });
    const elements = [...elementSet];

    let html = `<h2>⚖️ Balanced Equation</h2>`;
    html += `<div class="equation-display">${eqStr}</div>`;

    // Coefficient table
    html += `<div class="results-section-title">Coefficients</div>`;
    html += `<table class="result-table"><thead><tr><th>Compound</th><th>Role</th><th>Coefficient</th></tr></thead><tbody>`;
    reactants.forEach((f, i) => {
      html += `<tr><td class="mono">${formulaToHTML(f)}</td><td><span class="result-badge red">Reactant</span></td><td class="num">${rCoeffs[i]}</td></tr>`;
    });
    products.forEach((f, i) => {
      html += `<tr><td class="mono">${formulaToHTML(f)}</td><td><span class="result-badge blue">Product</span></td><td class="num">${pCoeffs[i]}</td></tr>`;
    });
    html += `</tbody></table>`;

    // Atom balance verification
    html += `<div class="results-section-title">Atom Balance Verification</div>`;
    html += `<table class="result-table"><thead><tr><th>Element</th><th>Reactant Side</th><th>Product Side</th><th>Balanced?</th></tr></thead><tbody>`;
    let allBalanced = true;
    elements.forEach(el => {
      let rCount = 0, pCount = 0;
      reactants.forEach((f, i) => { try { rCount += (parseFormula(f)[el] || 0) * rCoeffs[i]; } catch(e) {} });
      products.forEach((f,  i) => { try { pCount += (parseFormula(f)[el] || 0) * pCoeffs[i]; } catch(e) {} });
      const balanced = rCount === pCount;
      if (!balanced) allBalanced = false;
      html += `<tr>
        <td><strong>${el}</strong></td>
        <td class="num">${rCount}</td>
        <td class="num">${pCount}</td>
        <td>${balanced ? '<span class="result-badge green">✓</span>' : '<span class="result-badge red">✗</span>'}</td>
      </tr>`;
    });
    html += `</tbody></table>`;

    if (allBalanced) {
      html += `<div class="answer-box"><span class="answer-label">Status</span><span class="result-badge green" style="font-size:14px;">✓ Equation is balanced</span></div>`;
    }

    resultsEl.innerHTML = html;
  }

  function clear() {
    const ta = document.getElementById('eb-equation');
    if (ta) { ta.value = ''; ta.focus(); }
    document.getElementById('eb-results').innerHTML =
      '<div class="placeholder-msg">⚖️ Type or paste an equation, then click <strong>Balance Equation</strong>.</div>';
  }

  function loadExample(key) {
    const ex = EXAMPLES[key];
    if (!ex) return;
    const ta = document.getElementById('eb-equation');
    if (ta) { ta.value = ex; balance(); }
  }

  return { init, balance, clear, loadExample };
})();

window.addEventListener('load', () => EqBalancer.init());// equation-balancer.js

const EqBalancer = (() => {
  let reactants = ['CH4', 'O2'];
  let products  = ['CO2', 'H2O'];

  const EXAMPLES = {
    combustion:    { r: ['CH4','O2'],           p: ['CO2','H2O'] },
    photosynthesis:{ r: ['CO2','H2O'],          p: ['C6H12O6','O2'] },
    ironrust:      { r: ['Fe','O2'],            p: ['Fe2O3'] },
    haber:         { r: ['N2','H2'],            p: ['NH3'] },
    thermite:      { r: ['Al','Fe2O3'],         p: ['Al2O3','Fe'] },
    aluminum:      { r: ['Al','O2'],            p: ['Al2O3'] },
  };

  function init() {
    fetch('equation-balancer.html')
      .then(r => r.text())
      .then(html => {
        loadTemplate('equation-balancer-container', html);
        rebuildLists();
      })
      .catch(() => {});
  }

  function rebuildLists() {
    const rList = document.getElementById('eb-reactants-list');
    const pList = document.getElementById('eb-products-list');
    if (!rList || !pList) return;

    rList.innerHTML = '';
    reactants.forEach((f, i) => {
      rList.appendChild(makeFormulaRow(f, 'reactant', i, (val, idx) => {
        reactants[idx] = val;
      }, (idx) => {
        if (reactants.length <= 1) { showAlert('Need at least 1 reactant.', true); return; }
        reactants.splice(idx, 1); rebuildLists();
      }));
    });

    pList.innerHTML = '';
    products.forEach((f, i) => {
      pList.appendChild(makeFormulaRow(f, 'product', i, (val, idx) => {
        products[idx] = val;
      }, (idx) => {
        if (products.length <= 1) { showAlert('Need at least 1 product.', true); return; }
        products.splice(idx, 1); rebuildLists();
      }));
    });
  }

  function makeFormulaRow(value, role, idx, onChange, onDelete) {
    const row = document.createElement('div');
    row.className = 'formula-row';
    const badge = document.createElement('span');
    badge.className = `role-badge ${role}`;
    badge.textContent = role === 'reactant' ? 'R' : 'P';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'formula-input';
    inp.value = value;
    inp.placeholder = role === 'reactant' ? 'e.g. H2O' : 'e.g. CO2';
    inp.autocomplete = 'off';
    inp.spellcheck = false;
    inp.addEventListener('input', () => onChange(inp.value.trim(), idx));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') EqBalancer.balance(); });
    const del = document.createElement('button');
    del.className = 'del-btn';
    del.textContent = '×';
    del.onclick = () => onDelete(idx);
    row.appendChild(badge);
    row.appendChild(inp);
    row.appendChild(del);
    return row;
  }

  function addReactant() { reactants.push(''); rebuildLists(); focusLast('eb-reactants-list'); }
  function addProduct()  { products.push('');  rebuildLists(); focusLast('eb-products-list'); }

  function focusLast(listId) {
    const list = document.getElementById(listId);
    if (!list) return;
    const inputs = list.querySelectorAll('input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }

  function balance() {
    // Read current values from DOM
    const rInputs = document.querySelectorAll('#eb-reactants-list input');
    const pInputs = document.querySelectorAll('#eb-products-list input');
    reactants = [...rInputs].map(i => i.value.trim()).filter(Boolean);
    products  = [...pInputs].map(i => i.value.trim()).filter(Boolean);

    if (reactants.length === 0 || products.length === 0) {
      showAlert('Need at least one reactant and one product.', true);
      return;
    }

    const resultsEl = document.getElementById('eb-results');
    let coeffs;
    try {
      coeffs = balanceEquation(reactants, products);
    } catch(e) {
      resultsEl.innerHTML = `<div class="placeholder-msg" style="color:#e74c3c;">⚠ ${e.message}</div>`;
      showAlert('Could not balance: ' + e.message, true);
      return;
    }

    const rCoeffs = coeffs.slice(0, reactants.length);
    const pCoeffs = coeffs.slice(reactants.length);

    // Build equation string
    const rSide = reactants.map((f, i) => (rCoeffs[i] === 1 ? '' : rCoeffs[i]) + formulaToHTML(f)).join(' + ');
    const pSide = products.map((f, i)  => (pCoeffs[i] === 1 ? '' : pCoeffs[i]) + formulaToHTML(f)).join(' + ');
    const eqStr = rSide + ' → ' + pSide;

    // Verification table
    const elementSet = new Set();
    const allFormulas = [...reactants, ...products];
    allFormulas.forEach(f => {
      try { Object.keys(parseFormula(f)).forEach(el => elementSet.add(el)); } catch(e) {}
    });
    const elements = [...elementSet];

    let html = `<h2>⚖️ Balanced Equation</h2>`;
    html += `<div class="equation-display">${eqStr}</div>`;

    // Coefficient table
    html += `<div class="results-section-title">Coefficients</div>`;
    html += `<table class="result-table"><thead><tr><th>Compound</th><th>Role</th><th>Coefficient</th></tr></thead><tbody>`;
    reactants.forEach((f, i) => {
      html += `<tr><td class="mono">${formulaToHTML(f)}</td><td><span class="result-badge red">Reactant</span></td><td class="num">${rCoeffs[i]}</td></tr>`;
    });
    products.forEach((f, i) => {
      html += `<tr><td class="mono">${formulaToHTML(f)}</td><td><span class="result-badge blue">Product</span></td><td class="num">${pCoeffs[i]}</td></tr>`;
    });
    html += `</tbody></table>`;

    // Atom balance verification
    html += `<div class="results-section-title">Atom Balance Verification</div>`;
    html += `<table class="result-table"><thead><tr><th>Element</th><th>Reactant Side</th><th>Product Side</th><th>Balanced?</th></tr></thead><tbody>`;
    let allBalanced = true;
    elements.forEach(el => {
      let rCount = 0, pCount = 0;
      reactants.forEach((f, i) => {
        try { rCount += (parseFormula(f)[el] || 0) * rCoeffs[i]; } catch(e) {}
      });
      products.forEach((f, i) => {
        try { pCount += (parseFormula(f)[el] || 0) * pCoeffs[i]; } catch(e) {}
      });
      const balanced = rCount === pCount;
      if (!balanced) allBalanced = false;
      html += `<tr>
        <td><strong>${el}</strong></td>
        <td class="num">${rCount}</td>
        <td class="num">${pCount}</td>
        <td>${balanced ? '<span class="result-badge green">✓</span>' : '<span class="result-badge red">✗</span>'}</td>
      </tr>`;
    });
    html += `</tbody></table>`;

    if (allBalanced) {
      html += `<div class="answer-box"><span class="answer-label">Status</span><span class="result-badge green" style="font-size:14px;">✓ Equation is balanced</span></div>`;
    }

    resultsEl.innerHTML = html;
  }

  function clear() {
    reactants = ['', ''];
    products  = [''];
    rebuildLists();
    document.getElementById('eb-results').innerHTML =
      '<div class="placeholder-msg">⚖️ Add reactants and products, then click <strong>Balance Equation</strong>.</div>';
  }

  function loadExample(key) {
    const ex = EXAMPLES[key];
    if (!ex) return;
    reactants = [...ex.r];
    products  = [...ex.p];
    rebuildLists();
    balance();
  }

  return { init, balance, clear, addReactant, addProduct, loadExample };
})();

window.addEventListener('load', () => EqBalancer.init());
