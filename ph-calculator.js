// ph-calculator.js

const PhCalculator = (() => {

  const Kw = 1.0e-14;
  let currentMode = 'strong-acid';
  let chartInstance = null;

  // ── INIT ──
  function init() {
    setMode('strong-acid');
  }

  function setMode(mode) {
    currentMode = mode;
    ['strong-acid','strong-base','weak-acid','weak-base','buffer','titration'].forEach(m => {
      const btn = document.getElementById(`ph-mode-${m}`);
      if (btn) btn.classList.toggle('active', m === mode);
    });
    buildInputs();
    document.getElementById('ph-results').innerHTML =
      `<div class="placeholder-msg">🧪 Fill in the fields and click <strong>Calculate</strong>.</div>`;
  }

  // ── INPUT BUILDER ──
  function buildInputs() {
    const c = document.getElementById('ph-input-fields');
    if (!c) return;
    const templates = {
      'strong-acid': strongAcidInputs,
      'strong-base': strongBaseInputs,
      'weak-acid':   weakAcidInputs,
      'weak-base':   weakBaseInputs,
      'buffer':      bufferInputs,
      'titration':   titrationInputs,
    };
    c.innerHTML = (templates[currentMode] || (() => ''))();
  }

  function numField(id, label, placeholder, note='') {
    return `<div style="margin-bottom:10px;">
      <label class="stoi-lbl">${label}</label>
      <input type="number" id="${id}" min="0" step="any" placeholder="${placeholder}"
        class="stoi-num-input" style="width:100%;box-sizing:border-box;" />
      ${note ? `<div class="mini-note">${note}</div>` : ''}
    </div>`;
  }

  function selectField(id, label, options) {
    const opts = options.map(([v,t]) => `<option value="${v}">${t}</option>`).join('');
    return `<div style="margin-bottom:10px;">
      <label class="stoi-lbl">${label}</label>
      <select id="${id}" class="stoi-select" style="width:100%;min-width:unset;background:#fff;color:#111;">
        ${opts}
      </select>
    </div>`;
  }

  function strongAcidInputs() {
    return `
      ${numField('ph-sa-conc', 'Concentration (mol/L)', 'e.g. 0.100')}
      ${numField('ph-sa-n', 'H⁺ ions per formula unit', '1', 'HCl = 1 · H₂SO₄ (simplified) = 2')}`;
  }

  function strongBaseInputs() {
    return `
      ${numField('ph-sb-conc', 'Concentration (mol/L)', 'e.g. 0.100')}
      ${numField('ph-sb-n', 'OH⁻ ions per formula unit', '1', 'NaOH = 1 · Ca(OH)₂ = 2')}`;
  }

  function weakAcidInputs() {
    return `
      ${numField('ph-wa-conc', 'Initial Acid Concentration (mol/L)', 'e.g. 0.100')}
      ${selectField('ph-wa-ktype', 'Equilibrium Constant Provided', [['Ka','Ka (acid dissociation)'],['Kb','Kb (will convert to Ka)']])}
      ${numField('ph-wa-kval', 'Ka or Kb Value', 'e.g. 1.8e-5', 'Use scientific notation: 1.8e-5 = 1.8 × 10⁻⁵')}`;
  }

  function weakBaseInputs() {
    return `
      ${numField('ph-wb-conc', 'Initial Base Concentration (mol/L)', 'e.g. 0.100')}
      ${selectField('ph-wb-ktype', 'Equilibrium Constant Provided', [['Kb','Kb (base hydrolysis)'],['Ka','Ka (will convert to Kb)']])}
      ${numField('ph-wb-kval', 'Ka or Kb Value', 'e.g. 1.8e-5', 'Use scientific notation: 1.8e-5 = 1.8 × 10⁻⁵')}`;
  }

  function bufferInputs() {
    return `
      ${selectField('ph-buf-type', 'Buffer Type', [['acid','Weak Acid + Conjugate Base'],['base','Weak Base + Conjugate Acid']])}
      ${selectField('ph-buf-input', 'Enter amounts as', [['conc','Concentrations (mol/L)'],['moles','Moles']])}
      <div id="ph-buf-acid-label" style="margin-bottom:10px;">
        <label class="stoi-lbl">Weak Acid [HA] amount</label>
        <input type="number" id="ph-buf-acid" min="0" step="any" placeholder="e.g. 0.200"
          class="stoi-num-input" style="width:100%;box-sizing:border-box;" />
      </div>
      <div id="ph-buf-base-label" style="margin-bottom:10px;">
        <label class="stoi-lbl">Conjugate Base [A⁻] amount</label>
        <input type="number" id="ph-buf-base" min="0" step="any" placeholder="e.g. 0.100"
          class="stoi-num-input" style="width:100%;box-sizing:border-box;" />
      </div>
      ${selectField('ph-buf-ktype', 'Equilibrium Constant Provided', [['Ka','Ka'],['Kb','Kb (converts to Ka)'],['pKa','pKa']])}
      ${numField('ph-buf-kval', 'Value', 'e.g. 1.8e-5 or 4.74')}`;
  }

  function titrationInputs() {
    return `
      ${selectField('ph-tit-type', 'Titration Type', [
        ['wa-sb','Weak Acid + Strong Base'],
        ['sa-sb','Strong Acid + Strong Base'],
        ['wb-sa','Weak Base + Strong Acid'],
        ['sb-sa','Strong Base + Strong Acid'],
      ])}
      <div class="display-divider"></div>
      <div class="mini-note" style="margin-bottom:6px;font-weight:700;color:var(--text);">Analyte (in flask)</div>
      ${numField('ph-tit-a-conc', 'Analyte Concentration (mol/L)', 'e.g. 0.100')}
      ${numField('ph-tit-a-vol',  'Analyte Volume (mL)', 'e.g. 25.0')}
      <div id="ph-tit-ka-row">
        ${selectField('ph-tit-ktype', 'Equilibrium Constant', [['Ka','Ka'],['Kb','Kb (converts)']])}
        ${numField('ph-tit-kval', 'Ka or Kb Value', 'e.g. 1.8e-5', 'Required for weak acid/base')}
      </div>
      <div class="display-divider"></div>
      <div class="mini-note" style="margin-bottom:6px;font-weight:700;color:var(--text);">Titrant (in burette)</div>
      ${numField('ph-tit-t-conc', 'Titrant Concentration (mol/L)', 'e.g. 0.100')}
      ${numField('ph-tit-t-maxvol', 'Max Titrant Volume to Plot (mL)', '60', 'Default: 60 mL')}`;
  }

  // ── CALCULATE DISPATCHER ──
  function calculate() {
    try {
      switch (currentMode) {
        case 'strong-acid':  calcStrongAcid();  break;
        case 'strong-base':  calcStrongBase();  break;
        case 'weak-acid':    calcWeakAcid();    break;
        case 'weak-base':    calcWeakBase();    break;
        case 'buffer':       calcBuffer();      break;
        case 'titration':    calcTitration();   break;
      }
    } catch(e) {
      document.getElementById('ph-results').innerHTML =
        `<div class="placeholder-msg" style="color:#e74c3c;">⚠ ${e.message}</div>`;
    }
  }

  // ── SHARED HELPERS ──
  function requirePositive(val, name) {
    if (isNaN(val) || val <= 0) throw new Error(`${name} must be a positive number.`);
    return val;
  }
  function sci(n) {
    if (n === 0) return '0';
    const exp = Math.floor(Math.log10(Math.abs(n)));
    const coeff = n / Math.pow(10, exp);
    if (exp === 0) return n.toPrecision(4);
    return `${coeff.toPrecision(3)} × 10<sup>${exp}</sup>`;
  }
  function fmt4(n) { return n.toFixed(4); }
  function fmt2(n) { return n.toFixed(2); }

  function makeResultsBox(pH, pOH, h3o, oh, Ka, Kb) {
    const pKa = Ka ? -Math.log10(Ka) : null;
    const pKb = Kb ? -Math.log10(Kb) : null;
    const vals = [
      { label:'pH',      value: fmt2(pH),    hi: true },
      { label:'pOH',     value: fmt2(pOH),   hi: true },
      { label:'[H₃O⁺]', value: sci(h3o),    hi: false },
      { label:'[OH⁻]',  value: sci(oh),     hi: false },
      { label:'pKa',     value: pKa !== null ? fmt2(pKa) : '—', hi: false },
      { label:'pKb',     value: pKb !== null ? fmt2(pKb) : '—', hi: false },
      { label:'Ka',      value: Ka  ? sci(Ka)  : '—', hi: false },
      { label:'Kb',      value: Kb  ? sci(Kb)  : '—', hi: false },
    ];
    let html = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">`;
    vals.forEach(v => {
      html += `<div style="background:${v.hi?'#e8f0fb':'#f8f9ff'};border:1px solid #dde3f0;
        border-radius:6px;padding:10px 12px;">
        <div style="font-size:10px;color:#888;font-weight:700;text-transform:uppercase;
          letter-spacing:0.5px;margin-bottom:2px;">${v.label}</div>
        <div style="font-size:${v.hi?'20':'14'}px;font-weight:700;color:#1a2a4a;">${v.value}</div>
      </div>`;
    });
    html += `</div>`;
    return html;
  }

  function renderResults(title, resultsBoxHTML, stepsHTML) {
    const el = document.getElementById('ph-results');
    el.innerHTML = `
      <h2 style="margin-bottom:12px;font-size:18px;color:#1a2a4a;">🧪 ${title}</h2>
      ${resultsBoxHTML}
      <div class="results-section-title">Step-by-Step Solution</div>
      <div style="background:#f8f9ff;border:1px solid #dde3f0;border-radius:6px;padding:14px;
        line-height:1.8;font-size:13px;">
        ${stepsHTML}
      </div>`;
  }

  function stepLine(n, text) {
    return `<div style="margin-bottom:8px;">
      <span style="display:inline-block;background:#1a56a8;color:#fff;border-radius:50%;
        width:20px;height:20px;text-align:center;line-height:20px;font-size:11px;
        font-weight:700;margin-right:8px;">${n}</span>${text}
    </div>`;
  }
  function eq(text) {
    return `<div style="background:#fff;border:1px solid #dde3f0;border-radius:4px;
      padding:6px 12px;margin:4px 0 8px 28px;font-family:'Courier New',monospace;
      font-size:13px;color:#1a2a4a;">${text}</div>`;
  }
  function note(text, color='#1a56a8') {
    return `<div style="background:rgba(74,144,226,0.08);border-left:3px solid ${color};
      padding:6px 10px;margin:8px 0 8px 28px;font-size:12px;color:${color};">${text}</div>`;
  }

  // ── STRONG ACID ──
  function calcStrongAcid() {
    const C = requirePositive(parseFloat(document.getElementById('ph-sa-conc')?.value), 'Concentration');
    const n = requirePositive(parseFloat(document.getElementById('ph-sa-n')?.value || '1'), 'H⁺ count');
    const h3o = C * n;
    const pH  = -Math.log10(h3o);
    const pOH = 14 - pH;
    const oh  = Math.pow(10, -pOH);

    const steps = [
      stepLine(1, 'Identify the substance as a <strong>strong acid</strong>. It dissociates completely.'),
      eq(`[H₃O⁺] = C × n = ${C} × ${n} = ${h3o.toExponential(4)} M`),
      stepLine(2, 'Calculate pH from [H₃O⁺]:'),
      eq(`pH = −log[H₃O⁺] = −log(${h3o.toExponential(4)}) = ${fmt2(pH)}`),
      stepLine(3, 'Calculate pOH using the relationship pH + pOH = 14.00:'),
      eq(`pOH = 14.00 − ${fmt2(pH)} = ${fmt2(pOH)}`),
      stepLine(4, 'Calculate [OH⁻]:'),
      eq(`[OH⁻] = 10<sup>−pOH</sup> = 10<sup>−${fmt2(pOH)}</sup> = ${sci(oh)} M`),
    ].join('');

    renderResults('Strong Acid', makeResultsBox(pH, pOH, h3o, oh, null, null), steps);
  }

  // ── STRONG BASE ──
  function calcStrongBase() {
    const C = requirePositive(parseFloat(document.getElementById('ph-sb-conc')?.value), 'Concentration');
    const n = requirePositive(parseFloat(document.getElementById('ph-sb-n')?.value || '1'), 'OH⁻ count');
    const oh  = C * n;
    const pOH = -Math.log10(oh);
    const pH  = 14 - pOH;
    const h3o = Math.pow(10, -pH);

    const steps = [
      stepLine(1, 'Identify the substance as a <strong>strong base</strong>. It dissociates completely.'),
      eq(`[OH⁻] = C × n = ${C} × ${n} = ${oh.toExponential(4)} M`),
      stepLine(2, 'Calculate pOH from [OH⁻]:'),
      eq(`pOH = −log[OH⁻] = −log(${oh.toExponential(4)}) = ${fmt2(pOH)}`),
      stepLine(3, 'Calculate pH using pH + pOH = 14.00:'),
      eq(`pH = 14.00 − ${fmt2(pOH)} = ${fmt2(pH)}`),
      stepLine(4, 'Calculate [H₃O⁺]:'),
      eq(`[H₃O⁺] = 10<sup>−pH</sup> = 10<sup>−${fmt2(pH)}</sup> = ${sci(h3o)} M`),
    ].join('');

    renderResults('Strong Base', makeResultsBox(pH, pOH, h3o, oh, null, null), steps);
  }

  // ── WEAK ACID ──
  function calcWeakAcid() {
    const C     = requirePositive(parseFloat(document.getElementById('ph-wa-conc')?.value), 'Concentration');
    const ktype = document.getElementById('ph-wa-ktype')?.value;
    const kval  = requirePositive(parseFloat(document.getElementById('ph-wa-kval')?.value), 'Equilibrium constant');
    let Ka, convStep = '';

    if (ktype === 'Kb') {
      Ka = Kw / kval;
      convStep = stepLine(2, `A <strong>K<sub>b</sub></strong> value was given for an acid. Convert to K<sub>a</sub> using K<sub>w</sub>:`) +
        eq(`Ka = Kw / Kb = (1.0 × 10<sup>−14</sup>) / ${kval.toExponential(3)} = ${Ka.toExponential(4)}`);
    } else {
      Ka = kval;
      convStep = stepLine(2, `K<sub>a</sub> was provided directly: K<sub>a</sub> = ${Ka.toExponential(4)}`);
    }

    const Kb = Kw / Ka;
    const pKa = -Math.log10(Ka);
    const pKb = -Math.log10(Kb);

    // Approximation
    const xApprox = Math.sqrt(Ka * C);
    const pctIonization = (xApprox / C) * 100;
    const useApprox = pctIonization < 5;

    let x, methodStep;
    if (useApprox) {
      x = xApprox;
      methodStep = stepLine(5, `<strong>Approximation method:</strong> Check if C − x ≈ C is valid.`) +
        note(`Percent ionization = (x / C) × 100 = (${fmt4(xApprox)} / ${C}) × 100 = ${fmt2(pctIonization)}% < 5% ✓ Approximation is valid.`, '#2e7d32') +
        eq(`x = √(Ka × C) = √(${Ka.toExponential(3)} × ${C}) = ${xApprox.toExponential(4)} M`);
    } else {
      // Quadratic: x² + Ka·x − Ka·C = 0
      const a = 1, b = Ka, c2 = -Ka * C;
      x = (-b + Math.sqrt(b*b - 4*a*c2)) / (2*a);
      methodStep = stepLine(5, `<strong>Quadratic method required:</strong> Percent ionization = ${fmt2(pctIonization)}% ≥ 5%.`) +
        note(`Approximation is not valid. Solving x² + Kaˣ − Ka·C = 0 exactly.`, '#b71c1c') +
        eq(`x² + ${Ka.toExponential(3)}x − ${(Ka*C).toExponential(3)} = 0`) +
        eq(`x = [−Ka + √(Ka² + 4·Ka·C)] / 2 = ${x.toExponential(4)} M`);
    }

    const h3o = x;
    const pH  = -Math.log10(h3o);
    const pOH = 14 - pH;
    const oh  = Math.pow(10, -pOH);

    const steps = [
      stepLine(1, 'Identify as a <strong>weak acid</strong>. It does not fully dissociate. Use an ICE table.'),
      convStep,
      stepLine(3, 'Write the dissociation equilibrium:'),
      eq(`HA + H₂O ⇌ H₃O⁺ + A⁻`),
      stepLine(4, 'Set up ICE table:'),
      iceTable(['HA', 'H₃O⁺', 'A⁻'], [C,'~0','0'], [`C − x`,'x','x']),
      methodStep,
      stepLine(6, '[H₃O⁺] = x:'),
      eq(`[H₃O⁺] = ${h3o.toExponential(4)} M`),
      stepLine(7, 'Calculate pH:'),
      eq(`pH = −log(${h3o.toExponential(4)}) = ${fmt2(pH)}`),
      stepLine(8, 'Calculate pOH and [OH⁻]:'),
      eq(`pOH = 14.00 − ${fmt2(pH)} = ${fmt2(pOH)}`),
      eq(`[OH⁻] = 10<sup>−${fmt2(pOH)}</sup> = ${sci(oh)} M`),
      stepLine(9, 'Calculate pKa and pKb:'),
      eq(`pKa = −log(${Ka.toExponential(3)}) = ${fmt2(pKa)}`),
      eq(`pKb = 14.00 − pKa = ${fmt2(pKb)}`),
    ].join('');

    renderResults('Weak Acid', makeResultsBox(pH, pOH, h3o, oh, Ka, Kb), steps);
  }

  // ── WEAK BASE ──
  function calcWeakBase() {
    const C     = requirePositive(parseFloat(document.getElementById('ph-wb-conc')?.value), 'Concentration');
    const ktype = document.getElementById('ph-wb-ktype')?.value;
    const kval  = requirePositive(parseFloat(document.getElementById('ph-wb-kval')?.value), 'Equilibrium constant');
    let Kb, convStep = '';

    if (ktype === 'Ka') {
      Kb = Kw / kval;
      convStep = stepLine(2, `A <strong>K<sub>a</sub></strong> value was given for a base. Convert to K<sub>b</sub>:`) +
        eq(`Kb = Kw / Ka = (1.0 × 10<sup>−14</sup>) / ${kval.toExponential(3)} = ${Kb.toExponential(4)}`);
    } else {
      Kb = kval;
      convStep = stepLine(2, `K<sub>b</sub> was provided directly: K<sub>b</sub> = ${Kb.toExponential(4)}`);
    }

    const Ka = Kw / Kb;
    const pKa = -Math.log10(Ka);
    const pKb = -Math.log10(Kb);

    const xApprox = Math.sqrt(Kb * C);
    const pctIonization = (xApprox / C) * 100;
    const useApprox = pctIonization < 5;

    let x, methodStep;
    if (useApprox) {
      x = xApprox;
      methodStep = stepLine(5, `<strong>Approximation method:</strong>`) +
        note(`Percent ionization = ${fmt2(pctIonization)}% < 5% ✓ Approximation is valid.`, '#2e7d32') +
        eq(`x = √(Kb × C) = √(${Kb.toExponential(3)} × ${C}) = ${xApprox.toExponential(4)} M`);
    } else {
      const a = 1, b = Kb, c2 = -Kb * C;
      x = (-b + Math.sqrt(b*b - 4*a*c2)) / (2*a);
      methodStep = stepLine(5, `<strong>Quadratic method required:</strong> Percent ionization = ${fmt2(pctIonization)}% ≥ 5%.`) +
        note(`Approximation is not valid. Solving exactly.`, '#b71c1c') +
        eq(`x = [−Kb + √(Kb² + 4·Kb·C)] / 2 = ${x.toExponential(4)} M`);
    }

    const oh  = x;
    const pOH = -Math.log10(oh);
    const pH  = 14 - pOH;
    const h3o = Math.pow(10, -pH);

    const steps = [
      stepLine(1, 'Identify as a <strong>weak base</strong>. It does not fully dissociate. Use an ICE table.'),
      convStep,
      stepLine(3, 'Write the hydrolysis reaction:'),
      eq(`B + H₂O ⇌ BH⁺ + OH⁻`),
      stepLine(4, 'Set up ICE table:'),
      iceTable(['B', 'BH⁺', 'OH⁻'], [C,'0','0'], ['C − x','x','x']),
      methodStep,
      stepLine(6, '[OH⁻] = x:'),
      eq(`[OH⁻] = ${oh.toExponential(4)} M`),
      stepLine(7, 'Calculate pOH:'),
      eq(`pOH = −log(${oh.toExponential(4)}) = ${fmt2(pOH)}`),
      stepLine(8, 'Calculate pH and [H₃O⁺]:'),
      eq(`pH = 14.00 − ${fmt2(pOH)} = ${fmt2(pH)}`),
      eq(`[H₃O⁺] = 10<sup>−${fmt2(pH)}</sup> = ${sci(h3o)} M`),
      stepLine(9, 'Calculate pKa and pKb:'),
      eq(`pKb = −log(${Kb.toExponential(3)}) = ${fmt2(pKb)}`),
      eq(`pKa = 14.00 − pKb = ${fmt2(pKa)}`),
    ].join('');

    renderResults('Weak Base', makeResultsBox(pH, pOH, h3o, oh, Ka, Kb), steps);
  }

  // ── ICE TABLE HTML ──
  function iceTable(species, initial, equil) {
    const header = species.map(s => `<th style="padding:6px 10px;background:#e8f0fb;
      color:#1a2a4a;">${s}</th>`).join('');
    const iRow = initial.map(v => `<td style="padding:5px 10px;text-align:center;">${v}</td>`).join('');
    const cRow = species.map((_, i) => `<td style="padding:5px 10px;text-align:center;
      color:#e94560;">${i===0?'−x':'+x'}</td>`).join('');
    const eRow = equil.map(v => `<td style="padding:5px 10px;text-align:center;
      font-weight:700;color:#1a56a8;">${v}</td>`).join('');
    return `<table style="border-collapse:collapse;margin:4px 0 8px 28px;
      font-size:12px;font-family:'Courier New',monospace;border:1px solid #dde3f0;">
      <thead><tr><th style="padding:6px 10px;background:#e8f0fb;color:#1a2a4a;">Row</th>${header}</tr></thead>
      <tbody>
        <tr><td style="padding:5px 10px;font-weight:700;background:#f8f9ff;">Initial</td>${iRow}</tr>
        <tr style="background:#fff8f8;"><td style="padding:5px 10px;font-weight:700;">Change</td>${cRow}</tr>
        <tr><td style="padding:5px 10px;font-weight:700;background:#f8f9ff;">Equil.</td>${eRow}</tr>
      </tbody>
    </table>`;
  }

  // ── BUFFER ──
  function calcBuffer() {
    const bufType   = document.getElementById('ph-buf-type')?.value;
    const inputType = document.getElementById('ph-buf-input')?.value;
    const acidAmt   = requirePositive(parseFloat(document.getElementById('ph-buf-acid')?.value), 'Acid amount');
    const baseAmt   = requirePositive(parseFloat(document.getElementById('ph-buf-base')?.value), 'Base amount');
    const ktype     = document.getElementById('ph-buf-ktype')?.value;
    const kval      = requirePositive(parseFloat(document.getElementById('ph-buf-kval')?.value), 'Equilibrium constant value');

    if (acidAmt === 0 || baseAmt === 0) throw new Error('Both acid and base components must be non-zero for a buffer.');

    let Ka, pKa, convStep = '';
    if (ktype === 'pKa') {
      pKa = kval;
      Ka  = Math.pow(10, -pKa);
      convStep = stepLine(3, `pKa was given directly: pKa = ${fmt2(pKa)}`);
    } else if (ktype === 'Ka') {
      Ka  = kval;
      pKa = -Math.log10(Ka);
      convStep = stepLine(3, `Ka was given: Ka = ${Ka.toExponential(4)}, so pKa = −log(${Ka.toExponential(4)}) = ${fmt2(pKa)}`);
    } else {
      Ka  = Kw / kval;
      pKa = -Math.log10(Ka);
      convStep = stepLine(3, `Kb was given for an acid system. Convert: Ka = Kw / Kb = ${Ka.toExponential(4)}, pKa = ${fmt2(pKa)}`);
    }

    const Kb = Kw / Ka;
    const pKb = -Math.log10(Kb);
    const ratio = baseAmt / acidAmt;
    const pH  = pKa + Math.log10(ratio);
    const pOH = 14 - pH;
    const h3o = Math.pow(10, -pH);
    const oh  = Math.pow(10, -pOH);
    const amtLabel = inputType === 'moles' ? 'mol' : 'mol/L';
    const acidLabel = bufType === 'acid' ? '[HA]' : '[BH⁺]';
    const baseLabel = bufType === 'acid' ? '[A⁻]' : '[B]';

    const steps = [
      stepLine(1, 'Identify as a <strong>buffer solution</strong>. Henderson–Hasselbalch equation applies.'),
      stepLine(2, `Buffer type: <strong>${bufType === 'acid' ? 'Weak Acid + Conjugate Base' : 'Weak Base + Conjugate Acid'}</strong>`),
      convStep,
      stepLine(4, 'Apply the Henderson–Hasselbalch equation:'),
      eq(`pH = pKa + log([A⁻] / [HA])`),
      stepLine(5, 'Substitute values:'),
      eq(`pH = ${fmt2(pKa)} + log(${baseAmt} / ${acidAmt})`),
      eq(`pH = ${fmt2(pKa)} + log(${fmt4(ratio)})`),
      eq(`pH = ${fmt2(pKa)} + (${fmt2(Math.log10(ratio))}) = <strong>${fmt2(pH)}</strong>`),
      stepLine(6, 'Calculate remaining quantities:'),
      eq(`pOH = 14.00 − ${fmt2(pH)} = ${fmt2(pOH)}`),
      eq(`[H₃O⁺] = 10<sup>−${fmt2(pH)}</sup> = ${sci(h3o)} M`),
      eq(`[OH⁻] = 10<sup>−${fmt2(pOH)}</sup> = ${sci(oh)} M`),
      ratio >= 0.1 && ratio <= 10
        ? note('✓ The ratio [A⁻]/[HA] is within 0.1–10. Henderson–Hasselbalch gives reliable results.', '#2e7d32')
        : note('⚠ The ratio is outside the optimal buffer range (0.1–10). The buffer capacity is weak.', '#b71c1c'),
    ].join('');

    renderResults('Buffer Solution', makeResultsBox(pH, pOH, h3o, oh, Ka, Kb), steps);
  }

  // ── TITRATION CURVE ──
  function calcTitration() {
    const type   = document.getElementById('ph-tit-type')?.value;
    const aC     = requirePositive(parseFloat(document.getElementById('ph-tit-a-conc')?.value), 'Analyte concentration');
    const aVol   = requirePositive(parseFloat(document.getElementById('ph-tit-a-vol')?.value),  'Analyte volume');
    const tC     = requirePositive(parseFloat(document.getElementById('ph-tit-t-conc')?.value), 'Titrant concentration');
    const maxVol = parseFloat(document.getElementById('ph-tit-t-maxvol')?.value) || 60;
    const isWeak = type === 'wa-sb' || type === 'wb-sa';

    let Ka = null, Kb = null;
    if (isWeak) {
      const ktype = document.getElementById('ph-tit-ktype')?.value;
      const kval  = requirePositive(parseFloat(document.getElementById('ph-tit-kval')?.value), 'Equilibrium constant');
      if (type === 'wa-sb') {
        Ka = ktype === 'Ka' ? kval : Kw / kval;
        Kb = Kw / Ka;
      } else {
        Kb = ktype === 'Kb' ? kval : Kw / kval;
        Ka = Kw / Kb;
      }
    }

    const molesA = (aC * aVol) / 1000;
    const Veq    = (molesA / tC) * 1000; // mL at equivalence
    const Vmid   = Veq / 2;

    // Generate curve points
    const points = [];
    const step = maxVol / 200;
    for (let v = 0; v <= maxVol; v += step) {
      const pH = titrationPH(type, molesA, aVol, tC, v, Ka, Kb);
      if (pH !== null && isFinite(pH)) points.push({ x: v, y: Math.min(Math.max(pH, 0), 14) });
    }

    // Key pH values
    const pHInitial = titrationPH(type, molesA, aVol, tC, 0,    Ka, Kb);
    const pHMid     = isWeak ? titrationPH(type, molesA, aVol, tC, Vmid,     Ka, Kb) : null;
    const pHEquiv   = titrationPH(type, molesA, aVol, tC, Veq,  Ka, Kb);
    const pHAfter   = titrationPH(type, molesA, aVol, tC, Veq * 1.5, Ka, Kb);

    renderTitrationResults(type, points, Veq, Vmid, pHInitial, pHMid, pHEquiv, pHAfter, Ka, Kb, molesA, aVol, tC);
  }

  function titrationPH(type, molesA, aVolmL, tConc, tVolmL, Ka, Kb) {
    const molesT   = (tConc * tVolmL) / 1000;
    const totalVol = (aVolmL + tVolmL) / 1000; // L

    if (type === 'wa-sb') {
      // Weak acid + strong base
      if (molesT === 0) {
        return weakAcidPH(molesA / totalVol, Ka);
      } else if (molesT < molesA) {
        // Buffer region: HA and A- coexist
        const molesHA = molesA - molesT;
        const molesConj = molesT;
        return -Math.log10(Ka) + Math.log10(molesConj / molesHA);
      } else if (Math.abs(molesT - molesA) < 1e-12) {
        // Equivalence: all weak acid converted to conjugate base
        const concConj = molesA / totalVol;
        const Kbconj = Kw / Ka;
        return 14 + Math.log10(Math.sqrt(Kbconj * concConj));
      } else {
        // Excess strong base
        const excessOH = (molesT - molesA) / totalVol;
        return 14 + Math.log10(excessOH);
      }
    } else if (type === 'sa-sb') {
      // Strong acid + strong base
      if (molesT < molesA) {
        const excessH = (molesA - molesT) / totalVol;
        return -Math.log10(excessH);
      } else if (Math.abs(molesT - molesA) < 1e-10) {
        return 7.0;
      } else {
        const excessOH = (molesT - molesA) / totalVol;
        return 14 + Math.log10(excessOH);
      }
    } else if (type === 'wb-sa') {
      // Weak base + strong acid
      if (molesT === 0) {
        return weakBasePH(molesA / totalVol, Kb);
      } else if (molesT < molesA) {
        // Buffer region: B and BH+ coexist
        const molesB    = molesA - molesT;
        const molesBH   = molesT;
        const pKa_conj  = 14 + Math.log10(Kb); // pKa of conjugate acid = 14 - pKb
        return pKa_conj + Math.log10(molesB / molesBH);
      } else if (Math.abs(molesT - molesA) < 1e-12) {
        // Equivalence: all weak base converted to conjugate acid
        const concConj = molesA / totalVol;
        return weakAcidPH(concConj, Kw / Kb);
      } else {
        const excessH = (molesT - molesA) / totalVol;
        return -Math.log10(excessH);
      }
    } else if (type === 'sb-sa') {
      // Strong base + strong acid (mirror of sa-sb)
      if (molesT < molesA) {
        const excessOH = (molesA - molesT) / totalVol;
        return 14 + Math.log10(excessOH);
      } else if (Math.abs(molesT - molesA) < 1e-10) {
        return 7.0;
      } else {
        const excessH = (molesT - molesA) / totalVol;
        return -Math.log10(excessH);
      }
    }
    return 7;
  }

  function weakAcidPH(C, Ka) {
    const disc = Ka * Ka + 4 * Ka * C;
    const x = (-Ka + Math.sqrt(disc)) / 2;
    return -Math.log10(x);
  }

  function weakBasePH(C, Kb) {
    const disc = Kb * Kb + 4 * Kb * C;
    const x = (-Kb + Math.sqrt(disc)) / 2;
    const pOH = -Math.log10(x);
    return 14 - pOH;
  }

  // ── TITRATION RESULTS & CHART ──
  function renderTitrationResults(type, points, Veq, Vmid, pHInit, pHMid, pHEquiv, pHAfter, Ka, Kb, molesA, aVol, tConc) {
    const typeLabels = {
      'wa-sb': 'Weak Acid titrated with Strong Base',
      'sa-sb': 'Strong Acid titrated with Strong Base',
      'wb-sa': 'Weak Base titrated with Strong Acid',
      'sb-sa': 'Strong Base titrated with Strong Acid',
    };
    const isWeak = type === 'wa-sb' || type === 'wb-sa';
    const pKa = Ka ? -Math.log10(Ka) : null;
    const pKb = Kb ? -Math.log10(Kb) : null;

    const el = document.getElementById('ph-results');
    el.innerHTML = `
      <h2 style="margin-bottom:12px;font-size:18px;color:#1a2a4a;">📈 Titration Curve</h2>
      <div style="background:#f0f6ff;border:1px solid #c8d5ee;border-radius:6px;
        padding:10px 14px;margin-bottom:14px;font-size:12px;">
        <strong>${typeLabels[type]}</strong><br>
        Analyte: ${(molesA*1000).toFixed(4)} mmol in ${aVol} mL &nbsp;|&nbsp;
        Titrant: ${tConc} mol/L &nbsp;|&nbsp;
        Equivalence volume: <strong>${Veq.toFixed(2)} mL</strong>
        ${isWeak && pKa ? ` &nbsp;|&nbsp; pKa = <strong>${pKa.toFixed(2)}</strong>` : ''}
      </div>

      <canvas id="ph-tit-canvas" width="580" height="340"
        style="width:100%;border:1px solid #dde3f0;border-radius:6px;background:#fff;"></canvas>

      <div style="text-align:right;margin-top:6px;">
        <button class="stoi-export-btn" onclick="PhCalculator.exportCurve()">⬇ Export Curve as PNG</button>
      </div>

      <div style="margin-top:14px;">
        ${isWeak ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px;margin-bottom:12px;">
          ${keyPoint('Initial pH',    pHInit  !== null ? pHInit.toFixed(2)  : '—', '#4a90e2')}
          ${keyPoint('Half-equiv. pH', pHMid  !== null ? pHMid.toFixed(2)   : '—', '#e94560')}
          ${keyPoint('Equiv. pH',    pHEquiv  !== null ? pHEquiv.toFixed(2) : '—', '#f39c12')}
          ${keyPoint('After equiv.', pHAfter  !== null ? pHAfter.toFixed(2) : '—', '#9b59b6')}
          ${pKa !== null ? keyPoint('pKa', pKa.toFixed(2), '#2ecc71') : ''}
        </div>` : `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px;margin-bottom:12px;">
          ${keyPoint('Initial pH',    pHInit  !== null ? pHInit.toFixed(2)  : '—', '#4a90e2')}
          ${keyPoint('Equiv. pH',    pHEquiv  !== null ? pHEquiv.toFixed(2) : '—', '#f39c12')}
          ${keyPoint('After equiv.', pHAfter  !== null ? pHAfter.toFixed(2) : '—', '#9b59b6')}
        </div>`}
      </div>

      <div class="results-section-title" style="margin-top:8px;">How to Read This Curve</div>
      <div style="background:#f8f9ff;border:1px solid #dde3f0;border-radius:6px;padding:14px;
        font-size:13px;line-height:1.8;">
        ${titrationExplanation(type, Veq, Vmid, pHInit, pHMid, pHEquiv, pKa, pKb)}
      </div>`;

    // Draw canvas after DOM is set
    requestAnimationFrame(() => drawTitrationChart(points, Veq, Vmid, type, isWeak, pKa));
  }

  function keyPoint(label, value, color) {
    return `<div style="background:#fff;border:1px solid #dde3f0;border-radius:6px;
      padding:8px 10px;border-top:3px solid ${color};">
      <div style="font-size:10px;color:#888;font-weight:700;text-transform:uppercase;">${label}</div>
      <div style="font-size:18px;font-weight:700;color:#1a2a4a;">${value}</div>
    </div>`;
  }

  function titrationExplanation(type, Veq, Vmid, pHInit, pHMid, pHEquiv, pKa, pKb) {
    const isWeak = type === 'wa-sb' || type === 'wb-sa';
    let html = `<p style="margin:0 0 8px;">The <strong>x-axis</strong> shows the volume of titrant added (mL).
      The <strong>y-axis</strong> shows the pH of the solution.</p>`;

    if (isWeak) {
      html += `
        <p style="margin:0 0 6px;">
          <span style="display:inline-block;width:12px;height:12px;background:#4a90e222;
            border:2px solid #4a90e2;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>
          <strong>Initial point (0 mL):</strong> pH = ${pHInit?.toFixed(2) ?? '—'} — 
          reflects only the ${type === 'wa-sb' ? 'weak acid' : 'weak base'} equilibrium.
        </p>
        <p style="margin:0 0 6px;">
          <span style="display:inline-block;width:12px;height:12px;background:#4caf5033;
            border:2px solid #4caf50;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>
          <strong>Buffer region (0 – ${Veq.toFixed(1)} mL):</strong> Both the weak 
          ${type === 'wa-sb' ? 'acid (HA) and its conjugate base (A⁻)' : 'base (B) and conjugate acid (BH⁺)'}
          are present. pH changes slowly — the solution resists pH change.
        </p>
        <p style="margin:0 0 6px;">
          <span style="display:inline-block;width:12px;height:12px;background:#e9456033;
            border:2px solid #e94560;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>
          <strong>Half-equivalence point (${Vmid.toFixed(1)} mL):</strong> Exactly half the 
          ${type === 'wa-sb' ? 'acid' : 'base'} has been neutralized.
          At this point <strong>pH = pK${type === 'wa-sb' ? 'a' : 'a'} = ${pKa?.toFixed(2) ?? '—'}</strong>.
          This is the most important reference point on the curve.
        </p>
        <p style="margin:0 0 6px;">
          <span style="display:inline-block;width:12px;height:12px;background:#f39c1233;
            border:2px solid #f39c12;border-radius:2px;vertical-align:middle;margin-right:4px;"></span>
          <strong>Equivalence point (${Veq.toFixed(1)} mL):</strong> All analyte has been neutralized.
          pH = ${pHEquiv?.toFixed(2) ?? '—'} — ${type === 'wa-sb' ? 'above 7 because conjugate base hydrolyzes' : 'below 7 because conjugate acid dissociates'}.
        </p>
        <p style="margin:0 0 0;">
          <strong>After equivalence:</strong> Excess titrant controls pH. 
          ${type === 'wa-sb' ? 'Excess strong base makes the solution more basic.' : 'Excess strong acid makes the solution more acidic.'}
        </p>`;
    } else {
      html += `
        <p style="margin:0 0 6px;"><strong>Initial point:</strong> pH = ${pHInit?.toFixed(2) ?? '—'} from the strong ${type === 'sa-sb' ? 'acid' : 'base'} alone.</p>
        <p style="margin:0 0 6px;"><strong>Before equivalence (${Veq.toFixed(1)} mL):</strong> Excess ${type === 'sa-sb' ? 'strong acid' : 'strong base'} controls pH. No buffer region forms with strong acids/bases.</p>
        <p style="margin:0 0 6px;"><strong>Equivalence point (${Veq.toFixed(1)} mL):</strong> pH ≈ 7.00. Both acid and base are fully neutralized to give a neutral salt solution.</p>
        <p style="margin:0 0 0;"><strong>After equivalence:</strong> Excess titrant controls pH.</p>`;
    }
    return html;
  }

  // ── CANVAS CHART ──
  function drawTitrationChart(points, Veq, Vmid, type, isWeak, pKa) {
    const canvas = document.getElementById('ph-tit-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const PAD = { top: 20, right: 30, bottom: 50, left: 55 };
    const CW = W - PAD.left - PAD.right;
    const CH = H - PAD.top  - PAD.bottom;

    const maxX = points.length ? points[points.length-1].x : 60;
    const xScale = v  => PAD.left + (v / maxX) * CW;
    const yScale = pH => PAD.top  + (1 - pH / 14) * CH;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);

    // Buffer region shading
    if (isWeak) {
      ctx.fillStyle = 'rgba(76,175,80,0.07)';
      ctx.fillRect(xScale(0), PAD.top, xScale(Veq) - xScale(0), CH);
    }

    // Grid lines
    ctx.strokeStyle = '#e8edf5';
    ctx.lineWidth = 1;
    for (let ph = 0; ph <= 14; ph += 2) {
      ctx.beginPath();
      ctx.moveTo(PAD.left, yScale(ph));
      ctx.lineTo(PAD.left + CW, yScale(ph));
      ctx.stroke();
    }
    for (let v = 0; v <= maxX; v += 10) {
      ctx.beginPath();
      ctx.moveTo(xScale(v), PAD.top);
      ctx.lineTo(xScale(v), PAD.top + CH);
      ctx.stroke();
    }

    // Equivalence line
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#f39c12';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xScale(Veq), PAD.top);
    ctx.lineTo(xScale(Veq), PAD.top + CH);
    ctx.stroke();

    // Half-equivalence line
    if (isWeak) {
      ctx.strokeStyle = '#e94560';
      ctx.beginPath();
      ctx.moveTo(xScale(Vmid), PAD.top);
      ctx.lineTo(xScale(Vmid), PAD.top + CH);
      ctx.stroke();

      // pKa horizontal dashed line
      if (pKa !== null) {
        ctx.strokeStyle = '#2ecc71';
        ctx.beginPath();
        ctx.moveTo(PAD.left, yScale(pKa));
        ctx.lineTo(PAD.left + CW, yScale(pKa));
        ctx.stroke();
      }
    }

    ctx.setLineDash([]);

    // Titration curve
    ctx.strokeStyle = '#1a56a8';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let first = true;
    for (const pt of points) {
      const px = xScale(pt.x), py = yScale(pt.y);
      if (first) { ctx.moveTo(px, py); first = false; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Axes
    ctx.strokeStyle = '#1a2a4a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top);
    ctx.lineTo(PAD.left, PAD.top + CH);
    ctx.lineTo(PAD.left + CW, PAD.top + CH);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#333';
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    for (let ph = 0; ph <= 14; ph += 2) {
      ctx.fillText(ph, PAD.left - 22, yScale(ph) + 4);
    }
    for (let v = 0; v <= maxX; v += 10) {
      ctx.fillText(v, xScale(v), PAD.top + CH + 18);
    }

    // Axis titles
    ctx.font = 'bold 12px Segoe UI, sans-serif';
    ctx.fillStyle = '#1a2a4a';
    ctx.textAlign = 'center';
    ctx.fillText('Volume of Titrant Added (mL)', PAD.left + CW / 2, H - 6);
    ctx.save();
    ctx.translate(13, PAD.top + CH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('pH', 0, 0);
    ctx.restore();

    // Labels on chart
    ctx.font = '10px Segoe UI, sans-serif';
    ctx.fillStyle = '#f39c12';
    ctx.textAlign = 'left';
    ctx.fillText(`Equiv. (${Veq.toFixed(1)} mL)`, xScale(Veq) + 3, PAD.top + 14);

    if (isWeak) {
      ctx.fillStyle = '#e94560';
      ctx.fillText(`½-equiv. (${Vmid.toFixed(1)} mL)`, xScale(Vmid) + 3, PAD.top + 26);

      if (pKa !== null) {
        ctx.fillStyle = '#2ecc71';
        ctx.textAlign = 'right';
        ctx.fillText(`pKa = ${pKa.toFixed(2)}`, PAD.left + CW - 4, yScale(pKa) - 4);
      }

      ctx.fillStyle = 'rgba(76,175,80,0.7)';
      ctx.font = 'bold 10px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Buffer Region', xScale(Vmid / 2), PAD.top + CH - 10);
    }
  }

  function exportCurve() {
    const canvas = document.getElementById('ph-tit-canvas');
    if (!canvas) { showAlert('No titration curve to export. Run a titration calculation first.', true); return; }
    const link = document.createElement('a');
    link.download = 'titration-curve.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function clearAll() {
    document.getElementById('ph-results').innerHTML =
      `<div class="placeholder-msg">🧪 Fill in the fields and click <strong>Calculate</strong>.</div>`;
    buildInputs();
  }

  return { init, setMode, calculate, clearAll, exportCurve };
})();

window.addEventListener('load', () => PhCalculator.init());
