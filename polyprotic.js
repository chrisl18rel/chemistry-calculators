// polyprotic.js
// Polyprotic acid/base pH, buffer, and titration — full multi-equilibrium solver
// Salt mass calculator using molar masses from formula-parser.js

const Polyprotic = (() => {

  // ── CONSTANTS ──
  const Kw = 1.0e-14;

  // ── HELPERS (local copies so this module is self-contained) ──
  function fmt2(n) { return n.toFixed(2); }
  function fmt4(n) { return n.toFixed(4); }
  function sci(n)  { return n.toExponential(3); }
  function stepLine(n, text) {
    return `<div style="display:flex;gap:8px;margin:8px 0 4px;">
      <div style="background:#1a56a8;color:#fff;border-radius:50%;width:20px;height:20px;
        font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;
        flex-shrink:0;margin-top:1px;">${n}</div>
      <div style="font-size:13px;color:#222;line-height:1.6;">${text}</div></div>`;
  }
  function eq(text) {
    return `<div style="background:#f0f4ff;border-left:3px solid #4a90e2;padding:6px 12px;
      margin:3px 0 3px 28px;font-family:'Courier New',monospace;font-size:12px;color:#1a2a4a;">${text}</div>`;
  }
  function note(text, color) {
    return `<div style="background:${color}11;border-left:3px solid ${color};padding:6px 12px;
      margin:4px 0 4px 28px;font-size:12px;color:#333;">${text}</div>`;
  }
  function subH(text) { // section header
    return `<div style="font-size:12px;font-weight:700;color:#1a56a8;margin:12px 0 4px;
      border-bottom:1px solid #dde3f0;padding-bottom:3px;">${text}</div>`;
  }
  function renderResults(title, boxHTML, stepsHTML) {
    const el = document.getElementById('ph-results');
    if (!el) return;
    el.innerHTML = `
      <h2 style="margin-bottom:12px;font-size:18px;color:#1a2a4a;">${title}</h2>
      ${boxHTML}
      <div class="results-section-title">Step-by-Step Work</div>
      <div style="padding:8px 0;">${stepsHTML}</div>`;
  }
  function resultsBox(items) {
    const cells = items.map(([lbl, val, unit]) => `
      <div style="text-align:center;padding:10px 8px;">
        <div style="font-size:10px;color:#888;font-weight:700;text-transform:uppercase;margin-bottom:4px;">${lbl}</div>
        <div style="font-size:20px;font-weight:700;color:#1a2a4a;">${val}</div>
        ${unit ? `<div style="font-size:10px;color:#888;">${unit}</div>` : ''}
      </div>`).join('');
    return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));
      gap:4px;background:#f8f9ff;border:1px solid #dde3f0;border-radius:6px;
      margin-bottom:14px;">${cells}</div>`;
  }

  // ── SHOWREQUIRED ──
  function req(val, label) {
    if (isNaN(val) || val === null || val === undefined)
      throw new Error(`Enter a value for: ${label}`);
    if (val <= 0) throw new Error(`${label} must be positive`);
    return val;
  }

  // ── FULL MULTI-EQUILIBRIUM SOLVER ──
  // Solves the charge balance equation for a polyprotic acid H_nA
  // given concentrations Ca (acid) and Cs (salt / conjugate base)
  // and array of Ka values [Ka1, Ka2, ..., Kan].
  //
  // Charge balance: [H+] + [Na+] = [OH-] + sum of anionic species
  // Uses Newton-Raphson on f([H+]) = 0.
  //
  // Returns { h, pH, fractions: [alpha0..alphaN] }

  function alphaFractions(h, Kas) {
    // alpha_i = fraction of acid species with i protons removed
    // Denominator D = [H+]^n + Ka1[H+]^(n-1) + Ka1*Ka2*[H+]^(n-2) + ...
    const n = Kas.length;
    const terms = new Array(n + 1);
    terms[0] = 1;
    for (let i = 0; i < n; i++) {
      terms[i + 1] = terms[i] * Kas[i] / h;
    }
    let D = 0;
    for (let i = 0; i <= n; i++) D += terms[i];
    return terms.map(t => t / D);
  }

  function solveMultiEquil(Ca, Cs, Kas, Cb_strong_base, C_strong_acid) {
    // Ca  = total acid concentration [H_n A] added
    // Cs  = total conjugate base concentration [Na_n A] added (if any)
    // Kas = [Ka1, Ka2, ..., Kan]
    // Cb_strong_base = concentration of strong base added (e.g. NaOH)
    // C_strong_acid  = concentration of strong acid added (e.g. HCl)
    const n    = Kas.length;
    const CT   = Ca + Cs; // total analyte concentration
    const Cb   = (Cb_strong_base || 0) - (C_strong_acid || 0); // net base excess

    // f(h) = [H+] + sum_i(i * alpha_i * CT) - [OH-] - n*CT*alpha_0 - ... 
    // Better form using charge balance:
    // f(h) = [H+] - Kw/h + sum_{i=1}^{n}(i * alpha_i * CT) - Cs - Cb
    function f(h) {
      if (h <= 0) return Infinity;
      const alpha = alphaFractions(h, Kas);
      let chargeFromAcid = 0;
      for (let i = 1; i <= n; i++) chargeFromAcid += i * alpha[i] * CT;
      return h - Kw / h - chargeFromAcid - Cs - Cb;
    }

    function df(h) {
      return (f(h * 1.0001) - f(h * 0.9999)) / (h * 0.0002);
    }

    // Newton-Raphson with bisection fallback
    // Bracket between h=1e-14 and h=1
    let lo = 1e-15, hi = 1.0;
    // Ensure bracket
    let flo = f(lo), fhi = f(hi);
    if (flo * fhi > 0) {
      // Try wider
      hi = 10; fhi = f(hi);
    }

    let h = Math.pow(10, -(7 + (Cs - Ca) / (CT + 0.001))); // initial guess
    if (h <= 0 || !isFinite(h)) h = 1e-7;

    for (let iter = 0; iter < 200; iter++) {
      const fh = f(h);
      if (Math.abs(fh) < 1e-15) break;
      const dh = -fh / df(h);
      let hn = h + dh;
      // Keep positive
      if (hn <= 0 || !isFinite(hn)) hn = h / 10;
      // Bisect if Newton step goes out of bracket
      if (f(lo) * f(hn) > 0 && f(hn) * f(hi) > 0) {
        hn = Math.sqrt(lo * hi); // geometric midpoint
      }
      if (f(lo) * f(hn) < 0) hi = hn;
      else lo = hn;
      h = hn;
    }

    const alpha = alphaFractions(h, Kas);
    return { h, pH: -Math.log10(h), alpha };
  }

  // ── SPECIES CONCENTRATIONS from alpha fractions ──
  function speciesConc(CT, alpha) {
    return alpha.map(a => a * CT);
  }

  // ── INPUT TEMPLATE ──
  function polyproticInputs() {
    return `
      ${selectField('pp-mode', 'What to calculate', [
        ['ph',       'pH of polyprotic acid/base solution'],
        ['buffer',   'pH of polyprotic buffer'],
        ['mass',     'Mass of salt needed for target pH'],
        ['titration','Polyprotic titration curve'],
      ], 'Polyprotic.modeSwitch()')}
      <div id="pp-mode-fields"></div>`;
  }

  function selectField(id, label, options, onchange) {
    const opts = options.map(([v,t]) => `<option value="${v}">${t}</option>`).join('');
    return `<div style="margin-bottom:10px;">
      <label class="stoi-lbl">${label}</label>
      <select id="${id}" class="stoi-select" style="width:100%;box-sizing:border-box;"
        ${onchange ? `onchange="${onchange}"` : ''}>${opts}</select></div>`;
  }
  function numField(id, label, ph, note2) {
    return `<div style="margin-bottom:10px;">
      <label class="stoi-lbl">${label}</label>
      <input type="number" id="${id}" min="0" step="any" placeholder="${ph}"
        class="stoi-num-input" style="width:100%;box-sizing:border-box;" />
      ${note2 ? `<div class="mini-note">${note2}</div>` : ''}</div>`;
  }
  function textField(id, label, ph, note2) {
    return `<div style="margin-bottom:10px;">
      <label class="stoi-lbl">${label}</label>
      <input type="text" id="${id}" placeholder="${ph}"
        class="formula-input" style="width:100%;box-sizing:border-box;" />
      ${note2 ? `<div class="mini-note">${note2}</div>` : ''}</div>`;
  }

  function modeSwitch() {
    const mode = document.getElementById('pp-mode')?.value;
    const c = document.getElementById('pp-mode-fields');
    if (!c) return;

    const kaFields = (n) => {
      let html = '';
      for (let i = 1; i <= n; i++) {
        html += numField(`pp-ka${i}`, `Ka${i}`, `e.g. ${i===1?'7.5e-3':i===2?'6.2e-8':'4.8e-13'}`);
      }
      return html;
    };

    const nProtonsField = `
      <div style="margin-bottom:10px;">
        <label class="stoi-lbl">Number of ionizable protons (n)</label>
        <select id="pp-n" class="stoi-select" style="width:100%;box-sizing:border-box;"
          onchange="Polyprotic.updateKaFields()">
          <option value="2">2 (diprotic, e.g. H₂CO₃, H₂SO₃)</option>
          <option value="3">3 (triprotic, e.g. H₃PO₄, citric acid)</option>
        </select>
      </div>
      <div id="pp-ka-fields"></div>`;

    if (mode === 'ph') {
      c.innerHTML = `
        <div class="display-divider"></div>
        ${textField('pp-formula', 'Acid formula (optional — for molar mass)', 'e.g. H3PO4', 'Used to calculate mass. Leave blank to skip.')}
        ${nProtonsField}
        ${numField('pp-conc', 'Acid concentration (mol/L)', 'e.g. 0.100')}
        <div class="mini-note" style="margin-bottom:6px;">Optionally add a conjugate base (e.g. Na₂HPO₄):</div>
        ${numField('pp-conc-base', 'Conjugate base concentration (mol/L)', '0 if none')}
        <div style="margin-bottom:6px;">
          <label class="stoi-lbl">Conjugate base is the</label>
          <select id="pp-conj-form" class="stoi-select" style="width:100%;box-sizing:border-box;">
            <option value="1">Partially deprotonated once (HA⁻, e.g. NaHCO₃)</option>
            <option value="2">Fully deprotonated (A²⁻, e.g. Na₂CO₃)</option>
          </select>
        </div>`;
      updateKaFields();
    } else if (mode === 'buffer') {
      c.innerHTML = `
        <div class="display-divider"></div>
        ${textField('pp-formula-a', 'Acid formula (optional)', 'e.g. H3PO4')}
        ${textField('pp-formula-b', 'Salt formula (optional)', 'e.g. NaH2PO4')}
        ${nProtonsField}
        ${numField('pp-buf-acid', 'Moles (or mol/L) of weak acid form', 'e.g. 0.100')}
        ${numField('pp-buf-base', 'Moles (or mol/L) of conjugate base form', 'e.g. 0.100')}
        <div style="margin-bottom:6px;">
          <label class="stoi-lbl">Buffer is in the</label>
          <select id="pp-buf-step" class="stoi-select" style="width:100%;box-sizing:border-box;">
            <option value="1">Step 1 region (H₂A / HA⁻)</option>
            <option value="2">Step 2 region (HA⁻ / A²⁻)</option>
            <option value="3">Step 3 region (H₂A²⁻ / A³⁻)</option>
          </select>
        </div>`;
      updateKaFields();
    } else if (mode === 'mass') {
      c.innerHTML = `
        <div class="display-divider"></div>
        <div class="mini-note" style="margin-bottom:6px;line-height:1.5;">
          Enter formulas for both the acid and salt forms to calculate how many grams of each
          to dissolve to make a buffer at a target pH and volume.
        </div>
        ${textField('pp-mass-acid-formula', 'Acid formula', 'e.g. H3PO4')}
        ${textField('pp-mass-salt-formula', 'Salt formula', 'e.g. NaH2PO4')}
        ${nProtonsField}
        <div style="margin-bottom:6px;">
          <label class="stoi-lbl">Target buffer step</label>
          <select id="pp-mass-step" class="stoi-select" style="width:100%;box-sizing:border-box;">
            <option value="1">Step 1 (H₂A / HA⁻, use Ka1)</option>
            <option value="2">Step 2 (HA⁻ / A²⁻, use Ka2)</option>
            <option value="3">Step 3 (H₂A²⁻ / A³⁻, use Ka3)</option>
          </select>
        </div>
        ${numField('pp-mass-ph', 'Target pH', 'e.g. 7.20')}
        ${numField('pp-mass-vol', 'Buffer volume (mL)', 'e.g. 500')}
        ${numField('pp-mass-total-conc', 'Total buffer concentration (mol/L)', 'e.g. 0.100', 'Total of acid + salt forms')}`;
      updateKaFields();
    } else if (mode === 'titration') {
      c.innerHTML = `
        <div class="display-divider"></div>
        ${textField('pp-tit-formula', 'Acid formula (optional)', 'e.g. H3PO4')}
        ${nProtonsField}
        ${numField('pp-tit-conc', 'Analyte concentration (mol/L)', 'e.g. 0.100')}
        ${numField('pp-tit-vol', 'Analyte volume (mL)', 'e.g. 25.0')}
        ${numField('pp-tit-titrant', 'Titrant (strong base) concentration (mol/L)', 'e.g. 0.100')}
        ${numField('pp-tit-maxvol', 'Max titrant volume to plot (mL)', '100')}`;
      updateKaFields();
    }
  }

  function updateKaFields() {
    const n = parseInt(document.getElementById('pp-n')?.value) || 2;
    const c = document.getElementById('pp-ka-fields');
    if (!c) return;
    let html = '';
    for (let i = 1; i <= n; i++) {
      html += numField(`pp-ka${i}`, `Ka${i}`, i===1?'e.g. 7.5e-3':i===2?'e.g. 6.2e-8':'e.g. 4.8e-13');
    }
    c.innerHTML = html;
  }

  // ── READ Ka ARRAY ──
  function readKas() {
    const n = parseInt(document.getElementById('pp-n')?.value) || 2;
    const Kas = [];
    for (let i = 1; i <= n; i++) {
      const v = parseFloat(document.getElementById(`pp-ka${i}`)?.value);
      if (isNaN(v) || v <= 0) throw new Error(`Enter Ka${i}`);
      if (i > 1 && v >= Kas[i-2]) throw new Error(`Ka${i} must be smaller than Ka${i-1} (Ka values decrease with each step)`);
      Kas.push(v);
    }
    return Kas;
  }

  // ── GET MOLAR MASS (calls formula-parser.js) ──
  function getMolarMass(formula) {
    if (!formula || !formula.trim()) return null;
    try {
      return computeMolarMass(formula.trim());
    } catch(e) {
      return null;
    }
  }

  // ── SPECIES NAMES HELPER ──
  function speciesNames(n) {
    const names = [];
    const sups = ['', '⁻', '²⁻', '³⁻', '⁴⁻'];
    names.push(`H${n > 1 ? (n === 2 ? '₂' : '₃') : ''}A`);
    for (let i = 1; i < n; i++) {
      const hLeft = n - i;
      names.push(`H${hLeft > 1 ? (hLeft === 2 ? '₂' : '₃') : ''}A${sups[i]}`);
    }
    names.push(`A${sups[n]}`);
    return names;
  }

  // ── FRACTION TABLE HTML ──
  function fractionTable(species, alpha, CT) {
    const rows = species.map((s, i) => {
      const c = alpha[i] * CT;
      return `<tr>
        <td style="padding:5px 10px;font-family:'Courier New',monospace;">${s}</td>
        <td style="padding:5px 10px;text-align:center;">${(alpha[i]*100).toFixed(3)}%</td>
        <td style="padding:5px 10px;text-align:center;font-weight:700;color:#1a56a8;">${sci(c)} M</td>
      </tr>`;
    }).join('');
    return `<table style="border-collapse:collapse;margin:4px 0 8px 28px;font-size:12px;border:1px solid #dde3f0;">
      <thead><tr>
        <th style="padding:6px 10px;background:#e8f0fb;color:#1a2a4a;">Species</th>
        <th style="padding:6px 10px;background:#e8f0fb;color:#1a2a4a;">α (fraction)</th>
        <th style="padding:6px 10px;background:#e8f0fb;color:#1a2a4a;">Concentration</th>
      </tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  // ── CALCULATE pH of polyprotic solution ──
  function calcPolyproticPH() {
    const Kas  = readKas();
    const n    = Kas.length;
    const Ca   = req(parseFloat(document.getElementById('pp-conc')?.value), 'Acid concentration');
    const CbRaw = parseFloat(document.getElementById('pp-conc-base')?.value) || 0;
    const conjForm = parseInt(document.getElementById('pp-conj-form')?.value) || 1;

    // Cs represents additional anionic charge equivalent
    // If user added HA⁻ (form 1), equivalent to adding 1 mole of deprotonated per mole
    // If user added A²⁻ (form 2), equivalent to 2 moles deprotonated per mole
    // We encode this as Cs = CbRaw * conjForm (net deprotonation equivalent as base)
    const Cs   = CbRaw * conjForm;
    const CT   = Ca + CbRaw;

    const formula = document.getElementById('pp-formula')?.value?.trim() || '';
    const MM = getMolarMass(formula);

    const { h, pH, alpha } = solveMultiEquil(CT, 0, Kas, Cs / CT * 0, 0);

    // Actually use the proper model: Ca moles of H_nA, Cs moles of conjugate
    const result = solveMultiEquil(Ca, CbRaw, Kas, 0, 0);
    const h2 = result.h, pH2 = result.pH, alpha2 = result.alpha;

    const pOH  = 14 - pH2;
    const oh   = Kw / h2;
    const species = speciesNames(n);

    const pKas = Kas.map(k => -Math.log10(k));

    const steps = [
      subH('System Setup'),
      stepLine(1, `Polyprotic acid with <strong>n = ${n}</strong> ionizable proton${n>1?'s':''}. `
        + `Acid concentration: <strong>${Ca} mol/L</strong>`
        + (CbRaw ? `, conjugate base: <strong>${CbRaw} mol/L</strong>` : '') + '.'),
      stepLine(2, 'Equilibrium constants and pKa values:'),
      ...Kas.map((Ka, i) => eq(`Ka${i+1} = ${Ka.toExponential(4)} &nbsp;→&nbsp; pKa${i+1} = ${fmt2(pKas[i])}`)),
      subH('Full Multi-Equilibrium Charge Balance'),
      stepLine(3, 'The charge balance equation (cannot be simplified for polyprotic systems):'),
      eq('[H⁺] + [cations] = [OH⁻] + Σᵢ i·αᵢ·C_T'),
      stepLine(4, 'where αᵢ is the fraction of the acid in form i (losing i protons), given by:'),
      eq('αᵢ = (Ka₁Ka₂…Kaᵢ / [H⁺]ⁱ) / D(h)'),
      eq('D(h) = [H⁺]ⁿ + Ka₁[H⁺]ⁿ⁻¹ + Ka₁Ka₂[H⁺]ⁿ⁻² + … + Ka₁Ka₂…Kaₙ'),
      stepLine(5, 'Newton–Raphson iteration solves for [H⁺] such that the charge balance = 0.'),
      subH('Solution'),
      stepLine(6, `Converged to: [H⁺] = ${sci(h2)} M`),
      eq(`pH = −log(${sci(h2)}) = <strong>${fmt2(pH2)}</strong>`),
      eq(`pOH = 14.00 − ${fmt2(pH2)} = ${fmt2(pOH)}`),
      eq(`[OH⁻] = ${sci(oh)} M`),
      subH('Species Distribution at Equilibrium'),
      stepLine(7, `Fraction of each species at pH = ${fmt2(pH2)}:`),
      fractionTable(species, alpha2, CT),
      subH('pKa Comparison'),
      stepLine(8, 'Buffer regions are centered at each pKa:'),
      ...pKas.map((pk, i) => {
        const inRange = Math.abs(pH2 - pk) < 1;
        return eq(`pKa${i+1} = ${fmt2(pk)} ${inRange ? ' ← pH is near this pKa (buffer region!)' : ''}`);
      }),
      ...(MM ? [
        subH('Molar Mass'),
        stepLine(9, `Molar mass of ${formula}: <strong>${MM.toFixed(3)} g/mol</strong>`),
        eq(`For ${Ca} mol/L in 1 L: mass = ${Ca} × ${MM.toFixed(3)} = ${(Ca * MM).toFixed(3)} g`),
      ] : []),
    ].join('');

    renderResults('Polyprotic Acid pH', resultsBox([
      ['pH', fmt2(pH2), ''],
      ['pOH', fmt2(pOH), ''],
      ['[H₃O⁺]', sci(h2), 'mol/L'],
      ['[OH⁻]', sci(oh), 'mol/L'],
      ...Kas.map((Ka, i) => [`pKa${i+1}`, fmt2(pKas[i]), '']),
    ]), steps);
  }

  // ── POLYPROTIC BUFFER pH ──
  function calcPolyproticBuffer() {
    const Kas  = readKas();
    const n    = Kas.length;
    const step = parseInt(document.getElementById('pp-buf-step')?.value) || 1;
    const acid = req(parseFloat(document.getElementById('pp-buf-acid')?.value), 'Acid form amount');
    const base = req(parseFloat(document.getElementById('pp-buf-base')?.value), 'Conjugate base amount');
    const formulaA = document.getElementById('pp-formula-a')?.value?.trim() || '';
    const formulaB = document.getElementById('pp-formula-b')?.value?.trim() || '';
    const MMA = getMolarMass(formulaA);
    const MMB = getMolarMass(formulaB);

    if (step > n) throw new Error(`Step ${step} requires Ka${step}, but only ${n} Ka value${n>1?'s were':'was'} entered.`);
    const Ka = Kas[step - 1];
    const pKa = -Math.log10(Ka);

    // Full multi-equilibrium solution
    // Model: Ca = acid moles in step (e.g. H₂PO₄⁻ for step 2), Cs = base moles (e.g. HPO₄²⁻)
    // The prior proton dissociations are complete; we treat the step-specific pair
    // We use the full solver treating the pair as a monoprotic-equivalent but validate with full system
    const CT = acid + base;
    const ratio = base / acid;
    const pHhh = pKa + Math.log10(ratio);

    // Full multi-equilibrium: set up so the step-specific species are dominant
    // Build effective Ca/Cs for the full system based on which step we're in
    // For step k: the dominant species are H_{n-k+1}A^{(k-1)-} and H_{n-k}A^{k-}
    // We approximate the full system contribution by using the full solver
    // with equivalent total concentration
    const result = solveMultiEquil(acid, base, Kas, 0, 0);
    const h = result.h;
    const pH = result.pH;
    const alpha = result.alpha;
    const pOH = 14 - pH;
    const oh  = Kw / h;
    const species = speciesNames(n);
    const pKas = Kas.map(k => -Math.log10(k));

    // Henderson-Hasselbalch approximation for comparison
    const steps = [
      subH('Buffer Identification'),
      stepLine(1, `Polyprotic buffer in <strong>Step ${step}</strong> region.`
        + ` Using Ka${step} = ${Ka.toExponential(4)}, pKa${step} = ${fmt2(pKa)}.`),
      stepLine(2, 'Acid/base pair for this buffer step:'),
      eq(`Acid form: ${species[step-1]} &nbsp;&nbsp; Base form: ${species[step]}`),
      eq(`Amounts — acid: ${acid} mol (or mol/L), base: ${base} mol (or mol/L)`),
      subH('Henderson–Hasselbalch Approximation (single step)'),
      stepLine(3, 'Applying H–H to the dominant buffer step for comparison:'),
      eq(`pH ≈ pKa${step} + log([base]/[acid])`),
      eq(`pH ≈ ${fmt2(pKa)} + log(${base} / ${acid})`),
      eq(`pH ≈ ${fmt2(pKa)} + log(${fmt4(ratio)}) = ${fmt2(pKa)} + (${fmt2(Math.log10(ratio))}) ≈ <strong>${fmt2(pHhh)}</strong>`),
      subH('Full Multi-Equilibrium Solution'),
      stepLine(4, 'Newton–Raphson charge balance includes all ionization steps simultaneously:'),
      eq(`f([H⁺]) = [H⁺] − Kw/[H⁺] − Σᵢ i·αᵢ·C_T − [base] = 0`),
      stepLine(5, `Converged: [H⁺] = ${sci(h)}`),
      eq(`pH (full multi-equilibrium) = <strong>${fmt2(pH)}</strong>`),
      eq(`Difference from H–H approximation: ${fmt2(Math.abs(pH - pHhh))} pH units`),
      note(Math.abs(pH - pHhh) < 0.05
        ? '✓ H–H approximation is excellent here (error < 0.05 pH units).'
        : '⚠ Significant difference — adjacent pKa values are close enough that cross-step equilibria matter.',
        Math.abs(pH - pHhh) < 0.05 ? '#2e7d32' : '#b71c1c'),
      subH('Species Distribution'),
      stepLine(6, 'Concentration of each species at equilibrium:'),
      fractionTable(species, alpha, CT),
      subH('pKa Ladder'),
      ...pKas.map((pk, i) => {
        const active = i + 1 === step;
        return eq(`pKa${i+1} = ${fmt2(pk)}${active ? ' ← active buffer step' : ''}`);
      }),
      ...(ratio >= 0.1 && ratio <= 10
        ? [note('✓ Ratio is within 0.1–10. Buffer has good capacity.', '#2e7d32')]
        : [note('⚠ Ratio outside 0.1–10. Buffer capacity is reduced.', '#b71c1c')]),
      ...(MMA ? [
        subH('Molar Masses'),
        stepLine(7, `${formulaA}: <strong>${MMA.toFixed(3)} g/mol</strong>`),
        ...(MMB ? [eq(`${formulaB}: ${MMB.toFixed(3)} g/mol`)] : []),
      ] : []),
    ].join('');

    renderResults('Polyprotic Buffer pH', resultsBox([
      ['pH (full)', fmt2(pH), ''],
      ['pH (H–H)', fmt2(pHhh), ''],
      ['Δ error', fmt2(Math.abs(pH - pHhh)), 'pH units'],
      ['pOH', fmt2(pOH), ''],
      [`pKa${step}`, fmt2(pKa), ''],
      ['Ratio', fmt4(ratio), '[base]/[acid]'],
    ]), steps);
  }

  // ── SALT MASS CALCULATOR ──
  function calcSaltMass() {
    const Kas   = readKas();
    const n     = Kas.length;
    const step  = parseInt(document.getElementById('pp-mass-step')?.value) || 1;
    const targetPH  = req(parseFloat(document.getElementById('pp-mass-ph')?.value), 'Target pH');
    const volML = req(parseFloat(document.getElementById('pp-mass-vol')?.value), 'Buffer volume');
    const CT    = req(parseFloat(document.getElementById('pp-mass-total-conc')?.value), 'Total buffer concentration');
    const acidFormula = document.getElementById('pp-mass-acid-formula')?.value?.trim() || '';
    const saltFormula = document.getElementById('pp-mass-salt-formula')?.value?.trim() || '';

    if (step > n) throw new Error(`Step ${step} requires Ka${step}, but only ${n} Ka value${n>1?'s were':'was'} entered.`);
    const Ka  = Kas[step - 1];
    const pKa = -Math.log10(Ka);

    // H–H rearranged: ratio = 10^(pH - pKa)
    const logR = targetPH - pKa;
    const ratio = Math.pow(10, logR); // [base] / [acid]
    // CT = [acid] + [base] => [acid] = CT / (1 + ratio), [base] = CT * ratio / (1 + ratio)
    const Cacid = CT / (1 + ratio);
    const Cbase = CT * ratio / (1 + ratio);
    const volL  = volML / 1000;
    const molAcid = Cacid * volL;
    const molBase = Cbase * volL;

    const MMA = getMolarMass(acidFormula);
    const MMB = getMolarMass(saltFormula);
    const massAcid = MMA ? molAcid * MMA : null;
    const massBase = MMB ? molBase * MMB : null;

    const species = speciesNames(n);
    const pKas = Kas.map(k => -Math.log10(k));

    // Verify with full solver
    const check = solveMultiEquil(Cacid, Cbase, Kas, 0, 0);
    const pHcheck = check.pH;

    const steps = [
      subH('Target Setup'),
      stepLine(1, `Target pH = <strong>${fmt2(targetPH)}</strong>, volume = ${volML} mL, `
        + `total buffer concentration = ${CT} mol/L.`),
      stepLine(2, `Using Ka${step} = ${Ka.toExponential(4)}, pKa${step} = ${fmt2(pKa)}.`),
      stepLine(3, 'Verify target pH is achievable — check against all pKa values:'),
      ...pKas.map((pk, i) => {
        const dist = Math.abs(targetPH - pk);
        const ok   = dist <= 1;
        return eq(`pKa${i+1} = ${fmt2(pk)} &nbsp;|&nbsp; |pH − pKa${i+1}| = ${fmt2(dist)} ${ok ? '✓ good buffer range' : '(outside ±1 from this pKa)'}`);
      }),
      subH('Henderson–Hasselbalch Rearranged'),
      stepLine(4, 'Rearrange H–H to find the required ratio:'),
      eq(`pH = pKa${step} + log([A⁻] / [HA])`),
      eq(`log([A⁻] / [HA]) = ${fmt2(targetPH)} − ${fmt2(pKa)} = ${fmt2(logR)}`),
      eq(`[A⁻] / [HA] = 10^${fmt2(logR)} = <strong>${fmt4(ratio)}</strong>`),
      subH('Concentrations from Total'),
      stepLine(5, `Total [acid] + [base] = ${CT} mol/L:`),
      eq(`[HA] = C_T / (1 + ratio) = ${CT} / (1 + ${fmt4(ratio)}) = ${fmt4(Cacid)} mol/L`),
      eq(`[A⁻] = C_T × ratio / (1 + ratio) = ${fmt4(Cbase)} mol/L`),
      subH('Moles Needed'),
      stepLine(6, `For ${volML} mL = ${volL} L:`),
      eq(`moles of acid form (${species[step-1]}): ${fmt4(Cacid)} × ${volL} = <strong>${fmt4(molAcid)} mol</strong>`),
      eq(`moles of salt form (${species[step]}): ${fmt4(Cbase)} × ${volL} = <strong>${fmt4(molBase)} mol</strong>`),
      ...(MMA ? [
        subH('Mass to Weigh Out'),
        stepLine(7, `Molar mass of ${acidFormula}: ${MMA.toFixed(3)} g/mol`),
        eq(`mass of acid = ${fmt4(molAcid)} mol × ${MMA.toFixed(3)} g/mol = <strong>${(molAcid * MMA).toFixed(3)} g</strong>`),
        ...(MMB ? [
          eq(`Molar mass of ${saltFormula}: ${MMB.toFixed(3)} g/mol`),
          eq(`mass of salt = ${fmt4(molBase)} mol × ${MMB.toFixed(3)} g/mol = <strong>${(molBase * MMB).toFixed(3)} g</strong>`),
        ] : []),
      ] : [note('Enter formulas above to calculate masses.', '#1a56a8')]),
      subH('Verification — Full Multi-Equilibrium'),
      stepLine(8, `Cross-check: solving the full charge balance at these concentrations gives pH = <strong>${fmt2(pHcheck)}</strong>.`),
      eq(`Target pH: ${fmt2(targetPH)} &nbsp;|&nbsp; Full solver pH: ${fmt2(pHcheck)} &nbsp;|&nbsp; Error: ${fmt2(Math.abs(pHcheck - targetPH))} units`),
      note(Math.abs(pHcheck - targetPH) < 0.05
        ? '✓ Excellent agreement. The buffer will hit the target pH.'
        : `⚠ ${fmt2(Math.abs(pHcheck - targetPH))} pH unit discrepancy from adjacent equilibria. Actual pH may differ slightly from target.`,
        Math.abs(pHcheck - targetPH) < 0.05 ? '#2e7d32' : '#f39c12'),
    ].join('');

    renderResults('Polyprotic Buffer — Salt Mass Calculator', resultsBox([
      ['Target pH', fmt2(targetPH), ''],
      ['Full solver pH', fmt2(pHcheck), ''],
      ['mol acid form', fmt4(molAcid), 'mol'],
      ['mol salt form', fmt4(molBase), 'mol'],
      ...(massAcid !== null ? [['mass acid', (molAcid * MMA).toFixed(3), 'g']] : []),
      ...(massBase !== null ? [['mass salt', (molBase * MMB).toFixed(3), 'g']] : []),
    ]), steps);
  }

  // ── POLYPROTIC TITRATION CURVE ──
  // Titrates H_nA with strong base NaOH.
  // At volume v of titrant added, total moles of OH⁻ added = (tConc * v / 1000)
  // This converts acid to conjugate forms progressively.
  // We use the full multi-equilibrium solver at each point.

  function calcPolyproticTitration() {
    const Kas    = readKas();
    const n      = Kas.length;
    const Ca     = req(parseFloat(document.getElementById('pp-tit-conc')?.value), 'Analyte concentration');
    const aVol   = req(parseFloat(document.getElementById('pp-tit-vol')?.value), 'Analyte volume');
    const tConc  = req(parseFloat(document.getElementById('pp-tit-titrant')?.value), 'Titrant concentration');
    const maxVol = parseFloat(document.getElementById('pp-tit-maxvol')?.value) || 100;
    const formulaA = document.getElementById('pp-tit-formula')?.value?.trim() || '';

    const molesA = Ca * aVol / 1000;
    const pKas   = Kas.map(k => -Math.log10(k));

    // Equivalence points: at n*molesA total base added
    // Each equiv point at molesA, 2*molesA, ... n*molesA
    const equivVols = [];
    for (let i = 1; i <= n; i++) equivVols.push((i * molesA / tConc) * 1000);

    // Generate curve
    const points = [];
    const numPts = 300;
    for (let j = 0; j <= numPts; j++) {
      const v = (j / numPts) * maxVol;
      const pH = polyproticTitrationPH(v, Ca, aVol, tConc, Kas, n);
      if (pH !== null && isFinite(pH)) points.push({ x: v, y: Math.min(Math.max(pH, 0), 14) });
    }

    // Key pH values
    const pHInit = polyproticTitrationPH(0, Ca, aVol, tConc, Kas, n);
    const equivPHs = equivVols.map(v => polyproticTitrationPH(Math.min(v, maxVol), Ca, aVol, tConc, Kas, n));
    const halfPHs  = equivVols.map((v, i) => {
      const prevV = i === 0 ? 0 : equivVols[i-1];
      const halfV = (prevV + v) / 2;
      return halfV <= maxVol ? polyproticTitrationPH(halfV, Ca, aVol, tConc, Kas, n) : null;
    });

    renderPolyproticTitration(points, equivVols, pHInit, equivPHs, halfPHs, pKas, Kas, n, molesA, aVol, tConc, formulaA, Ca, maxVol);
  }

  function polyproticTitrationPH(tVolML, Ca, aVolML, tConc, Kas, n) {
    const molesT = tConc * tVolML / 1000;
    const molesA = Ca * aVolML / 1000;
    const totalVolL = (aVolML + tVolML) / 1000;
    const CT = molesA / totalVolL;

    // Fraction of acid neutralised
    const frac = molesT / molesA;

    if (frac <= 0) {
      // Pure acid
      const r = solveMultiEquil(CT, 0, Kas, 0, 0);
      return r.pH;
    }

    if (frac >= n + 0.5) {
      // Far excess base
      const excessOH = (molesT - n * molesA) / totalVolL;
      return 14 + Math.log10(excessOH);
    }

    // Between i-1 and i equivalence points: mixture of H_{n-i+1}A^{(i-1)-} and H_{n-i}A^{i-}
    // Total moles of original acid = molesA; moles of base added = molesT
    // After i full equiv points, remaining acid species need distributing.
    // Use the full charge balance: treat as Ca of fully protonated acid,
    // Cs equivalent = net moles of strong base per unit volume
    const Cb = molesT / totalVolL; // equivalent NaOH / L
    const r = solveMultiEquil(CT, 0, Kas, Cb, 0);
    return r.pH;
  }

  function renderPolyproticTitration(points, equivVols, pHInit, equivPHs, halfPHs, pKas, Kas, n, molesA, aVol, tConc, formulaA, Ca, maxVol) {
    const el = document.getElementById('ph-results');
    if (!el) return;

    const equivColors  = ['#f39c12','#e94560','#9b59b6','#2ecc71'];
    const halfColors   = ['#e94560','#9b59b6','#2ecc71','#f39c12'];

    el.innerHTML = `
      <h2 style="margin-bottom:12px;font-size:18px;color:#1a2a4a;">📈 Polyprotic Titration Curve</h2>
      <div style="background:#f0f6ff;border:1px solid #c8d5ee;border-radius:6px;
        padding:10px 14px;margin-bottom:10px;font-size:12px;">
        <strong>${formulaA || 'Polyprotic Acid'} (n=${n}) titrated with NaOH</strong><br>
        Analyte: ${(molesA*1000).toFixed(4)} mmol in ${aVol} mL &nbsp;|&nbsp;
        Titrant: ${tConc} mol/L &nbsp;|&nbsp;
        ${equivVols.map((v,i) => `Equiv. ${i+1}: <strong>${v.toFixed(2)} mL</strong>`).join(' | ')}
      </div>

      <canvas id="ph-poly-canvas" width="600" height="380"
        style="width:100%;border:1px solid #dde3f0;border-radius:6px;background:#fff;"></canvas>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px;margin:12px 0;">
        <div style="background:#fff;border:1px solid #dde3f0;border-radius:6px;padding:8px 10px;border-top:3px solid #4a90e2;">
          <div style="font-size:10px;color:#888;font-weight:700;text-transform:uppercase;">Initial pH</div>
          <div style="font-size:18px;font-weight:700;color:#1a2a4a;">${pHInit?.toFixed(2) ?? '—'}</div>
        </div>
        ${equivVols.map((v,i) => `
          <div style="background:#fff;border:1px solid #dde3f0;border-radius:6px;padding:8px 10px;border-top:3px solid ${equivColors[i%equivColors.length]};">
            <div style="font-size:10px;color:#888;font-weight:700;text-transform:uppercase;">Equiv. ${i+1} pH (${v.toFixed(1)} mL)</div>
            <div style="font-size:18px;font-weight:700;color:#1a2a4a;">${equivPHs[i]?.toFixed(2) ?? '—'}</div>
          </div>
          ${halfPHs[i] !== null ? `
          <div style="background:#fff;border:1px solid #dde3f0;border-radius:6px;padding:8px 10px;border-top:3px solid ${halfColors[i%halfColors.length]};">
            <div style="font-size:10px;color:#888;font-weight:700;text-transform:uppercase;">½-Equiv. ${i+1} pH = pKa${i+1}</div>
            <div style="font-size:18px;font-weight:700;color:#1a2a4a;">${halfPHs[i]?.toFixed(2) ?? '—'}</div>
          </div>` : ''}
        `).join('')}
      </div>

      <div class="results-section-title" style="margin-top:8px;">Step-by-Step Chemistry</div>
      <div style="background:#f8f9ff;border:1px solid #dde3f0;border-radius:6px;padding:14px;font-size:13px;line-height:1.8;margin-bottom:16px;">
        ${polyproticExplanation(n, equivVols, pHInit, equivPHs, halfPHs, pKas, tConc)}
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-bottom:8px;">
        <button class="stoi-export-btn" onclick="Polyprotic.exportCanvas()">⬇ Export Graph as PNG</button>
      </div>`;

    requestAnimationFrame(() => drawPolyCanvas(points, equivVols, halfPHs, pKas, equivColors, halfColors, n, maxVol));
  }

  function polyproticExplanation(n, equivVols, pHInit, equivPHs, halfPHs, pKas, tConc) {
    let html = `<p style="margin:0 0 8px;">A <strong>polyprotic acid</strong> with n=${n} donates protons in ${n} sequential steps, each with its own Ka.
      The titration curve shows <strong>${n} distinct equivalence point${n>1?'s':''}</strong> and <strong>${n} buffer region${n>1?'s':''}</strong>.</p>`;

    for (let i = 0; i < n; i++) {
      html += `<p style="margin:0 0 6px;">
        <strong>Buffer region ${i+1} (0–${equivVols[i].toFixed(1)} mL):</strong>
        Both H<sub>${n-i}</sub>A<sup>${i>0?i+'-':''}</sup> and its conjugate base coexist.
        At the half-equiv. point (${(equivVols[i]/2).toFixed(1)} mL), <strong>pH = pKa${i+1} = ${pKas[i].toFixed(2)}</strong>.
      </p>
      <p style="margin:0 0 6px;">
        <strong>Equivalence point ${i+1} (${equivVols[i].toFixed(1)} mL):</strong>
        pH = ${equivPHs[i]?.toFixed(2) ?? '—'}. The ${i===n-1?'fully deprotonated':'partially deprotonated'} form dominates.
        ${i < n-1 ? 'The next buffer region begins.' : ''}
      </p>`;
    }
    return html;
  }

  function drawPolyCanvas(points, equivVols, halfPHs, pKas, equivColors, halfColors, n, maxVol) {
    const canvas = document.getElementById('ph-poly-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const PAD = { top: 40, right: 30, bottom: 64, left: 55 };
    const CW = W - PAD.left - PAD.right;
    const CH = H - PAD.top - PAD.bottom;

    const xs = v  => PAD.left + (v / maxVol) * CW;
    const ys = pH => PAD.top  + (1 - pH / 14) * CH;

    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = '#e8edf5'; ctx.lineWidth = 1;
    for (let ph = 0; ph <= 14; ph += 2) { ctx.beginPath(); ctx.moveTo(PAD.left, ys(ph)); ctx.lineTo(PAD.left+CW, ys(ph)); ctx.stroke(); }
    for (let v = 0; v <= maxVol; v += 10) { ctx.beginPath(); ctx.moveTo(xs(v), PAD.top); ctx.lineTo(xs(v), PAD.top+CH); ctx.stroke(); }

    // Equivalence and pKa lines
    ctx.setLineDash([5, 4]);
    equivVols.forEach((v, i) => {
      if (v > maxVol) return;
      ctx.strokeStyle = equivColors[i % equivColors.length]; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(xs(v), PAD.top); ctx.lineTo(xs(v), PAD.top+CH); ctx.stroke();
    });
    pKas.forEach((pk, i) => {
      ctx.strokeStyle = halfColors[i % halfColors.length]; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.left, ys(pk)); ctx.lineTo(PAD.left+CW, ys(pk)); ctx.stroke();
    });
    ctx.setLineDash([]);

    // Curve
    ctx.strokeStyle = '#1a56a8'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    let first = true;
    for (const pt of points) {
      const px = xs(pt.x), py = ys(pt.y);
      if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Axes
    ctx.strokeStyle = '#1a2a4a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, PAD.top+CH); ctx.lineTo(PAD.left+CW, PAD.top+CH); ctx.stroke();

    // Tick labels
    ctx.fillStyle = '#333'; ctx.font = '11px Segoe UI, sans-serif'; ctx.textAlign = 'center';
    for (let ph = 0; ph <= 14; ph += 2) ctx.fillText(ph, PAD.left-22, ys(ph)+4);
    for (let v = 0; v <= maxVol; v += 10) ctx.fillText(v, xs(v), PAD.top+CH+18);

    // Axis titles
    ctx.font = 'bold 12px Segoe UI, sans-serif'; ctx.fillStyle = '#1a2a4a';
    ctx.fillText('Volume of NaOH Added (mL)', PAD.left+CW/2, PAD.top+CH+44);
    ctx.save(); ctx.translate(13, PAD.top+CH/2); ctx.rotate(-Math.PI/2); ctx.fillText('pH', 0, 0); ctx.restore();

    // Labels for equiv. lines
    ctx.font = '9px Segoe UI, sans-serif';
    equivVols.forEach((v, i) => {
      if (v > maxVol) return;
      ctx.fillStyle = equivColors[i % equivColors.length];
      ctx.textAlign = 'left';
      ctx.fillText(`Eq.${i+1} (${v.toFixed(1)})`, xs(v)+2, PAD.top + 12 + i * 12);
    });
    pKas.forEach((pk, i) => {
      ctx.fillStyle = halfColors[i % halfColors.length];
      ctx.textAlign = 'right';
      ctx.fillText(`pKa${i+1}=${pk.toFixed(2)}`, PAD.left+CW-3, ys(pk)-3);
    });
  }

  function exportCanvas() {
    const canvas = document.getElementById('ph-poly-canvas');
    if (!canvas) { showAlert('No titration curve to export.', true); return; }
    const link = document.createElement('a');
    link.download = 'polyprotic-titration.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  // ── CALCULATE DISPATCHER ──
  function calculate() {
    try {
      const mode = document.getElementById('pp-mode')?.value;
      switch (mode) {
        case 'ph':        calcPolyproticPH();        break;
        case 'buffer':    calcPolyproticBuffer();     break;
        case 'mass':      calcSaltMass();             break;
        case 'titration': calcPolyproticTitration();  break;
        default: throw new Error('Select a calculation mode.');
      }
    } catch(e) {
      const el = document.getElementById('ph-results');
      if (el) el.innerHTML = `<div class="placeholder-msg" style="color:#e74c3c;">⚠ ${e.message}</div>`;
    }
  }

  function init() { modeSwitch(); }

  return { init, calculate, modeSwitch, updateKaFields, exportCanvas, polyproticInputs };
})();
