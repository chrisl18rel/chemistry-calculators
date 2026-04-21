// ph-calculator.js

const PhCalculator = (() => {
  const Kw = 1.0e-14;
  let currentMode = 'smart';
  let chartInstance = null;

  // ── COMPOUND DATABASE ──
  // Each entry: formula, name, type, n (ion multiplier), Ka or Kb
  const COMPOUND_DB = [
    // Strong acids
    { f:'HCl',     name:'Hydrochloric acid',     type:'strong-acid', n:1 },
    { f:'HBr',     name:'Hydrobromic acid',       type:'strong-acid', n:1 },
    { f:'HI',      name:'Hydroiodic acid',        type:'strong-acid', n:1 },
    { f:'HNO3',    name:'Nitric acid',            type:'strong-acid', n:1 },
    { f:'HClO4',   name:'Perchloric acid',        type:'strong-acid', n:1 },
    { f:'HClO3',   name:'Chloric acid',           type:'strong-acid', n:1 },
    { f:'H2SO4',   name:'Sulfuric acid',          type:'strong-acid', n:2 },
    // Strong bases
    { f:'NaOH',    name:'Sodium hydroxide',       type:'strong-base', n:1 },
    { f:'KOH',     name:'Potassium hydroxide',    type:'strong-base', n:1 },
    { f:'LiOH',    name:'Lithium hydroxide',      type:'strong-base', n:1 },
    { f:'RbOH',    name:'Rubidium hydroxide',     type:'strong-base', n:1 },
    { f:'CsOH',    name:'Cesium hydroxide',       type:'strong-base', n:1 },
    { f:'Ca(OH)2', name:'Calcium hydroxide',      type:'strong-base', n:2 },
    { f:'Ba(OH)2', name:'Barium hydroxide',       type:'strong-base', n:2 },
    { f:'Sr(OH)2', name:'Strontium hydroxide',    type:'strong-base', n:2 },
    { f:'Mg(OH)2', name:'Magnesium hydroxide',    type:'strong-base', n:2 },
    // Weak acids (Ka values)
    { f:'CH3COOH', name:'Acetic acid',            type:'weak-acid', n:1, Ka:1.8e-5 },
    { f:'HC2H3O2', name:'Acetic acid',            type:'weak-acid', n:1, Ka:1.8e-5 },
    { f:'HF',      name:'Hydrofluoric acid',      type:'weak-acid', n:1, Ka:6.8e-4 },
    { f:'HCN',     name:'Hydrocyanic acid',       type:'weak-acid', n:1, Ka:6.2e-10 },
    { f:'HNO2',    name:'Nitrous acid',           type:'weak-acid', n:1, Ka:4.5e-4 },
    { f:'H2CO3',   name:'Carbonic acid',          type:'weak-acid', n:1, Ka:4.3e-7 },
    { f:'H3PO4',   name:'Phosphoric acid',        type:'weak-acid', n:1, Ka:7.5e-3 },
    { f:'HClO',    name:'Hypochlorous acid',      type:'weak-acid', n:1, Ka:3.5e-8 },
    { f:'HClO2',   name:'Chlorous acid',          type:'weak-acid', n:1, Ka:1.1e-2 },
    { f:'H2S',     name:'Hydrogen sulfide',       type:'weak-acid', n:1, Ka:9.5e-8 },
    { f:'HCOOH',   name:'Formic acid',            type:'weak-acid', n:1, Ka:1.8e-4 },
    { f:'C6H5COOH',name:'Benzoic acid',           type:'weak-acid', n:1, Ka:6.5e-5 },
    { f:'C6H5OH',  name:'Phenol',                 type:'weak-acid', n:1, Ka:1.0e-10 },
    { f:'H3BO3',   name:'Boric acid',             type:'weak-acid', n:1, Ka:5.8e-10 },
    { f:'H2C2O4',  name:'Oxalic acid',            type:'weak-acid', n:1, Ka:5.9e-2 },
    { f:'HCO3-',   name:'Bicarbonate ion',        type:'weak-acid', n:1, Ka:4.7e-11 },
    // Weak bases (Kb values)
    { f:'NH3',     name:'Ammonia',                type:'weak-base', n:1, Kb:1.8e-5 },
    { f:'NH4OH',   name:'Ammonium hydroxide',     type:'weak-base', n:1, Kb:1.8e-5 },
    { f:'C5H5N',   name:'Pyridine',               type:'weak-base', n:1, Kb:1.7e-9 },
    { f:'C6H5NH2', name:'Aniline',                type:'weak-base', n:1, Kb:4.3e-10 },
    { f:'CH3NH2',  name:'Methylamine',            type:'weak-base', n:1, Kb:4.4e-4 },
    { f:'(CH3)2NH',name:'Dimethylamine',          type:'weak-base', n:1, Kb:5.9e-4 },
    { f:'(CH3)3N', name:'Trimethylamine',         type:'weak-base', n:1, Kb:6.5e-5 },
    { f:'C2H5NH2', name:'Ethylamine',             type:'weak-base', n:1, Kb:5.6e-4 },
    { f:'N2H4',    name:'Hydrazine',              type:'weak-base', n:1, Kb:9.8e-7 },
    { f:'C6H5CH2NH2',name:'Benzylamine',          type:'weak-base', n:1, Kb:2.2e-5 },
    { f:'HCO3-',   name:'Bicarbonate (base)',     type:'weak-base', n:1, Kb:2.3e-8 },
    { f:'CO3{2-}', name:'Carbonate ion',          type:'weak-base', n:1, Kb:2.1e-4 },
    { f:'F-',      name:'Fluoride ion',           type:'weak-base', n:1, Kb:1.5e-11 },
    { f:'CN-',     name:'Cyanide ion',            type:'weak-base', n:1, Kb:1.6e-5 },
    { f:'CH3COO-', name:'Acetate ion',            type:'weak-base', n:1, Kb:5.6e-10 },
    { f:'NO2-',    name:'Nitrite ion',            type:'weak-base', n:1, Kb:2.2e-11 },
  ];

  function detectCompound(raw) {
    const s = raw.trim().replace(/\s+/g, '');
    // Try exact match first (case-sensitive)
    let match = COMPOUND_DB.find(c => c.f === s);
    if (!match) match = COMPOUND_DB.find(c => c.f.toLowerCase() === s.toLowerCase());
    return match || null;
  }

  // ── INIT ──
  function init() {
    setMode('smart');
  }

  function setMode(mode) {
    currentMode = mode;
    ['smart','strong-acid','strong-base','weak-acid','weak-base','buffer','titration'].forEach(m => {
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
      'smart':       smartInputs,
      'strong-acid': strongAcidInputs,
      'strong-base': strongBaseInputs,
      'weak-acid':   weakAcidInputs,
      'weak-base':   weakBaseInputs,
      'buffer':      bufferInputs,
      'titration':   titrationInputs,
    };
    c.innerHTML = (templates[currentMode] || (() => ''))();
    // Populate dynamic sub-fields for buffer mode
    if (currentMode === 'buffer') bufferModeSwitch();
  }

  function smartInputs() {
    return `
      <div style="margin-bottom:10px;">
        <label class="stoi-lbl">Chemical Formula</label>
        <input type="text" id="ph-smart-formula" placeholder="e.g. HCl, NH3, Ca(OH)2"
          class="formula-input" style="width:100%;box-sizing:border-box;"
          oninput="PhCalculator.smartDetect()" autocomplete="off" spellcheck="false" />
        <div id="ph-smart-detect-result" style="margin-top:5px;min-height:20px;"></div>
      </div>

      <div class="display-divider"></div>

      <div style="margin-bottom:10px;">
        <label class="stoi-lbl">What do you know? (select one)</label>
        <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px;">
          <label class="stoi-radio" style="font-size:12px;">
            <input type="radio" name="ph-smart-known" value="conc" checked onchange="PhCalculator.smartUpdateFields()" />
            Molar concentration (mol/L)
          </label>
          <label class="stoi-radio" style="font-size:12px;">
            <input type="radio" name="ph-smart-known" value="pH" onchange="PhCalculator.smartUpdateFields()" />
            pH
          </label>
          <label class="stoi-radio" style="font-size:12px;">
            <input type="radio" name="ph-smart-known" value="pOH" onchange="PhCalculator.smartUpdateFields()" />
            pOH
          </label>
          <label class="stoi-radio" style="font-size:12px;">
            <input type="radio" name="ph-smart-known" value="h3o" onchange="PhCalculator.smartUpdateFields()" />
            [H₃O⁺] concentration
          </label>
          <label class="stoi-radio" style="font-size:12px;">
            <input type="radio" name="ph-smart-known" value="oh" onchange="PhCalculator.smartUpdateFields()" />
            [OH⁻] concentration
          </label>
        </div>
      </div>

      <div id="ph-smart-value-fields">
        <div style="margin-bottom:10px;">
          <label class="stoi-lbl">Concentration (mol/L)</label>
          <input type="number" id="ph-smart-val" min="0" step="any" placeholder="e.g. 0.100"
            class="stoi-num-input" style="width:100%;box-sizing:border-box;" />
        </div>
      </div>

      <div id="ph-smart-k-field" style="display:none;">
        <div class="display-divider"></div>
        <div style="margin-bottom:6px;">
          <label class="stoi-lbl">Equilibrium Constant</label>
          <div style="display:flex;gap:6px;margin-bottom:6px;">
            <label class="stoi-radio" style="font-size:12px;">
              <input type="radio" name="ph-smart-ktype" value="Ka" checked /> Ka
            </label>
            <label class="stoi-radio" style="font-size:12px;">
              <input type="radio" name="ph-smart-ktype" value="Kb" /> Kb
            </label>
          </div>
          <input type="number" id="ph-smart-kval" min="0" step="any" placeholder="e.g. 1.8e-5"
            class="stoi-num-input" style="width:100%;box-sizing:border-box;" />
          <div class="mini-note" id="ph-smart-k-note">Enter Ka or Kb (e.g. 1.8e-5)</div>
        </div>
      </div>`;
  }

  function numField(id, label, placeholder, note='') {
    return `<div style="margin-bottom:10px;">
      <label class="stoi-lbl">${label}</label>
      <input type="number" id="${id}" min="0" step="any" placeholder="${placeholder}"
        class="stoi-num-input" style="width:100%;box-sizing:border-box;" />
      ${note ? `<div class="mini-note">${note}</div>` : ''}
    </div>`;
  }

  function selectField(id, label, options, onchange='') {
    const opts = options.map(([v,t]) => `<option value="${v}">${t}</option>`).join('');
    return `<div style="margin-bottom:10px;">
      <label class="stoi-lbl">${label}</label>
      <select id="${id}" class="stoi-select" style="width:100%;min-width:unset;background:#fff;color:#111;"
        ${onchange ? `onchange="${onchange}"` : ''}>
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
      ${selectField('ph-buf-solve', 'What do you want to find?', [
        ['pH',   'Find pH (know amounts + Ka/pKa)'],
        ['ratio','Find ratio [A⁻]/[HA] (know pH + Ka/pKa)'],
      ], 'PhCalculator.bufferModeSwitch()')}
      <div id="ph-buf-mode-fields"></div>`;
  }

  function bufferModeSwitch() {
    const solve = document.getElementById('ph-buf-solve')?.value;
    const container = document.getElementById('ph-buf-mode-fields');
    if (!container) return;

    if (solve === 'ratio') {
      container.innerHTML = `
        <div class="display-divider"></div>
        ${selectField('ph-buf-type', 'Buffer Type', [['acid','Weak Acid + Conjugate Base'],['base','Weak Base + Conjugate Acid']])}
        ${numField('ph-buf-target-ph', 'Target pH', 'e.g. 4.50')}
        ${selectField('ph-buf-ktype', 'Equilibrium Constant Provided', [['pKa','pKa'],['Ka','Ka'],['Kb','Kb (converts to Ka)']])}
        ${numField('ph-buf-kval', 'Value', 'e.g. 3.39 or 1.8e-5')}`;
    } else {
      container.innerHTML = `
        <div class="display-divider"></div>
        ${selectField('ph-buf-type', 'Buffer Type', [['acid','Weak Acid + Conjugate Base'],['base','Weak Base + Conjugate Acid']])}
        ${selectField('ph-buf-input', 'Enter amounts as', [['conc','Concentrations (mol/L)'],['moles','Moles']])}
        <div style="margin-bottom:10px;">
          <label class="stoi-lbl">Weak Acid [HA] amount</label>
          <input type="number" id="ph-buf-acid" min="0" step="any" placeholder="e.g. 0.200"
            class="stoi-num-input" style="width:100%;box-sizing:border-box;" />
        </div>
        <div style="margin-bottom:10px;">
          <label class="stoi-lbl">Conjugate Base [A⁻] amount</label>
          <input type="number" id="ph-buf-base" min="0" step="any" placeholder="e.g. 0.100"
            class="stoi-num-input" style="width:100%;box-sizing:border-box;" />
        </div>
        ${selectField('ph-buf-ktype', 'Equilibrium Constant Provided', [['Ka','Ka'],['Kb','Kb (converts to Ka)'],['pKa','pKa']])}
        ${numField('ph-buf-kval', 'Value', 'e.g. 1.8e-5 or 4.74')}`;
    }
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
      ${numField('ph-tit-t-maxvol', 'Max Titrant Volume to Plot (mL)', '60', 'Default: 60 mL')}
      <div class="display-divider"></div>
      <div class="mini-note" style="font-weight:700;color:var(--text);margin-bottom:6px;">GRAPH TITLE</div>
      <div style="margin-bottom:6px;">
        <input type="text" id="ph-tit-title" placeholder="Optional title..."
          class="formula-input" style="width:100%;box-sizing:border-box;font-size:12px;"
          oninput="PhCalculator.updateTitStyle()" />
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px;">
        <div><label class="stoi-lbl">Size</label>
          <input type="number" id="ph-tit-title-size" value="14" min="8" max="32"
            class="stoi-num-input" style="width:100%;box-sizing:border-box;" oninput="PhCalculator.updateTitStyle()" /></div>
        <div><label class="stoi-lbl">Color</label>
          <input type="color" id="ph-tit-title-color" value="#1a2a4a"
            style="width:100%;height:32px;border:1px solid #c8d5ee;border-radius:5px;cursor:pointer;"
            oninput="PhCalculator.updateTitStyle()" /></div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">
        <label class="stoi-radio" style="font-size:12px;">
          <input type="checkbox" id="ph-tit-title-bold" checked onchange="PhCalculator.updateTitStyle()" /> Bold
        </label>
        <select id="ph-tit-title-align" class="stoi-select" style="flex:1;min-width:unset;background:#fff;color:#111;font-size:11px;"
          onchange="PhCalculator.updateTitStyle()">
          <option value="left">Left</option>
          <option value="center" selected>Center</option>
          <option value="right">Right</option>
        </select>
      </div>
      <div class="display-divider"></div>
      <div class="mini-note" style="font-weight:700;color:var(--text);margin-bottom:6px;">LABEL STYLE</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px;">
        <div><label class="stoi-lbl">Font Size</label>
          <input type="number" id="ph-tit-lbl-size" value="10" min="7" max="18"
            class="stoi-num-input" style="width:100%;box-sizing:border-box;" oninput="PhCalculator.updateTitStyle()" /></div>
        <div><label class="stoi-lbl">Color</label>
          <input type="color" id="ph-tit-lbl-color" value="#1a2a4a"
            style="width:100%;height:32px;border:1px solid #c8d5ee;border-radius:5px;cursor:pointer;"
            oninput="PhCalculator.updateTitStyle()" /></div>
      </div>
      <div style="margin-bottom:8px;">
        <label class="stoi-radio" style="font-size:12px;">
          <input type="checkbox" id="ph-tit-lbl-bold" onchange="PhCalculator.updateTitStyle()" /> Bold labels
        </label>
      </div>
      <div class="display-divider"></div>
      <div class="mini-note" style="font-weight:700;color:var(--text);margin-bottom:6px;">LINE COLORS</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px;">
        <div><label class="stoi-lbl">Equiv.</label>
          <input type="color" id="ph-tit-equiv-color" value="#f39c12"
            style="width:100%;height:28px;border:1px solid #c8d5ee;border-radius:5px;cursor:pointer;"
            oninput="PhCalculator.updateTitStyle()" /></div>
        <div><label class="stoi-lbl">½-Equiv.</label>
          <input type="color" id="ph-tit-half-color" value="#e94560"
            style="width:100%;height:28px;border:1px solid #c8d5ee;border-radius:5px;cursor:pointer;"
            oninput="PhCalculator.updateTitStyle()" /></div>
        <div><label class="stoi-lbl">pKa line</label>
          <input type="color" id="ph-tit-pka-color" value="#2ecc71"
            style="width:100%;height:28px;border:1px solid #c8d5ee;border-radius:5px;cursor:pointer;"
            oninput="PhCalculator.updateTitStyle()" /></div>
        <div><label class="stoi-lbl">Buffer Fill</label>
          <input type="color" id="ph-tit-buf-color" value="#4caf50"
            style="width:100%;height:28px;border:1px solid #c8d5ee;border-radius:5px;cursor:pointer;"
            oninput="PhCalculator.updateTitStyle()" /></div>
      </div>
      <div class="display-divider"></div>
      <div class="mini-note" style="font-weight:700;color:var(--text);margin-bottom:6px;">SHOW/HIDE ON GRAPH</div>
      <div style="display:flex;flex-direction:column;gap:3px;margin-bottom:8px;">
        <label class="stoi-radio" style="font-size:11px;"><input type="checkbox" id="ph-show-init" checked onchange="PhCalculator.updateTitStyle()" /> Initial pH point</label>
        <label class="stoi-radio" style="font-size:11px;"><input type="checkbox" id="ph-show-half" checked onchange="PhCalculator.updateTitStyle()" /> Half-equiv. pH point</label>
        <label class="stoi-radio" style="font-size:11px;"><input type="checkbox" id="ph-show-equiv" checked onchange="PhCalculator.updateTitStyle()" /> Equiv. pH point</label>
        <label class="stoi-radio" style="font-size:11px;"><input type="checkbox" id="ph-show-after" checked onchange="PhCalculator.updateTitStyle()" /> After equiv. card</label>
        <label class="stoi-radio" style="font-size:11px;"><input type="checkbox" id="ph-show-pka" checked onchange="PhCalculator.updateTitStyle()" /> pKa point</label>
      </div>
      <div class="display-divider"></div>
      <div class="mini-note" style="font-weight:700;color:var(--text);margin-bottom:6px;">PLOT POINTS</div>
      <div class="mini-note" style="margin-bottom:8px;">Click the graph to place a point, or configure defaults below.</div>
      <div class="section-label" style="margin-bottom:4px;">Defaults for new points</div>
      <div style="display:flex;flex-direction:column;gap:3px;margin-bottom:8px;">
        <label class="stoi-radio" style="font-size:12px;"><input type="checkbox" id="ph-def-coord" checked /> Show ordered pair label</label>
        <label class="stoi-radio" style="font-size:12px;"><input type="checkbox" id="ph-def-dotted" checked /> Show dotted projection lines</label>
        <label class="stoi-radio" style="font-size:12px;"><input type="checkbox" id="ph-def-snap" /> Snap to curve line</label>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;">
        <div>
          <label class="stoi-lbl">Dot color</label>
          <input type="color" id="ph-def-dot-color" value="#e94560"
            style="width:100%;height:28px;border:1px solid #c8d5ee;border-radius:5px;cursor:pointer;" />
        </div>
        <div>
          <label class="stoi-lbl">Line color</label>
          <input type="color" id="ph-def-line-color" value="#555555"
            style="width:100%;height:28px;border:1px solid #c8d5ee;border-radius:5px;cursor:pointer;" />
        </div>
      </div>
      <label class="stoi-lbl">Dotted line thickness</label>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
        <input type="range" id="ph-def-thick-range" min="0.5" max="4" step="0.5" value="1"
          style="flex:1;accent-color:var(--accent);"
          oninput="document.getElementById('ph-def-thick-num').value=this.value" />
        <input type="number" id="ph-def-thick-num" value="1" min="0.5" max="4" step="0.5"
          class="stoi-num-input" style="width:52px;"
          oninput="document.getElementById('ph-def-thick-range').value=this.value" />
      </div>
      <button class="action-btn primary" onclick="PhCalculator.addPointManual()" style="width:100%;margin-bottom:8px;">＋ Add Point</button>
      <div class="display-divider"></div>
      <div id="ph-user-points-list">
        <div style="font-size:11px;color:var(--text-dim);padding:4px 0;">Click the graph to add points.</div>
      </div>
      <button class="action-btn" onclick="PhCalculator.clearUserPoints()" style="font-size:11px;padding:5px 10px;margin-top:6px;width:100%;">🗑 Clear All Points</button>`;
  }

  // ── SMART MODE LIVE DETECTION ──
  function smartDetect() {
    const raw = document.getElementById('ph-smart-formula')?.value || '';
    const resultEl = document.getElementById('ph-smart-detect-result');
    if (!resultEl) return;
    if (!raw.trim()) { resultEl.innerHTML = ''; return; }

    const compound = detectCompound(raw);
    if (!compound) {
      resultEl.innerHTML = `<div style="background:#fff8e1;border:1px solid #ffc107;
        border-radius:5px;padding:8px 10px;font-size:12px;line-height:1.6;color:#5a4000;">
        <strong style="color:#856404;">⚠ Compound not in database.</strong>
        <span style="color:#5a4000;"> Tell us what type it is and we'll proceed:</span>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:#3a2800;cursor:pointer;">
            <input type="radio" name="ph-smart-override" value="strong-acid"
              onchange="PhCalculator.smartOverrideChanged()" /> Strong Acid
          </label>
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:#3a2800;cursor:pointer;">
            <input type="radio" name="ph-smart-override" value="strong-base"
              onchange="PhCalculator.smartOverrideChanged()" /> Strong Base
          </label>
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:#3a2800;cursor:pointer;">
            <input type="radio" name="ph-smart-override" value="weak-acid"
              onchange="PhCalculator.smartOverrideChanged()" /> Weak Acid
          </label>
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:#3a2800;cursor:pointer;">
            <input type="radio" name="ph-smart-override" value="weak-base"
              onchange="PhCalculator.smartOverrideChanged()" /> Weak Base
          </label>
        </div>
        <div id="ph-smart-override-n" style="display:none;margin-top:6px;">
          <label style="font-size:11px;color:#5a4000;font-weight:600;text-transform:uppercase;
            letter-spacing:0.4px;display:block;margin-bottom:3px;">Ions per formula unit (e.g. 2 for Ca(OH)₂)</label>
          <input type="number" id="ph-smart-n-override" min="1" step="1" value="1"
            class="stoi-num-input" style="width:60px;" />
        </div>
      </div>`;
      smartUpdateKField(null);
      return;
    }

    const typeLabels = {
      'strong-acid': '⚡ Strong Acid',
      'strong-base': '⚡ Strong Base',
      'weak-acid':   '〰 Weak Acid',
      'weak-base':   '〰 Weak Base',
    };
    const typeColors = {
      'strong-acid':'#e94560','strong-base':'#1a56a8',
      'weak-acid':'#d35400','weak-base':'#2e7d32'
    };
    const color = typeColors[compound.type] || '#555';
    const kInfo = compound.Ka
      ? `Ka = ${compound.Ka.toExponential(2)}`
      : compound.Kb
        ? `Kb = ${compound.Kb.toExponential(2)}`
        : '';
    const nInfo = compound.n > 1
      ? `· releases <strong>${compound.n} ions</strong> per formula unit`
      : '';

    resultEl.innerHTML = `<div style="background:${color}18;border:1px solid ${color}44;
      border-radius:5px;padding:7px 10px;font-size:12px;line-height:1.6;">
      <strong style="color:${color};">${typeLabels[compound.type]}</strong>
      &nbsp;—&nbsp;${compound.name}
      ${nInfo ? `<br>${nInfo}` : ''}
      ${kInfo ? `<br><span style="color:#555;">${kInfo} (built-in)</span>` : ''}
    </div>`;

    smartUpdateKField(compound);
  }

  function smartUpdateKField(compound) {
    const kField = document.getElementById('ph-smart-k-field');
    if (!kField) return;
    const isWeak = compound && (compound.type === 'weak-acid' || compound.type === 'weak-base');
    kField.style.display = isWeak ? '' : 'none';

    if (isWeak && compound) {
      const noteEl = document.getElementById('ph-smart-k-note');
      if (compound.Ka) {
        if (noteEl) noteEl.textContent = `Built-in Ka = ${compound.Ka.toExponential(3)} — leave blank to use, or override`;
        const kInput = document.getElementById('ph-smart-kval');
        if (kInput && !kInput.value) kInput.placeholder = `${compound.Ka.toExponential(3)} (built-in)`;
        // Pre-select Ka radio
        const kaRadio = document.querySelector('input[name="ph-smart-ktype"][value="Ka"]');
        if (kaRadio) kaRadio.checked = true;
      } else if (compound.Kb) {
        if (noteEl) noteEl.textContent = `Built-in Kb = ${compound.Kb.toExponential(3)} — leave blank to use, or override`;
        const kInput = document.getElementById('ph-smart-kval');
        if (kInput && !kInput.value) kInput.placeholder = `${compound.Kb.toExponential(3)} (built-in)`;
        const kbRadio = document.querySelector('input[name="ph-smart-ktype"][value="Kb"]');
        if (kbRadio) kbRadio.checked = true;
      }
    }
  }

  function smartOverrideChanged() {
    const overrideType = document.querySelector('input[name="ph-smart-override"]:checked')?.value;
    // Show n-override field for strong bases (e.g. Ca(OH)2) and strong acids (e.g. H2SO4)
    const nRow = document.getElementById('ph-smart-override-n');
    if (nRow) nRow.style.display = (overrideType === 'strong-base' || overrideType === 'strong-acid') ? '' : 'none';
    // Show/hide K field based on override type
    const isWeak = overrideType === 'weak-acid' || overrideType === 'weak-base';
    const kField = document.getElementById('ph-smart-k-field');
    if (kField) {
      kField.style.display = isWeak ? '' : 'none';
      if (isWeak) {
        const noteEl = document.getElementById('ph-smart-k-note');
        if (noteEl) noteEl.textContent = 'Enter Ka or Kb (e.g. 1.8e-5)';
        const kInput = document.getElementById('ph-smart-kval');
        if (kInput) kInput.placeholder = 'e.g. 1.8e-5';
        // Default radio to Ka for weak acid, Kb for weak base
        const preferred = overrideType === 'weak-acid' ? 'Ka' : 'Kb';
        const radio = document.querySelector(`input[name="ph-smart-ktype"][value="${preferred}"]`);
        if (radio) radio.checked = true;
      }
    }
  }

  function smartUpdateFields() {
    const known = document.querySelector('input[name="ph-smart-known"]:checked')?.value || 'conc';
    const labels = {
      conc: ['Concentration (mol/L)', 'e.g. 0.100'],
      pH:   ['pH', 'e.g. 3.45'],
      pOH:  ['pOH', 'e.g. 10.55'],
      h3o:  ['[H₃O⁺] (mol/L)', 'e.g. 3.55e-4'],
      oh:   ['[OH⁻] (mol/L)', 'e.g. 2.5e-11'],
    };
    const [lbl, ph] = labels[known] || labels.conc;
    const fieldsEl = document.getElementById('ph-smart-value-fields');
    if (fieldsEl) {
      fieldsEl.innerHTML = `<div style="margin-bottom:10px;">
        <label class="stoi-lbl">${lbl}</label>
        <input type="number" id="ph-smart-val" min="0" step="any" placeholder="${ph}"
          class="stoi-num-input" style="width:100%;box-sizing:border-box;" />
      </div>`;
    }
    // If not concentration, weak acid/base K field may still be needed — re-run detect
    const raw = document.getElementById('ph-smart-formula')?.value || '';
    if (raw.trim()) smartDetect();
  }

  // ── CALCULATE DISPATCHER ──
  function calculate() {
    try {
      switch (currentMode) {
        case 'smart':        calcSmart();       break;
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

  // ── SMART CALCULATION ──
  function calcSmart() {
    const raw = document.getElementById('ph-smart-formula')?.value?.trim();
    if (!raw) throw new Error('Enter a chemical formula.');

    const compound = detectCompound(raw);
    const known = document.querySelector('input[name="ph-smart-known"]:checked')?.value || 'conc';
    const valRaw = parseFloat(document.getElementById('ph-smart-val')?.value);
    if (isNaN(valRaw)) throw new Error('Enter a value for the known quantity.');

    // If compound not recognized, check for manual override
    let overrideType = null;
    let overrideN = 1;
    if (!compound) {
      overrideType = document.querySelector('input[name="ph-smart-override"]:checked')?.value || null;
      if (!overrideType && known === 'conc') {
        throw new Error('Compound not recognized. Please select the substance type (Strong Acid, Weak Acid, etc.) that appeared below the formula field.');
      }
      overrideN = parseInt(document.getElementById('ph-smart-n-override')?.value) || 1;
    }

    // Resolve compound type — use detected or manual override
    const cType  = compound?.type || overrideType;
    const n      = compound?.n || overrideN;
    const cName  = compound ? `${compound.name} (${compound.f})` : `${raw} (type manually specified)`;

    // ── Convert known value to [H3O+] and [OH-] ──
    let pH, pOH, h3o, oh;
    let concentrationProvided = false;
    let C = null;

    if (known === 'pH') {
      pH  = valRaw;
      pOH = 14 - pH;
      h3o = Math.pow(10, -pH);
      oh  = Math.pow(10, -pOH);
    } else if (known === 'pOH') {
      pOH = valRaw;
      pH  = 14 - pOH;
      h3o = Math.pow(10, -pH);
      oh  = Math.pow(10, -pOH);
    } else if (known === 'h3o') {
      if (valRaw <= 0) throw new Error('[H₃O⁺] must be positive.');
      h3o = valRaw;
      pH  = -Math.log10(h3o);
      pOH = 14 - pH;
      oh  = Math.pow(10, -pOH);
    } else if (known === 'oh') {
      if (valRaw <= 0) throw new Error('[OH⁻] must be positive.');
      oh  = valRaw;
      pOH = -Math.log10(oh);
      pH  = 14 - pOH;
      h3o = Math.pow(10, -pH);
    } else {
      // Concentration — need compound type to proceed
      if (!compound && !overrideType) throw new Error('Compound not recognized. Please select the substance type below the formula field.');
      concentrationProvided = true;
      C = valRaw;
      if (C <= 0) throw new Error('Concentration must be positive.');
    }

    // Resolve Ka/Kb for weak species
    let Ka = null, Kb = null;
    if (cType === 'weak-acid' || cType === 'weak-base') {
      const kvalInput = parseFloat(document.getElementById('ph-smart-kval')?.value);
      const ktype     = document.querySelector('input[name="ph-smart-ktype"]:checked')?.value || 'Ka';

      if (!isNaN(kvalInput) && kvalInput > 0) {
        // User override
        if (cType === 'weak-acid') {
          Ka = ktype === 'Ka' ? kvalInput : Kw / kvalInput;
        } else {
          Kb = ktype === 'Kb' ? kvalInput : Kw / kvalInput;
        }
      } else if (compound?.Ka) {
        Ka = compound.Ka;
      } else if (compound?.Kb) {
        Kb = compound.Kb;
      } else if (concentrationProvided) {
        throw new Error('Ka or Kb is required for weak acid/base calculations from concentration.');
      }
      if (Ka) Kb = Kw / Ka;
      if (Kb && !Ka) Ka = Kw / Kb;
    }

    // ── Solve from concentration using proper chemistry ──
    if (concentrationProvided) {
      if (cType === 'strong-acid') {
        h3o = C * n;
        pH  = -Math.log10(h3o);
        pOH = 14 - pH;
        oh  = Math.pow(10, -pOH);
      } else if (cType === 'strong-base') {
        oh  = C * n;
        pOH = -Math.log10(oh);
        pH  = 14 - pOH;
        h3o = Math.pow(10, -pH);
      } else if (cType === 'weak-acid') {
        const disc = Ka*Ka + 4*Ka*C;
        const x = (-Ka + Math.sqrt(disc)) / 2;
        h3o = x;
        pH  = -Math.log10(h3o);
        pOH = 14 - pH;
        oh  = Math.pow(10, -pOH);
      } else if (cType === 'weak-base') {
        const disc = Kb*Kb + 4*Kb*C;
        const x = (-Kb + Math.sqrt(disc)) / 2;
        oh  = x;
        pOH = -Math.log10(oh);
        pH  = 14 - pOH;
        h3o = Math.pow(10, -pH);
      }
    }

    // ── Build step-by-step ──
    const pKa = Ka ? -Math.log10(Ka) : null;
    const pKb = Kb ? -Math.log10(Kb) : null;

    let typeLabel = cType
      ? { 'strong-acid':'Strong Acid','strong-base':'Strong Base','weak-acid':'Weak Acid','weak-base':'Weak Base' }[cType]
      : 'Unknown type — solved from given value';

    const steps = buildSmartSteps(cName, cType, n, known, valRaw, C, Ka, Kb, h3o, oh, pH, pOH);
    const warnings = buildSmartWarnings(cType, compound, n, known);

    const el = document.getElementById('ph-results');
    el.innerHTML = `
      <h2 style="margin-bottom:4px;font-size:18px;color:#1a2a4a;">🔍 Smart Mode Result</h2>
      <div style="font-size:12px;color:#555;margin-bottom:12px;">
        ${cName} &nbsp;·&nbsp; <span style="font-weight:700;color:${
          {'strong-acid':'#e94560','strong-base':'#1a56a8','weak-acid':'#d35400','weak-base':'#2e7d32'}[cType]||'#555'
        };">${typeLabel}</span>
        ${n > 1 ? ` &nbsp;·&nbsp; ${n} ions/formula unit` : ''}
      </div>
      ${warnings}
      ${makeResultsBox(pH, pOH, h3o, oh, Ka, Kb)}
      <div class="results-section-title">Step-by-Step Solution</div>
      <div style="background:#f8f9ff;border:1px solid #dde3f0;border-radius:6px;padding:14px;
        line-height:1.8;font-size:13px;">${steps}</div>`;
  }

  function buildSmartWarnings(cType, compound, n, known) {
    let w = '';
    if (!compound) {
      w += note('⚠ Compound not in database. Result is calculated directly from the given value — no chemistry model applied.', '#856404');
    } else if (n > 1 && known === 'conc') {
      w += note(`ℹ ${compound.name} releases <strong>${n} ions per formula unit</strong>. The ion concentration = ${n} × molar concentration.`, '#1a56a8');
    }
    return w;
  }

  function buildSmartSteps(cName, cType, n, known, valRaw, C, Ka, Kb, h3o, oh, pH, pOH) {
    const pKa = Ka ? -Math.log10(Ka) : null;
    const pKb = Kb ? -Math.log10(Kb) : null;
    let steps = [];

    steps.push(stepLine(1, `Identified: <strong>${cName}</strong> → <strong>${
      {'strong-acid':'strong acid','strong-base':'strong base','weak-acid':'weak acid','weak-base':'weak base'}[cType]||'unknown'
    }</strong>`));

    if (known === 'conc') {
      steps.push(stepLine(2, `Given: molar concentration C = ${valRaw} mol/L`));
      if ((cType === 'strong-acid' || cType === 'strong-base') && n > 1) {
        const ionName = cType === 'strong-acid' ? '[H₃O⁺]' : '[OH⁻]';
        steps.push(stepLine(3, `${cType === 'strong-base' ? 'Strong base dissociates completely.' : 'Strong acid dissociates completely.'} Multiply by n = ${n}:`));
        steps.push(eq(`${ionName} = C × n = ${valRaw} × ${n} = ${(valRaw*n).toExponential(4)} M`));
      } else if (cType === 'strong-acid') {
        steps.push(stepLine(3, 'Strong acid dissociates completely:'));
        steps.push(eq(`[H₃O⁺] = C = ${valRaw} mol/L`));
      } else if (cType === 'strong-base') {
        steps.push(stepLine(3, 'Strong base dissociates completely:'));
        steps.push(eq(`[OH⁻] = C = ${valRaw} mol/L`));
      } else if (cType === 'weak-acid') {
        steps.push(stepLine(3, `Weak acid — Ka = ${Ka.toExponential(4)}. Solve using ICE table quadratic:`));
        steps.push(eq(`x = [−Ka + √(Ka² + 4·Ka·C)] / 2`));
        steps.push(eq(`x = [H₃O⁺] = ${h3o.toExponential(4)} M`));
      } else if (cType === 'weak-base') {
        steps.push(stepLine(3, `Weak base — Kb = ${Kb.toExponential(4)}. Solve using ICE table quadratic:`));
        steps.push(eq(`x = [−Kb + √(Kb² + 4·Kb·C)] / 2`));
        steps.push(eq(`x = [OH⁻] = ${oh.toExponential(4)} M`));
      }
    } else if (known === 'pH') {
      steps.push(stepLine(2, `Given: pH = ${valRaw}`));
      steps.push(eq(`[H₃O⁺] = 10<sup>−${valRaw}</sup> = ${h3o.toExponential(4)} M`));
    } else if (known === 'pOH') {
      steps.push(stepLine(2, `Given: pOH = ${valRaw}`));
      steps.push(eq(`[OH⁻] = 10<sup>−${valRaw}</sup> = ${oh.toExponential(4)} M`));
    } else if (known === 'h3o') {
      steps.push(stepLine(2, `Given: [H₃O⁺] = ${valRaw} M`));
      steps.push(eq(`pH = −log(${valRaw}) = ${fmt2(pH)}`));
    } else if (known === 'oh') {
      steps.push(stepLine(2, `Given: [OH⁻] = ${valRaw} M`));
      steps.push(eq(`pOH = −log(${valRaw}) = ${fmt2(pOH)}`));
    }

    const step4 = steps.length + 1;
    steps.push(stepLine(step4, 'Calculate all remaining values:'));
    steps.push(eq(`pH = ${fmt2(pH)}`));
    steps.push(eq(`pOH = 14.00 − ${fmt2(pH)} = ${fmt2(pOH)}`));
    steps.push(eq(`[H₃O⁺] = 10<sup>−${fmt2(pH)}</sup> = ${sci(h3o)} M`));
    steps.push(eq(`[OH⁻] = 10<sup>−${fmt2(pOH)}</sup> = ${sci(oh)} M`));
    if (pKa !== null) steps.push(eq(`pKa = −log(Ka) = ${fmt2(pKa)}`));
    if (pKb !== null) steps.push(eq(`pKb = −log(Kb) = ${fmt2(pKb)}`));

    return steps.join('');
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
    const solve = document.getElementById('ph-buf-solve')?.value || 'pH';
    if (solve === 'ratio') { calcBufferRatio(); return; }

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

  // ── BUFFER: SOLVE FOR RATIO ──
  function calcBufferRatio() {
    const bufType = document.getElementById('ph-buf-type')?.value;
    const targetPH = requirePositive(parseFloat(document.getElementById('ph-buf-target-ph')?.value), 'Target pH');
    if (targetPH > 14 || targetPH < 0) throw new Error('pH must be between 0 and 14.');
    const ktype = document.getElementById('ph-buf-ktype')?.value;
    const kval  = requirePositive(parseFloat(document.getElementById('ph-buf-kval')?.value), 'Equilibrium constant value');

    let Ka, pKa, convStep = '';
    if (ktype === 'pKa') {
      pKa = kval;
      Ka  = Math.pow(10, -pKa);
      convStep = stepLine(2, `pKa given directly: <strong>pKa = ${fmt2(pKa)}</strong>`);
    } else if (ktype === 'Ka') {
      Ka  = kval;
      pKa = -Math.log10(Ka);
      convStep = stepLine(2, `Ka given: Ka = ${Ka.toExponential(4)}<br>
        Convert to pKa: pKa = −log(${Ka.toExponential(4)}) = <strong>${fmt2(pKa)}</strong>`);
    } else {
      Ka  = Kw / kval;
      pKa = -Math.log10(Ka);
      convStep = stepLine(2, `Kb given. Convert to Ka: Ka = Kw / Kb = ${Ka.toExponential(4)}<br>
        Convert to pKa: pKa = −log(${Ka.toExponential(4)}) = <strong>${fmt2(pKa)}</strong>`);
    }

    const Kb  = Kw / Ka;
    const pKb = -Math.log10(Kb);

    // Henderson–Hasselbalch rearranged:
    // pH = pKa + log([A⁻]/[HA])
    // log([A⁻]/[HA]) = pH − pKa
    // [A⁻]/[HA] = 10^(pH − pKa)
    const logRatio = targetPH - pKa;
    const ratio    = Math.pow(10, logRatio);

    // Express as a clean ratio  e.g. "2.34 : 1" or "1 : 0.43"
    let ratioStr;
    if (ratio >= 1) {
      ratioStr = `${fmt4(ratio)} : 1 &nbsp;(or ${fmt4(ratio)} mol A⁻ per mol HA)`;
    } else {
      ratioStr = `1 : ${fmt4(1/ratio)} &nbsp;(or 1 mol A⁻ per ${fmt4(1/ratio)} mol HA)`;
    }

    const acidLabel = bufType === 'acid' ? '[A⁻] / [HA]' : '[B] / [BH⁺]';
    const pOH = 14 - targetPH;
    const h3o = Math.pow(10, -targetPH);
    const oh  = Math.pow(10, -pOH);

    const steps = [
      stepLine(1, `We need to find the ratio <strong>${acidLabel}</strong> that produces a buffer at <strong>pH = ${fmt2(targetPH)}</strong>.`),
      convStep,
      stepLine(3, 'Write the Henderson–Hasselbalch equation:'),
      eq(`pH = pKa + log([A⁻] / [HA])`),
      stepLine(4, 'Rearrange to isolate the log term — subtract pKa from both sides:'),
      eq(`log([A⁻] / [HA]) = pH − pKa`),
      stepLine(5, 'Substitute the known values:'),
      eq(`log([A⁻] / [HA]) = ${fmt2(targetPH)} − ${fmt2(pKa)}`),
      eq(`log([A⁻] / [HA]) = ${fmt2(logRatio)}`),
      stepLine(6, 'Solve for the ratio — raise both sides as a power of 10:'),
      eq(`[A⁻] / [HA] = 10<sup>${fmt2(logRatio)}</sup>`),
      eq(`[A⁻] / [HA] = <strong>${fmt4(ratio)}</strong>`),
      stepLine(7, 'Interpret the result:'),
      `<div style="background:#e8f5e9;border:1px solid #4caf50;border-radius:6px;padding:12px 14px;
        margin:4px 0 8px 28px;">
        <div style="font-size:13px;font-weight:700;color:#1a2a4a;margin-bottom:6px;">
          Ratio [A⁻]:[HA] = ${ratioStr}
        </div>
        <div style="font-size:12px;color:#2e7d32;line-height:1.6;">
          To prepare this buffer, use ${fmt4(ratio)} times as many moles (or mol/L) of
          <strong>conjugate base</strong> as <strong>weak acid</strong>.
          Any combination that preserves this ratio will give pH = ${fmt2(targetPH)}.
        </div>
      </div>`,
      ratio >= 0.1 && ratio <= 10
        ? note('✓ This ratio is within the reliable buffer range (0.1–10). Henderson–Hasselbalch is valid here.', '#2e7d32')
        : note(`⚠ This ratio (${fmt4(ratio)}) is outside the optimal buffer range (0.1–10). At this ratio the buffer has very limited capacity to resist pH changes.`, '#b71c1c'),
      stepLine(8, 'Calculate the remaining solution properties at this pH:'),
      eq(`pOH = 14.00 − ${fmt2(targetPH)} = ${fmt2(pOH)}`),
      eq(`[H₃O⁺] = 10<sup>−${fmt2(targetPH)}</sup> = ${sci(h3o)} M`),
      eq(`[OH⁻]  = 10<sup>−${fmt2(pOH)}</sup> = ${sci(oh)} M`),
    ].join('');

    // Custom result box with ratio prominently displayed
    const el = document.getElementById('ph-results');
    el.innerHTML = `
      <h2 style="margin-bottom:4px;font-size:18px;color:#1a2a4a;">🧮 Buffer — Solve for Ratio</h2>
      <div style="font-size:12px;color:#555;margin-bottom:12px;">
        Target pH = ${fmt2(targetPH)} &nbsp;·&nbsp; pKa = ${fmt2(pKa)}
      </div>

      <div style="background:#e8f5e9;border:2px solid #4caf50;border-radius:8px;
        padding:14px 16px;margin-bottom:14px;text-align:center;">
        <div style="font-size:11px;color:#555;font-weight:700;text-transform:uppercase;
          letter-spacing:0.5px;margin-bottom:4px;">[A⁻] / [HA] Ratio</div>
        <div style="font-size:28px;font-weight:700;color:#1a2a4a;">${fmt4(ratio)}</div>
        <div style="font-size:12px;color:#2e7d32;margin-top:4px;">
          ${ratio >= 1
            ? `${fmt4(ratio)} mol conjugate base per 1 mol weak acid`
            : `1 mol conjugate base per ${fmt4(1/ratio)} mol weak acid`}
        </div>
      </div>

      ${makeResultsBox(targetPH, pOH, h3o, oh, Ka, Kb)}
      <div class="results-section-title">Step-by-Step Solution</div>
      <div style="background:#f8f9ff;border:1px solid #dde3f0;border-radius:6px;padding:14px;
        line-height:1.8;font-size:13px;">${steps}</div>`;
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

    // Store chart state globally on the module
    _tit = {
      type, points, Veq, Vmid, pHInit, pHMid, pHEquiv, pHAfter, Ka, Kb, pKa, pKb,
      isWeak, molesA, aVol, tConc,
      // Draggable label positions (canvas coords, null = auto)
      labelPos: { equiv: null, halfEquiv: null, pka: null, buffer: null },
      // User-added points
      userPoints: [],
      // Style settings (defaults)
      style: {
        titleText: '', titleSize: 14, titleBold: true, titleColor: '#1a2a4a', titleAlign: 'center',
        labelSize: 10, labelBold: false, labelColor: '#1a2a4a',
        equivColor: '#f39c12', halfEquivColor: '#e94560', pkaColor: '#2ecc71',
        bufferColor: 'rgba(76,175,80,0.12)',
        pointLineColor: '#4a90e2', pointLineWidth: 1,
        showInitialPH: true, showHalfEquivPH: true, showEquivPH: true, showAfterEquiv: true, showPKa: true,
      },
    };

    const el = document.getElementById('ph-results');
    el.innerHTML = `
      <h2 style="margin-bottom:12px;font-size:18px;color:#1a2a4a;">📈 Titration Curve</h2>
      <div style="background:#f0f6ff;border:1px solid #c8d5ee;border-radius:6px;
        padding:10px 14px;margin-bottom:10px;font-size:12px;">
        <strong>${typeLabels[type]}</strong><br>
        Analyte: ${(molesA*1000).toFixed(4)} mmol in ${aVol} mL &nbsp;|&nbsp;
        Titrant: ${tConc} mol/L &nbsp;|&nbsp;
        Equiv. vol: <strong>${Veq.toFixed(2)} mL</strong>
        ${isWeak && pKa ? ` &nbsp;|&nbsp; pKa = <strong>${pKa.toFixed(2)}</strong>` : ''}
      </div>

      <canvas id="ph-tit-canvas" width="580" height="360"
        style="width:100%;border:1px solid #dde3f0;border-radius:6px;background:#fff;cursor:crosshair;"
        title="Click to add a point"></canvas>

      <div id="ph-tit-keypoints" style="margin-top:12px;"></div>

      <div class="results-section-title" style="margin-top:8px;">How to Read This Curve</div>
      <div style="background:#f8f9ff;border:1px solid #dde3f0;border-radius:6px;padding:14px;
        font-size:13px;line-height:1.8;margin-bottom:16px;">
        ${titrationExplanation(type, Veq, Vmid, pHInit, pHMid, pHEquiv, pKa, pKb)}
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-bottom:8px;" id="ph-tit-export-row">
        <button class="stoi-export-btn" onclick="PhCalculator.exportCurve()">⬇ Export Graph Only</button>
        <button class="stoi-export-btn" onclick="PhCalculator.exportFull()">⬇ Export Graph + Data + Explanation</button>
      </div>`;

    requestAnimationFrame(() => {
      _renderKeyPointCards();
      _initCanvas();
      redrawChart();
    });
  }

  function _renderKeyPointCards() {
    const s = _tit.style;
    const kpEl = document.getElementById('ph-tit-keypoints');
    if (!kpEl) return;
    const colors = {
      initial:   s.equivColor,   // reuse equiv color for initial (blue by default)
      halfEquiv: s.halfEquivColor,
      equiv:     s.equivColor,
      after:     '#9b59b6',
      pka:       s.pkaColor,
    };
    // Override: initial and after equiv use fixed color unless set
    const initColor  = '#4a90e2';
    const afterColor = '#9b59b6';

    const makeCard = (id, label, value, color, showKey) => {
      if (!_tit[showKey] && _tit[showKey] !== undefined) return '';
      const show = s[showKey] !== false;
      return `<div id="ph-kp-${id}" style="background:#fff;border:1px solid #dde3f0;border-radius:6px;
        padding:8px 10px;border-top:3px solid ${color};opacity:${show?1:0.4};">
        <div style="font-size:10px;color:#888;font-weight:700;text-transform:uppercase;">${label}</div>
        <div style="font-size:18px;font-weight:700;color:#1a2a4a;">${value}</div>
      </div>`;
    };

    const { isWeak, pHInit, pHMid, pHEquiv, pHAfter, pKa } = _tit;
    const fmt = v => v !== null && v !== undefined ? v.toFixed(2) : '—';

    let html = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:6px;margin-bottom:12px;">`;
    if (s.showInitialPH  !== false) html += makeCard('init',    'Initial pH',    fmt(pHInit),  initColor,  'showInitialPH');
    if (isWeak && s.showHalfEquivPH !== false)
      html += makeCard('half', 'Half-equiv. pH', fmt(pHMid), s.halfEquivColor, 'showHalfEquivPH');
    if (s.showEquivPH    !== false) html += makeCard('equiv',   'Equiv. pH',     fmt(pHEquiv), s.equivColor, 'showEquivPH');
    if (s.showAfterEquiv !== false) html += makeCard('after',   'After equiv.',  fmt(pHAfter), afterColor,  'showAfterEquiv');
    if (isWeak && pKa !== null && s.showPKa !== false)
      html += makeCard('pka', 'pKa', fmt(pKa), s.pkaColor, 'showPKa');
    html += `</div>`;
    kpEl.innerHTML = html;
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
          At this point <strong>pH = pKa = ${pKa?.toFixed(2) ?? '—'}</strong>.
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
        <p style="margin:0 0 6px;"><strong>Equivalence point (${Veq.toFixed(1)} mL):</strong> pH ≈ 7.00. Both acid and base are fully neutralized.</p>
        <p style="margin:0 0 0;"><strong>After equivalence:</strong> Excess titrant controls pH.</p>`;
    }
    return html;
  }

  // ── INTERACTIVE CANVAS ──
  let _tit = null; // current titration state
  const PAD = { top: 40, right: 30, bottom: 50, left: 55 };

  function _initCanvas() {
    const canvas = document.getElementById('ph-tit-canvas');
    if (!canvas) return;
    canvas.addEventListener('mousedown', _onCanvasMouseDown);
    canvas.addEventListener('mousemove', _onCanvasMouseMove);
    canvas.addEventListener('mouseup',   _onCanvasMouseUp);
    canvas.addEventListener('mouseleave',_onCanvasMouseUp);
    canvas._dragging = null;
  }

  function _canvasCoords(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function _xScale(canvas, maxX) {
    const CW = canvas.width - PAD.left - PAD.right;
    return v => PAD.left + (v / maxX) * CW;
  }
  function _yScale(canvas) {
    const CH = canvas.height - PAD.top - PAD.bottom;
    return pH => PAD.top + (1 - pH / 14) * CH;
  }
  function _xInv(canvas, maxX) {
    const CW = canvas.width - PAD.left - PAD.right;
    return px => ((px - PAD.left) / CW) * maxX;
  }
  function _yInv(canvas) {
    const CH = canvas.height - PAD.top - PAD.bottom;
    return py => (1 - (py - PAD.top) / CH) * 14;
  }

  // ── POINT SYSTEM (adapted from Solubility Curve Generator) ──
  // Each user point: { vx, vy, showCoord, showDotted, dotColor, lineColor, lineThick, customLabel, labelOff }
  // labelOff = {dx, dy} canvas offset for draggable label; null = auto

  function _defaultPointProps() {
    const g = id => document.getElementById(id);
    return {
      showCoord:   g('ph-def-coord')   ? g('ph-def-coord').checked   : true,
      showDotted:  g('ph-def-dotted')  ? g('ph-def-dotted').checked  : true,
      snapToLine:  g('ph-def-snap')    ? g('ph-def-snap').checked    : false,
      dotColor:    g('ph-def-dot-color')  ? g('ph-def-dot-color').value  : '#e94560',
      lineColor:   g('ph-def-line-color') ? g('ph-def-line-color').value : '#555555',
      lineThick:   g('ph-def-thick-num')  ? parseFloat(g('ph-def-thick-num').value) || 1 : 1,
      labelOff:    null,
    };
  }

  function addPointManual() {
    // Manual add — no canvas click, just use snap or free placement at midpoint
    if (!_tit) { showAlert('Run a titration calculation first.', true); return; }
    const maxX = _tit.points.length ? _tit.points[_tit.points.length-1].x : 60;
    const props = _defaultPointProps();
    const vx = Math.round(maxX / 2 * 10) / 10;
    const vy = props.snapToLine ? (Math.round((_interpCurve(vx) || 7) * 100) / 100) : 7;
    _tit.userPoints.push({ vx, vy, ...props });
    _rebuildPointsList();
    redrawChart();
  }

  // Convert canvas pixel → data coords
  function _pxToData(canvas, px, py) {
    const maxX = _tit.points.length ? _tit.points[_tit.points.length-1].x : 60;
    const CW = canvas.width - PAD.left - PAD.right;
    const CH = canvas.height - PAD.top - PAD.bottom;
    const vx = _tit.points.length ? (px - PAD.left) / CW * maxX : 0;
    const vy = (1 - (py - PAD.top) / CH) * 14;
    return { vx: Math.round(vx * 10)/10, vy: Math.round(Math.min(Math.max(vy,0),14)*100)/100 };
  }

  function _dataToPx(canvas, vx, vy) {
    const maxX = _tit.points.length ? _tit.points[_tit.points.length-1].x : 60;
    const CW = canvas.width - PAD.left - PAD.right;
    const CH = canvas.height - PAD.top - PAD.bottom;
    return {
      px: PAD.left + (vx / maxX) * CW,
      py: PAD.top  + (1 - vy / 14) * CH,
    };
  }

  // Interpolate pH from the curve's data points at a given volume vx
  function _interpCurve(vx) {
    const pts = _tit.points;
    if (!pts || pts.length === 0) return null;
    if (vx <= pts[0].x) return pts[0].y;
    if (vx >= pts[pts.length-1].x) return pts[pts.length-1].y;
    for (let i = 0; i < pts.length-1; i++) {
      if (vx >= pts[i].x && vx <= pts[i+1].x) {
        const t = (vx - pts[i].x) / (pts[i+1].x - pts[i].x);
        return pts[i].y + t * (pts[i+1].y - pts[i].y);
      }
    }
    return null;
  }

  // Hit-test priority: user label → user dot → reference labels
  function _hitTest(canvas, mx, my) {
    if (!_tit) return null;
    const { userPoints, labelPos, isWeak, Veq, Vmid, pKa, style } = _tit;
    const maxX = _tit.points.length ? _tit.points[_tit.points.length-1].x : 60;
    const xs = _xScale(canvas, maxX), ys = _yScale(canvas);

    // 1. User label text boxes
    for (let i = userPoints.length-1; i >= 0; i--) {
      const up = userPoints[i];
      if (!up.showCoord) continue;
      const { px, py } = _dataToPx(canvas, up.vx, up.vy);
      const lx = up.labelOff ? px + up.labelOff.dx : px + 8;
      const ly = up.labelOff ? py + up.labelOff.dy : py - 8;
      const txt = (up.customLabel && up.customLabel.trim()) ? up.customLabel.trim()
                  : '(' + up.vx.toFixed(1) + ', ' + up.vy.toFixed(2) + ')';
      const tw = txt.length * (style.labelSize * 0.58);
      const th = style.labelSize + 2;
      if (mx >= lx-2 && mx <= lx+tw+4 && my >= ly-th && my <= ly+4) {
        return { kind: 'userLabel', idx: i, offX: mx-lx, offY: my-ly };
      }
    }

    // 2. User point dots
    for (let i = userPoints.length-1; i >= 0; i--) {
      const up = userPoints[i];
      const { px, py } = _dataToPx(canvas, up.vx, up.vy);
      if (Math.hypot(mx-px, my-py) <= 10) return { kind: 'userDot', idx: i };
    }

    // 3. Reference labels
    const refR = 20;
    const refs = [
      { key: 'equiv', cx: labelPos.equiv ? labelPos.equiv.x : xs(Veq)+3, cy: labelPos.equiv ? labelPos.equiv.y : PAD.top+14 },
    ];
    if (isWeak) {
      refs.push({ key: 'halfEquiv', cx: labelPos.halfEquiv ? labelPos.halfEquiv.x : xs(Vmid)+3, cy: labelPos.halfEquiv ? labelPos.halfEquiv.y : PAD.top+28 });
      refs.push({ key: 'buffer', cx: labelPos.buffer ? labelPos.buffer.x : xs(Vmid/2), cy: labelPos.buffer ? labelPos.buffer.y : canvas.height-PAD.bottom-10 });
      if (pKa !== null) refs.push({ key: 'pka', cx: labelPos.pka ? labelPos.pka.x : canvas.width-PAD.right-50, cy: labelPos.pka ? labelPos.pka.y : ys(pKa)-6 });
    }
    for (const r of refs) {
      if (Math.abs(mx-r.cx) < refR && Math.abs(my-r.cy) < 14) return { kind: 'refLabel', key: r.key, offX: mx-r.cx, offY: my-r.cy };
    }
    return null;
  }

  function _onCanvasMouseDown(e) {
    const canvas = this;
    const { x, y } = _canvasCoords(canvas, e);
    const hit = _hitTest(canvas, x, y);
    if (hit) {
      canvas._drag = { ...hit, startX: x, startY: y, moved: false,
        origVx: hit.kind==='userDot' ? _tit.userPoints[hit.idx].vx : 0,
        origVy: hit.kind==='userDot' ? _tit.userPoints[hit.idx].vy : 0,
      };
      canvas.style.cursor = 'grabbing';
      e.preventDefault(); return;
    }
    // Click in plot area = add point
    if (!_tit) return;
    const CW = canvas.width - PAD.left - PAD.right;
    const CH = canvas.height - PAD.top - PAD.bottom;
    if (x >= PAD.left && x <= PAD.left+CW && y >= PAD.top && y <= PAD.top+CH) {
      const { vx, vy } = _pxToData(canvas, x, y);
      _tit.userPoints.push({ vx, vy, ..._defaultPointProps() });
      _rebuildPointsList();
      redrawChart();
    }
  }

  function _onCanvasMouseMove(e) {
    const canvas = this;
    const { x, y } = _canvasCoords(canvas, e);

    if (!canvas._drag) {
      const hit = _hitTest(canvas, x, y);
      canvas.style.cursor = hit ? (hit.kind==='userDot'?'move':'grab') : 'crosshair';
      return;
    }

    const d = canvas._drag;
    d.moved = true;

    if (d.kind === 'userDot') {
      const CW = canvas.width - PAD.left - PAD.right;
      const CH = canvas.height - PAD.top - PAD.bottom;
      const cx = Math.max(PAD.left, Math.min(PAD.left+CW, x));
      const cy = Math.max(PAD.top,  Math.min(PAD.top+CH,  y));
      const up = _tit.userPoints[d.idx];
      let { vx, vy } = _pxToData(canvas, cx, cy);
      if (up.snapToLine) {
        // Constrain to curve: only vx changes, vy is interpolated
        const maxX = _tit.points[_tit.points.length-1].x;
        vx = Math.max(0, Math.min(maxX, vx));
        const snapped = _interpCurve(vx);
        if (snapped !== null) vy = Math.round(snapped * 100) / 100;
      }
      up.vx = vx; up.vy = vy;
      redrawChart();
      const el = document.getElementById('ph-pt-coords-'+d.idx);
      if (el) el.textContent = '('+vx.toFixed(1)+' mL, pH '+vy.toFixed(2)+')';

    } else if (d.kind === 'userLabel') {
      const up = _tit.userPoints[d.idx];
      const { px, py } = _dataToPx(canvas, up.vx, up.vy);
      up.labelOff = { dx: (x-d.offX)-px, dy: (y-d.offY)-py };
      redrawChart();

    } else if (d.kind === 'refLabel') {
      _tit.labelPos[d.key] = { x: x-d.offX, y: y-d.offY };
      redrawChart();
    }
  }

  function _onCanvasMouseUp() {
    const canvas = document.getElementById('ph-tit-canvas');
    if (!canvas) return;
    if (canvas._drag?.kind === 'userDot' && canvas._drag.moved) _rebuildPointsList();
    canvas._drag = null;
    canvas.style.cursor = 'crosshair';
  }

  // ── POINT LIST — exact solubility curve approach, imperative DOM ──
  function _rebuildPointsList() {
    const list = document.getElementById('ph-user-points-list');
    if (!list || !_tit) return;
    list.innerHTML = '';
    const { userPoints } = _tit;

    if (!userPoints.length) {
      list.innerHTML = '<div style="font-size:11px;color:var(--text-dim);padding:4px 0;">Click the graph to add points.</div>';
      return;
    }

    const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    userPoints.forEach((up, i) => {
      const letter = LABELS[i % LABELS.length];
      const xR = up.vx.toFixed(1), yR = up.vy.toFixed(2);

      const card = document.createElement('div');
      card.className = 'point-card';
      card.id = 'ph-point-card-' + i;
      const displayLetter = up.customLetter && up.customLetter.trim() ? up.customLetter.trim() : letter;
      card.innerHTML = `
        <div class="point-card-header">
          <div class="point-label-badge" style="background:${up.dotColor||'#e94560'};">${displayLetter}</div>
          <div class="point-coords" id="ph-pt-coords-${i}">${xR} mL, pH ${yR}</div>
          <button class="point-delete" title="Remove">×</button>
        </div>
        <div class="point-toggles">
          <label class="point-toggle"><input type="checkbox" class="pt-dotted" ${up.showDotted?'checked':''} /> Show projection lines</label>
          <label class="point-toggle"><input type="checkbox" class="pt-coord"  ${up.showCoord ?'checked':''} /> Show ordered pair label</label>
          <label class="point-toggle"><input type="checkbox" class="pt-snap"   ${up.snapToLine?'checked':''} /> Snap to curve line</label>
        </div>
        <div style="margin-bottom:6px;">
          <label class="stoi-lbl" style="display:block;margin-bottom:3px;">Point label</label>
          <input type="text" class="pt-letter" value="${up.customLetter||''}" placeholder="${letter} (default)"
            class="stoi-num-input" style="width:100%;box-sizing:border-box;background:var(--bg);
              border:1px solid var(--border2);border-radius:4px;color:var(--text);
              font-size:12px;padding:5px 8px;outline:none;" />
        </div>
        <div class="point-color-row">
          <label>Dot</label>
          <button class="color-swatch-btn pt-dot-sw" style="background:${up.dotColor||'#e94560'};width:22px;height:22px;"></button>
          <label style="margin-left:5px;">Line</label>
          <button class="color-swatch-btn pt-line-sw" style="background:${up.lineColor||'#555555'};width:22px;height:22px;"></button>
        </div>
        <div class="point-thick-row">
          <label>Thickness</label>
          <input type="range" class="pt-thick-r" min="0.5" max="4" step="0.5" value="${up.lineThick||1}" />
          <input type="number" class="pt-thick-n" min="0.5" max="4" step="0.5" value="${up.lineThick||1}" />
        </div>`;

      // Wire events — exactly as solubility curve does it
      card.querySelector('.point-delete').onclick = () => {
        userPoints.splice(i, 1); _rebuildPointsList(); redrawChart();
      };
      card.querySelector('.pt-dotted').onchange = e => { up.showDotted = e.target.checked; redrawChart(); };
      card.querySelector('.pt-coord').onchange  = e => { up.showCoord  = e.target.checked; redrawChart(); };
      card.querySelector('.pt-snap').onchange   = e => { toggleSnapToLine(i, e.target.checked); };

      card.querySelector('.pt-letter').oninput = e => {
        up.customLetter = e.target.value;
        const badge = card.querySelector('.point-label-badge');
        const LABELS2 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const def = LABELS2[i % LABELS2.length];
        if (badge) badge.textContent = e.target.value.trim() || def;
        redrawChart();
      };

      const dotSw = card.querySelector('.pt-dot-sw');
      dotSw.addEventListener('click', ev => {
        ev.stopPropagation();
        openColorPicker(dotSw, up.dotColor || '#e94560', col => {
          up.dotColor = col; dotSw.style.background = col;
          const badge = card.querySelector('.point-label-badge');
          if (badge) badge.style.background = col;
          redrawChart();
        });
      });

      const lineSw = card.querySelector('.pt-line-sw');
      lineSw.addEventListener('click', ev => {
        ev.stopPropagation();
        openColorPicker(lineSw, up.lineColor || '#555555', col => {
          up.lineColor = col; lineSw.style.background = col; redrawChart();
        });
      });

      const tr = card.querySelector('.pt-thick-r');
      const tn = card.querySelector('.pt-thick-n');
      tr.oninput = () => { tn.value = tr.value; up.lineThick = parseFloat(tr.value); redrawChart(); };
      tn.onchange = () => { tr.value = tn.value; up.lineThick = parseFloat(tn.value); redrawChart(); };

      list.appendChild(card);
    });
  }

  function updateUserPoint(i, key, value) {
    if (!_tit) return;
    const up = _tit.userPoints[i];
    if (!up) return;
    up[key] = value;
    redrawChart();
  }

  function toggleSnapToLine(i, snap) {
    if (!_tit) return;
    const up = _tit.userPoints[i];
    if (!up) return;
    up.snapToLine = snap;
    if (snap) {
      // Immediately snap vy to the curve at current vx
      const snapped = _interpCurve(up.vx);
      if (snapped !== null) up.vy = Math.round(snapped * 100) / 100;
      // Update sidebar coords
      const el = document.getElementById('ph-pt-coords-' + i);
      if (el) el.textContent = up.vx.toFixed(1) + ' mL, pH ' + up.vy.toFixed(2);
    }
    redrawChart();
  }

  function removeUserPoint(i) {
    if (!_tit) return;
    _tit.userPoints.splice(i, 1);
    _rebuildPointsList();
    redrawChart();
  }

  function pickPointColor(i, which, btn) {
    if (!_tit) return;
    const up = _tit.userPoints[i];
    if (!up) return;
    const current = which === 'dot' ? up.dotColor : up.lineColor;
    openColorPicker(btn, current, col => {
      if (which === 'dot') {
        up.dotColor = col;
        const b = document.getElementById('ph-pt-dot-'+i);
        if (b) b.style.background = col;
        // Update badge too
        const badge = document.querySelector('#ph-point-card-'+i+' .point-label-badge');
        if (badge) badge.style.background = col;
      } else {
        up.lineColor = col;
        const b = document.getElementById('ph-pt-line-'+i);
        if (b) b.style.background = col;
      }
      redrawChart();
    });
  }

  function clearUserPoints() {
    if (!_tit) return;
    _tit.userPoints = [];
    _rebuildPointsList();
    redrawChart();
  }

    function redrawChart() {
    if (!_tit) return;
    const { type, points, Veq, Vmid, pKa, isWeak, labelPos, style, userPoints } = _tit;
    const canvas = document.getElementById('ph-tit-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const CW = W - PAD.left - PAD.right;
    const CH = H - PAD.top  - PAD.bottom;
    const maxX = points.length ? points[points.length-1].x : 60;
    const xs = v  => PAD.left + (v / maxX) * CW;
    const ys = pH => PAD.top  + (1 - pH / 14) * CH;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);

    // Title
    if (style.titleText && style.titleText.trim()) {
      ctx.save();
      ctx.font = `${style.titleBold?'bold ':' '}${style.titleSize}px Segoe UI, sans-serif`;
      ctx.fillStyle = style.titleColor;
      const tx = style.titleAlign === 'left' ? PAD.left
               : style.titleAlign === 'right' ? PAD.left + CW
               : PAD.left + CW / 2;
      ctx.textAlign = style.titleAlign;
      ctx.fillText(style.titleText, tx, 18);
      ctx.restore();
    }

    // Buffer region
    if (isWeak) {
      ctx.fillStyle = style.bufferColor;
      ctx.fillRect(xs(0), PAD.top, xs(Veq) - xs(0), CH);
    }

    // Grid
    ctx.strokeStyle = '#e8edf5'; ctx.lineWidth = 1;
    for (let ph = 0; ph <= 14; ph += 2) {
      ctx.beginPath(); ctx.moveTo(PAD.left, ys(ph)); ctx.lineTo(PAD.left+CW, ys(ph)); ctx.stroke();
    }
    for (let v = 0; v <= maxX; v += 10) {
      ctx.beginPath(); ctx.moveTo(xs(v), PAD.top); ctx.lineTo(xs(v), PAD.top+CH); ctx.stroke();
    }

    // Reference lines
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = style.equivColor; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(xs(Veq), PAD.top); ctx.lineTo(xs(Veq), PAD.top+CH); ctx.stroke();

    if (isWeak) {
      ctx.strokeStyle = style.halfEquivColor;
      ctx.beginPath(); ctx.moveTo(xs(Vmid), PAD.top); ctx.lineTo(xs(Vmid), PAD.top+CH); ctx.stroke();
      if (pKa !== null) {
        ctx.strokeStyle = style.pkaColor;
        ctx.beginPath(); ctx.moveTo(PAD.left, ys(pKa)); ctx.lineTo(PAD.left+CW, ys(pKa)); ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // Titration curve
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

    // Axis tick labels
    ctx.fillStyle = '#333'; ctx.font = '11px Segoe UI, sans-serif'; ctx.textAlign = 'center';
    for (let ph = 0; ph <= 14; ph += 2) ctx.fillText(ph, PAD.left-22, ys(ph)+4);
    for (let v = 0; v <= maxX; v += 10) ctx.fillText(v, xs(v), PAD.top+CH+18);

    // Axis titles
    ctx.font = 'bold 12px Segoe UI, sans-serif'; ctx.fillStyle = '#1a2a4a'; ctx.textAlign = 'center';
    ctx.fillText('Volume of Titrant Added (mL)', PAD.left+CW/2, H-6);
    ctx.save(); ctx.translate(13, PAD.top+CH/2); ctx.rotate(-Math.PI/2); ctx.fillText('pH', 0, 0); ctx.restore();

    // ── Key reference point markers on graph ──
    ctx.setLineDash([]);
    // Initial pH dot
    if (style.showInitialPH && _tit.pHInit !== null) {
      const ipx = xs(0), ipy = ys(_tit.pHInit);
      ctx.beginPath(); ctx.arc(ipx, ipy, 5, 0, Math.PI*2);
      ctx.fillStyle = '#4a90e2'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // Half-equiv pH dot
    if (isWeak && style.showHalfEquivPH && _tit.pHMid !== null) {
      const hpx = xs(Vmid), hpy = ys(_tit.pHMid);
      ctx.beginPath(); ctx.arc(hpx, hpy, 5, 0, Math.PI*2);
      ctx.fillStyle = style.halfEquivColor; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // Equiv pH dot
    if (style.showEquivPH && _tit.pHEquiv !== null) {
      const epx = xs(Veq), epy = ys(_tit.pHEquiv);
      ctx.beginPath(); ctx.arc(epx, epy, 5, 0, Math.PI*2);
      ctx.fillStyle = style.equivColor; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // pKa dot (intersection of half-equiv line and curve)
    if (isWeak && style.showPKa && pKa !== null) {
      const kpx = xs(Vmid), kpy = ys(pKa);
      ctx.beginPath(); ctx.arc(kpx, kpy, 5, 0, Math.PI*2);
      ctx.fillStyle = style.pkaColor; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // Draggable labels
    const lf = `${style.labelBold?'bold ':' '}${style.labelSize}px Segoe UI, sans-serif`;
    ctx.font = lf;

    const drawLabel = (key, defaultX, defaultY, text, color) => {
      const lx = labelPos[key] ? labelPos[key].x : defaultX;
      const ly = labelPos[key] ? labelPos[key].y : defaultY;
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.fillText(text, lx, ly);
      // Subtle drag handle indicator
      ctx.strokeStyle = color + '66';
      ctx.lineWidth = 1;
      ctx.strokeRect(lx - 2, ly - style.labelSize, ctx.measureText(text).width + 4, style.labelSize + 4);
    };

    drawLabel('equiv', xs(Veq)+3, PAD.top+14, `Equiv. (${Veq.toFixed(1)} mL)`, style.equivColor);

    if (isWeak) {
      drawLabel('halfEquiv', xs(Vmid)+3, PAD.top+28, `½-equiv. (${Vmid.toFixed(1)} mL)`, style.halfEquivColor);
      if (pKa !== null) {
        ctx.textAlign = 'right';
        const lx = labelPos.pka ? labelPos.pka.x : PAD.left+CW-4;
        const ly = labelPos.pka ? labelPos.pka.y : ys(pKa)-4;
        ctx.fillStyle = style.pkaColor;
        ctx.font = lf;
        ctx.fillText(`pKa = ${pKa.toFixed(2)}`, lx, ly);
        ctx.textAlign = 'left';
      }
      ctx.fillStyle = style.bufferColor.replace('0.12','0.8');
      const bx = labelPos.buffer ? labelPos.buffer.x : xs(Vmid/2);
      const by = labelPos.buffer ? labelPos.buffer.y : PAD.top+CH-10;
      ctx.font = `bold ${style.labelSize}px Segoe UI, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#2e7d32';
      ctx.fillText('Buffer Region', bx, by);
    }

    // ── User-added points (solubility curve style) ──
    const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    userPoints.forEach((up, i) => {
      const px = xs(up.vx), py = ys(up.vy);
      const letter = (up.customLetter && up.customLetter.trim()) ? up.customLetter.trim() : LABELS[i % LABELS.length];

      // Dotted projection lines
      if (up.showDotted) {
        ctx.save();
        ctx.setLineDash([4*1, 3*1]); ctx.lineDashOffset = 0;
        ctx.strokeStyle = up.lineColor || '#555'; ctx.lineWidth = up.lineThick || 1;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(PAD.left, py); ctx.stroke();
        ctx.setLineDash([4*1, 3*1]); ctx.lineDashOffset = 0;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, PAD.top+CH); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Dot
      ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI*2);
      ctx.fillStyle = up.dotColor || '#e94560'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();

      // Letter badge above dot
      ctx.font = `bold ${style.labelSize*1.1}px Segoe UI, sans-serif`;
      ctx.textBaseline = 'bottom'; ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
      ctx.strokeText(letter, px, py-7);
      ctx.fillStyle = '#222'; ctx.fillText(letter, px, py-7);

      // Ordered pair label — matches solubility curve exactly
      if (up.showCoord) {
        const ct = `(${up.vx.toFixed(1)} mL, pH ${up.vy.toFixed(2)})`;
        const lx = up.labelOff ? px + up.labelOff.dx : px + 8;
        const ly = up.labelOff ? py + up.labelOff.dy : py - 8;
        ctx.font = `${style.labelSize*0.88}px Segoe UI, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
        ctx.strokeText(ct, lx, ly);
        ctx.fillStyle = '#333'; ctx.fillText(ct, lx, ly);
      }
    });

    // Refresh key point cards to reflect updated colors
    _renderKeyPointCards();
  }

  function exportCurve() {
    const canvas = document.getElementById('ph-tit-canvas');
    if (!canvas) { showAlert('No titration curve to export. Run a titration calculation first.', true); return; }
    const link = document.createElement('a');
    link.download = 'titration-curve.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function exportFull() {
    const canvas = document.getElementById('ph-tit-canvas');
    if (!canvas || !_tit) { showAlert('No titration curve to export.', true); return; }

    // Create an off-screen canvas with extra height for data + explanation
    const srcW  = canvas.width;
    const srcH  = canvas.height;
    const margin = 20;

    // Collect text content from the explanation div
    const kpEl   = document.getElementById('ph-tit-keypoints');
    const expEl  = document.querySelector('#ph-results .results-section-title');
    const expBox = document.querySelector('#ph-results div[style*="line-height:1.8"]');

    const kpText  = kpEl  ? kpEl.innerText.replace(/\n+/g,'\n').trim().split('\n') : [];
    const expText = expBox ? expBox.innerText.replace(/\n+/g,'\n').trim().split('\n') : [];

    const lineH = 18;
    const extraH = margin + (kpText.length + expText.length + 4) * lineH + margin * 2;

    const offCanvas = document.createElement('canvas');
    offCanvas.width  = srcW;
    offCanvas.height = srcH + extraH;
    const ctx = offCanvas.getContext('2d');

    // White background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);

    // Draw the chart
    ctx.drawImage(canvas, 0, 0);

    // Draw text below
    let ty = srcH + margin;
    ctx.fillStyle = '#1a2a4a';
    ctx.font = 'bold 13px Segoe UI, sans-serif';
    ctx.fillText('Key Values', margin, ty); ty += lineH * 1.2;

    ctx.font = '12px Segoe UI, sans-serif';
    ctx.fillStyle = '#333';
    for (const line of kpText) {
      if (line.trim()) { ctx.fillText(line.trim(), margin, ty); ty += lineH; }
    }

    ty += lineH * 0.5;
    ctx.fillStyle = '#1a2a4a';
    ctx.font = 'bold 13px Segoe UI, sans-serif';
    ctx.fillText('How to Read This Curve', margin, ty); ty += lineH * 1.2;

    ctx.font = '11px Segoe UI, sans-serif';
    ctx.fillStyle = '#333';
    const wrapWidth = srcW - margin * 2;
    for (const line of expText) {
      if (!line.trim()) { ty += lineH * 0.3; continue; }
      // Word-wrap
      const words = line.trim().split(' ');
      let cur = '';
      for (const w of words) {
        const test = cur ? cur + ' ' + w : w;
        if (ctx.measureText(test).width > wrapWidth && cur) {
          ctx.fillText(cur, margin, ty); ty += lineH; cur = w;
        } else cur = test;
      }
      if (cur) { ctx.fillText(cur, margin, ty); ty += lineH; }
    }

    const link = document.createElement('a');
    link.download = 'titration-full.png';
    link.href = offCanvas.toDataURL('image/png');
    link.click();
  }

  function clearAll() {
    document.getElementById('ph-results').innerHTML =
      `<div class="placeholder-msg">🧪 Fill in the fields and click <strong>Calculate</strong>.</div>`;
    buildInputs();
  }

  function updateTitStyle() {
    if (!_tit) return;
    const s = _tit.style;
    const g = id => document.getElementById(id);
    const v = id => { const el = g(id); return el ? el.value : null; };
    const c = id => { const el = g(id); return el ? el.checked : true; };

    s.titleText  = v('ph-tit-title') || '';
    s.titleSize  = parseInt(v('ph-tit-title-size')) || 14;
    s.titleColor = v('ph-tit-title-color') || '#1a2a4a';
    s.titleBold  = c('ph-tit-title-bold');
    s.titleAlign = v('ph-tit-title-align') || 'center';

    s.labelSize  = parseInt(v('ph-tit-lbl-size')) || 10;
    s.labelColor = v('ph-tit-lbl-color') || '#1a2a4a';
    s.labelBold  = c('ph-tit-lbl-bold');

    s.equivColor    = v('ph-tit-equiv-color') || '#f39c12';
    s.halfEquivColor= v('ph-tit-half-color')  || '#e94560';
    s.pkaColor      = v('ph-tit-pka-color')   || '#2ecc71';
    const bufHex    = v('ph-tit-buf-color')   || '#4caf50';
    // Convert hex to rgba with low opacity for buffer region fill
    const bR = parseInt(bufHex.slice(1,3),16), bG = parseInt(bufHex.slice(3,5),16), bB = parseInt(bufHex.slice(5,7),16);
    s.bufferColor   = `rgba(${bR},${bG},${bB},0.12)`;

    s.pointLineColor = v('ph-tit-pt-color') || '#4a90e2';
    s.pointLineWidth = parseInt(v('ph-tit-pt-width')) || 1;

    s.showInitialPH  = c('ph-show-init');
    s.showHalfEquivPH= c('ph-show-half');
    s.showEquivPH    = c('ph-show-equiv');
    s.showAfterEquiv = c('ph-show-after');
    s.showPKa        = c('ph-show-pka');

    redrawChart();
  }

  return { init, setMode, calculate, clearAll, exportCurve, exportFull, redrawChart,
           updateTitStyle, clearUserPoints, updateUserPoint, removeUserPoint, pickPointColor,
           toggleSnapToLine, addPointManual,
           smartDetect, smartUpdateFields, smartOverrideChanged, bufferModeSwitch };
})();

window.addEventListener('load', () => PhCalculator.init());
