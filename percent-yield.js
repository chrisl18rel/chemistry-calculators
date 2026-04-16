// percent-yield.js

const PercentYield = (() => {
  let mode = 'yield'; // 'yield' | 'actual' | 'theoretical'

  const EXAMPLES = {
    ex1: { mode:'yield',       actual:4.6,  theoretical:5.0,  pct:null },
    ex2: { mode:'actual',      actual:null, theoretical:12.0, pct:85   },
    ex3: { mode:'theoretical', actual:9.8,  theoretical:null, pct:72   },
  };

  function init() {
    fetch('percent-yield.html')
      .then(r => r.text())
      .then(html => {
        loadTemplate('percent-yield-container', html);
        setMode('yield');
      })
      .catch(() => {});
  }

  function setMode(m) {
    mode = m;
    ['yield','actual','theoretical'].forEach(k => {
      const btn = document.getElementById(`py-mode-${k}`);
      if (btn) btn.classList.toggle('active', k === m);
    });
    buildFields();
  }

  function buildFields() {
    const container = document.getElementById('py-fields');
    if (!container) return;

    const fields = {
      yield:       { show: ['actual','theoretical'],        solve: '% Yield' },
      actual:      { show: ['theoretical','pct'],           solve: 'Actual Yield' },
      theoretical: { show: ['actual','pct'],                solve: 'Theoretical Yield' },
    };

    const labels = {
      actual:      'Actual Yield',
      theoretical: 'Theoretical Yield',
      pct:         '% Yield',
    };
    const units = {
      actual:      'g',
      theoretical: 'g',
      pct:         '%',
    };
    const placeholders = {
      actual:      'e.g. 4.6',
      theoretical: 'e.g. 5.0',
      pct:         'e.g. 85',
    };

    const f = fields[mode];
    container.innerHTML = `<div class="group-title">KNOWN VALUES</div>`;
    f.show.forEach(key => {
      container.innerHTML += `
        <label>${labels[key]}</label>
        <div style="display:flex;gap:6px;align-items:center;">
          <input type="number" id="py-${key}" placeholder="${placeholders[key]}" min="0" step="0.001" style="flex:1;" />
          <span style="font-size:12px;color:var(--text-dim);min-width:16px;">${units[key]}</span>
        </div>`;
    });
    container.innerHTML += `
      <div class="display-divider"></div>
      <div class="mini-note">Solving for: <strong>${f.solve}</strong></div>`;
  }

  function calculate() {
    let actual      = parseFloat(document.getElementById('py-actual')?.value);
    let theoretical = parseFloat(document.getElementById('py-theoretical')?.value);
    let pct         = parseFloat(document.getElementById('py-pct')?.value);

    let result, solvedFor;

    if (mode === 'yield') {
      if (isNaN(actual) || isNaN(theoretical)) { showAlert('Enter actual and theoretical yield.', true); return; }
      if (theoretical <= 0) { showAlert('Theoretical yield must be > 0.', true); return; }
      pct = (actual / theoretical) * 100;
      result = pct; solvedFor = '% Yield';
    } else if (mode === 'actual') {
      if (isNaN(theoretical) || isNaN(pct)) { showAlert('Enter theoretical yield and % yield.', true); return; }
      if (pct < 0 || pct > 100) { showAlert('% yield must be between 0 and 100.', true); return; }
      actual = (pct / 100) * theoretical;
      result = actual; solvedFor = 'Actual Yield';
    } else {
      if (isNaN(actual) || isNaN(pct)) { showAlert('Enter actual yield and % yield.', true); return; }
      if (pct <= 0) { showAlert('% yield must be > 0.', true); return; }
      theoretical = (actual / pct) * 100;
      result = theoretical; solvedFor = 'Theoretical Yield';
    }

    renderResults(actual, theoretical, pct, solvedFor);
  }

  function renderResults(actual, theoretical, pct, solvedFor) {
    const resultsEl = document.getElementById('py-results');

    let yieldClass = 'green';
    let yieldLabel = 'Excellent';
    if (pct < 50)       { yieldClass = 'red';    yieldLabel = 'Low yield'; }
    else if (pct < 75)  { yieldClass = 'yellow'; yieldLabel = 'Moderate yield'; }
    else if (pct < 90)  { yieldClass = 'blue';   yieldLabel = 'Good yield'; }
    else                { yieldClass = 'green';  yieldLabel = 'Excellent yield'; }

    let html = `<h2>📈 Percent Yield Calculation</h2>`;

    html += `<div class="results-section-title">Formula</div>`;
    html += `<div class="step-card">
      <div class="step-title">% Yield = (Actual Yield / Theoretical Yield) × 100</div>
      <div class="step-eq">
        % Yield = (${actual.toFixed(4)} g / ${theoretical.toFixed(4)} g) × 100 = <strong>${pct.toFixed(2)}%</strong>
      </div>
    </div>`;

    html += `<div class="results-section-title">Summary</div>`;
    html += `<table class="result-table">
      <thead><tr><th>Quantity</th><th>Value</th><th>Unit</th><th>Status</th></tr></thead>
      <tbody>
        <tr>
          <td>Theoretical Yield</td>
          <td class="num">${theoretical.toFixed(4)}</td><td>g</td>
          <td>${solvedFor === 'Theoretical Yield' ? '<span class="result-badge blue">Solved</span>' : '<span class="result-badge green">Given</span>'}</td>
        </tr>
        <tr>
          <td>Actual Yield</td>
          <td class="num">${actual.toFixed(4)}</td><td>g</td>
          <td>${solvedFor === 'Actual Yield' ? '<span class="result-badge blue">Solved</span>' : '<span class="result-badge green">Given</span>'}</td>
        </tr>
        <tr>
          <td>Mass Lost / Unreacted</td>
          <td class="num">${(theoretical - actual).toFixed(4)}</td><td>g</td>
          <td></td>
        </tr>
      </tbody>
    </table>`;

    html += `<div class="answer-box">
      <span class="answer-label">% Yield</span>
      <span class="answer-value">${pct.toFixed(2)}</span>
      <span class="answer-unit">%</span>
      <span class="result-badge ${yieldClass}" style="margin-left:8px;">${yieldLabel}</span>
    </div>`;

    // Visual bar
    const barPct = Math.min(pct, 100);
    html += `<div style="margin-top:14px;">
      <div style="font-size:11px;color:#555;margin-bottom:4px;">Yield Efficiency</div>
      <div style="height:16px;background:#e0e8f5;border-radius:8px;overflow:hidden;">
        <div style="width:${barPct.toFixed(1)}%;height:100%;background:${pct >= 90 ? '#4caf50' : pct >= 75 ? '#4a90e2' : pct >= 50 ? '#ffc107' : '#ef5350'};border-radius:8px;transition:width 0.3s;"></div>
      </div>
      <div style="font-size:10px;color:#888;margin-top:3px;display:flex;justify-content:space-between;">
        <span>0%</span><span>50%</span><span>100%</span>
      </div>
    </div>`;

    resultsEl.innerHTML = html;
  }

  function clear() {
    ['py-actual','py-theoretical','py-pct'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('py-results').innerHTML =
      '<div class="placeholder-msg">📈 Select what to solve for, enter two known values, and click <strong>Calculate</strong>.</div>';
  }

  function loadExample(key) {
    const ex = EXAMPLES[key];
    if (!ex) return;
    setMode(ex.mode);
    // Small delay to let buildFields run
    setTimeout(() => {
      if (ex.actual      !== null) { const el = document.getElementById('py-actual');       if (el) el.value = ex.actual; }
      if (ex.theoretical !== null) { const el = document.getElementById('py-theoretical');  if (el) el.value = ex.theoretical; }
      if (ex.pct         !== null) { const el = document.getElementById('py-pct');          if (el) el.value = ex.pct; }
      calculate();
    }, 50);
  }

  return { init, calculate, clear, setMode, loadExample };
})();

window.addEventListener('load', () => PercentYield.init());
