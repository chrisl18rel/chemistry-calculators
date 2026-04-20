// redox-balancer.js

const RedoxBalancer = (() => {
  let medium = 'acidic';

  const EXAMPLES = {
    zncu:    'Zn(s) + CuSO4(aq) → ZnSO4(aq) + Cu(s)',
    feag:    'Cu(s) + AgNO3(aq) → Cu(NO3)2(aq) + Ag(s)',
    ironrust:'Fe(s) + HCl(aq) → FeCl2(aq) + H2(g)',
    i3s2o3: 'I3- + S2O32- → I-1 + S4O62-',
  };

  function init() {
    setMedium('acidic');
    const ta = document.getElementById('rx-equation');
    if (ta) {
      ta.addEventListener('keydown', e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.shiftKey)) {
          e.preventDefault(); balance();
        }
      });
    }
  }

  function setMedium(m) {
    medium = m;
    const aBtn = document.getElementById('rx-acid-btn');
    const bBtn = document.getElementById('rx-base-btn');
    if (aBtn) aBtn.classList.toggle('active', m === 'acidic');
    if (bBtn) bBtn.classList.toggle('active', m === 'basic');
  }

  function balance() {
    const ta = document.getElementById('rx-equation');
    if (!ta) return;
    const raw = ta.value.trim();
    if (!raw) { showAlert('Please enter a molecular equation.', true); return; }

    const resultsEl = document.getElementById('rx-results');
    let solution;
    try {
      solution = solveRedox(raw, medium);
    } catch(e) {
      resultsEl.innerHTML = `<div class="placeholder-msg" style="color:#e74c3c;">⚠ ${e.message}</div>`;
      showAlert(e.message, true);
      return;
    }

    resultsEl.innerHTML = renderSolution(solution);
  }

  function renderSolution(sol) {
    let html = `<h2>🔋 Redox Reaction — ${sol.medium === 'acidic' ? 'Acidic' : 'Basic'} Solution</h2>`;
    html += stepCard('Step 1', 'Write the Molecular Equation',      renderMolecularEq(sol));
    html += stepCard('Step 2', 'Write the Net Ionic Equation',      renderNetIonic(sol));
    html += stepCard('Step 3', 'Assign Oxidation Numbers',          renderOxNumbers(sol));
    html += stepCard('Step 4', 'Identify Oxidized and Reduced Species', renderRedoxID(sol));
    html += stepCard('Step 5', 'Separate into Half-Reactions',      renderSplit(sol));
    html += stepCard('Step 6', 'Balance the Oxidation Half-Reaction',   renderHRSteps(sol.oxHR, 'ox'));
    html += stepCard('Step 7', 'Balance the Reduction Half-Reaction',   renderHRSteps(sol.redHR, 'red'));
    html += stepCard('Step 8', 'Equalize the Number of Electrons',       renderEqualize(sol));
    html += stepCard('Step 9', 'Combine Half-Reactions and Cancel',      renderCombine(sol));
    if (sol.medium === 'basic') {
      html += stepCard('Step 10', 'Convert to Basic Solution (Add OH⁻)', renderBasic());
    }
    return html;
  }

  function stepCard(num, title, body) {
    return `<div class="rx-step-card">
      <div class="rx-step-header"><span class="rx-step-num">${num}</span><span class="rx-step-title">${title}</span></div>
      <div class="rx-step-body">${body}</div>
    </div>`;
  }

  function renderMolecularEq(sol) {
    const side = (arr) => arr.map(c =>
      `${formulaToHTML(c.formula)}<span style="font-size:10px;color:#888;">(${c.state||''})</span>`
    ).join(' + ');
    return `<div class="rx-eq">${side(sol.molecular.reactants)} → ${side(sol.molecular.products)}</div>`;
  }

  function renderNetIonic(sol) {
    let html = '';
    if (sol.spectatorList.length) {
      const specs = sol.spectatorList.map(s => ionDisp(s.formula, s.charge)).join(', ');
      html += `<div class="rx-note">Spectator ions cancelled: <strong>${specs}</strong></div>`;
    }
    const rStr = sol.netR.map(s => ionDisp(s.formula, s.charge||0)).join(' + ');
    const pStr = sol.netP.map(s => ionDisp(s.formula, s.charge||0)).join(' + ');
    html += `<div class="rx-eq">${rStr} → ${pStr}</div>`;
    return html;
  }

  function renderOxNumbers(sol) {
    // Annotate net ionic equation with oxidation numbers ABOVE changing atoms
    const changedEls = new Set(sol.changes.map(c => c.element));

    const annotateSpecies = (sp) => {
      const ons = assignOxidationNumbers(sp.formula, sp.charge||0);
      const changing = ons.filter(o => changedEls.has(o.element));
      if (!changing.length) return ionDisp(sp.formula, sp.charge||0);
      const onStr = formatON(changing[0].oxidationNumber, changing[0].isFractional);
      return `<span class="rx-on-wrap">
        <span class="rx-on-num">${onStr}</span>
        <span>${ionDisp(sp.formula, sp.charge||0)}</span>
      </span>`;
    };

    const rStr = sol.netR.map(annotateSpecies).join(' + ');
    const pStr = sol.netP.map(annotateSpecies).join(' + ');
    let html = `<div class="rx-eq rx-annotated">${rStr} → ${pStr}</div>`;

    html += `<table class="result-table" style="margin-top:12px;">
      <thead><tr><th>Element</th><th>In Species</th><th>Oxidation # Before</th><th>Oxidation # After</th><th>Change</th></tr></thead><tbody>`;
    for (const c of sol.changes) {
      const rON = formatON(c.reactantON, !Number.isInteger(c.reactantON));
      const pON = formatON(c.productON,  !Number.isInteger(c.productON));
      const delta = c.productON - c.reactantON;
      html += `<tr>
        <td><strong>${c.element}</strong></td>
        <td class="mono">${ionDisp(c.reactantFormula,0)}</td>
        <td class="num">${rON}</td>
        <td class="num">${pON}</td>
        <td>${delta > 0 ? '↑ Increased' : '↓ Decreased'} (${delta > 0 ? '+' : ''}${formatON(delta, !Number.isInteger(delta))})</td>
      </tr>`;
    }
    html += '</tbody></table>';
    return html;
  }

  function renderRedoxID(sol) {
    const ox = sol.oxidationChange, red = sol.reductionChange;

    let html = `<div class="rx-diagram">
      <div class="rx-arrow-row">
        <div class="rx-arrow-label ox-color">▼ Oxidized (lost e⁻)</div>
        <div class="rx-diagram-eq">
          <span class="rx-hl ox-hl">${ionDisp(ox.reactantFormula,0)}</span>
          <span class="rx-dim"> + </span>
          <span class="rx-hl red-hl">${ionDisp(red.reactantFormula,0)}</span>
          <span style="margin:0 10px;font-size:16px;font-weight:700;">→</span>
          <span class="rx-hl ox-hl">${ionDisp(ox.productFormula,0)}</span>
          <span class="rx-dim"> + </span>
          <span class="rx-hl red-hl">${ionDisp(red.productFormula,0)}</span>
        </div>
        <div class="rx-arrow-label red-color">▲ Reduced (gained e⁻)</div>
      </div>
    </div>`;

    html += `<table class="result-table" style="margin-top:14px;">
      <thead><tr><th>Process</th><th>Element</th><th>Species Involved</th><th>ON Change</th><th>Role</th></tr></thead><tbody>
      <tr>
        <td><span class="result-badge red">Oxidation</span></td>
        <td><strong>${ox.element}</strong></td>
        <td class="mono">${ionDisp(ox.reactantFormula,0)} → ${ionDisp(ox.productFormula,0)}</td>
        <td>${formatON(ox.reactantON,!Number.isInteger(ox.reactantON))} → ${formatON(ox.productON,!Number.isInteger(ox.productON))}</td>
        <td>
          <span class="result-badge yellow">Reducing Agent</span><br>
          <span style="font-size:11px;color:#555;">${ionDisp(ox.reactantFormula,0)} is oxidized; it reduces ${ionDisp(red.reactantFormula,0)}</span>
        </td>
      </tr>
      <tr>
        <td><span class="result-badge blue">Reduction</span></td>
        <td><strong>${red.element}</strong></td>
        <td class="mono">${ionDisp(red.reactantFormula,0)} → ${ionDisp(red.productFormula,0)}</td>
        <td>${formatON(red.reactantON,!Number.isInteger(red.reactantON))} → ${formatON(red.productON,!Number.isInteger(red.productON))}</td>
        <td>
          <span class="result-badge blue">Oxidizing Agent</span><br>
          <span style="font-size:11px;color:#555;">${ionDisp(red.reactantFormula,0)} is reduced; it oxidizes ${ionDisp(ox.reactantFormula,0)}</span>
        </td>
      </tr>
      </tbody></table>`;
    return html;
  }

  function renderSplit(sol) {
    const ox = sol.oxidationChange, red = sol.reductionChange;
    return `<div class="rx-half-split">
      <div class="rx-half-block">
        <div class="rx-half-label ox-color"><strong>Oxidation Half-Reaction</strong></div>
        <div class="rx-eq">${ionDisp(ox.reactantFormula,0)} → ${ionDisp(ox.productFormula,0)}</div>
        <div class="rx-note">${ox.element}: ${formatON(ox.reactantON,!Number.isInteger(ox.reactantON))} → ${formatON(ox.productON,!Number.isInteger(ox.productON))} (lost electrons)</div>
      </div>
      <div class="rx-half-block">
        <div class="rx-half-label red-color"><strong>Reduction Half-Reaction</strong></div>
        <div class="rx-eq">${ionDisp(red.reactantFormula,0)} → ${ionDisp(red.productFormula,0)}</div>
        <div class="rx-note">${red.element}: ${formatON(red.reactantON,!Number.isInteger(red.reactantON))} → ${formatON(red.productON,!Number.isInteger(red.productON))} (gained electrons)</div>
      </div>
    </div>`;
  }

  function renderHRSteps(hr, colorClass) {
    let html = '';
    hr.steps.forEach((step, i) => {
      const letter = String.fromCharCode(97 + i);
      html += `<div class="rx-substep">
        <div class="rx-substep-label ${colorClass}-color">${letter}. ${step.label}</div>
        <div class="rx-eq">${step.left} → ${step.right}</div>
        ${step.note ? `<div class="rx-note">${step.note}</div>` : ''}
      </div>`;
    });
    html += `<div class="rx-final-hr ${colorClass}-border">
      <strong>Balanced half-reaction (${hr.electrons} e⁻ transferred):</strong>
      <div class="rx-eq" style="margin-top:6px;">${hr.finalLeft} → ${hr.finalRight}</div>
    </div>`;
    return html;
  }

  function renderEqualize(sol) {
    const { oxHR, redHR, lcmE, oxMul, redMul } = sol;
    let html = `<div class="rx-note">Multiply each half-reaction so that the electrons transferred are equal (LCM = ${lcmE}):</div>`;
    html += `<table class="result-table"><thead><tr><th>Half-Reaction</th><th>e⁻</th><th>Factor</th><th>Scaled Half-Reaction</th></tr></thead><tbody>
      <tr>
        <td><span class="result-badge red">Oxidation</span></td>
        <td class="num">${oxHR.electrons}</td>
        <td class="num">× ${oxMul}</td>
        <td class="mono">${oxMul > 1 ? oxMul+'(' : ''}${oxHR.finalLeft} → ${oxHR.finalRight}${oxMul > 1 ? ')' : ''}</td>
      </tr>
      <tr>
        <td><span class="result-badge blue">Reduction</span></td>
        <td class="num">${redHR.electrons}</td>
        <td class="num">× ${redMul}</td>
        <td class="mono">${redMul > 1 ? redMul+'(' : ''}${redHR.finalLeft} → ${redHR.finalRight}${redMul > 1 ? ')' : ''}</td>
      </tr>
    </tbody></table>`;
    if (oxMul === 1 && redMul === 1) {
      html += `<div class="rx-note" style="margin-top:8px;">✓ Electrons already equal — no multiplication needed.</div>`;
    }
    return html;
  }

  function renderCombine(sol) {
    const { oxHR, redHR, oxMul, redMul, lcmE } = sol;
    const oxL = oxMul > 1 ? `${oxMul}(${oxHR.finalLeft})`  : oxHR.finalLeft;
    const oxR = oxMul > 1 ? `${oxMul}(${oxHR.finalRight})` : oxHR.finalRight;
    const reL = redMul > 1 ? `${redMul}(${redHR.finalLeft})`  : redHR.finalLeft;
    const reR = redMul > 1 ? `${redMul}(${redHR.finalRight})` : redHR.finalRight;
    return `
      <div class="rx-substep">
        <div class="rx-substep-label ox-color">Oxidation (×${oxMul})</div>
        <div class="rx-eq">${oxL} → ${oxR}</div>
      </div>
      <div class="rx-substep">
        <div class="rx-substep-label red-color">Reduction (×${redMul})</div>
        <div class="rx-eq">${reL} → ${reR}</div>
      </div>
      <div class="rx-note" style="margin:10px 0 6px;">Add the two equations. The <strong>${lcmE}e⁻</strong> cancel:</div>
      <div class="answer-box" style="flex-direction:column;gap:6px;">
        <span class="answer-label">✓ Balanced Net Ionic Equation</span>
        <div style="font-size:12px;color:#555;margin-top:2px;">
          Combine, cancel the ${lcmE}e⁻, then simplify any H₂O, H⁺, or OH⁻ on both sides.
        </div>
      </div>`;
  }

  function renderBasic() {
    return `<div class="rx-substep">
      <div class="rx-substep-label" style="color:#6d4c41;font-weight:700;">Basic Solution Conversion</div>
      <div class="rx-note">
        After combining the half-reactions in Step 9:<br><br>
        1. Count the H⁺ ions in the net ionic equation<br>
        2. Add that many OH⁻ to <em>both</em> sides<br>
        3. On the side with H⁺: combine H⁺ + OH⁻ → H₂O<br>
        4. Cancel any H₂O that appears on both sides<br>
        5. Result is the balanced equation in basic solution
      </div>
    </div>`;
  }

  // ── Display helpers ──
  function ionDisp(formula, charge) {
    let s = formulaToHTML(formula);
    if (!charge) return s;
    const abs = Math.abs(charge);
    const sign = charge > 0 ? '+' : '−';
    return `${s}<sup>${abs === 1 ? sign : abs + sign}</sup>`;
  }

  function formatON(n, isFrac) {
    if (isFrac) {
      const f = toFrac(n);
      return n >= 0 ? `+${f}` : f;
    }
    const r = Math.round(n * 100) / 100;
    return r >= 0 ? `+${r}` : `${r}`;
  }

  function toFrac(n) {
    for (let d = 2; d <= 12; d++) {
      const num = Math.round(n * d);
      if (Math.abs(num / d - n) < 0.001) {
        if (num % d === 0) return String(num / d);
        return `${num}/${d}`;
      }
    }
    return n.toFixed(2);
  }

  function clear() {
    const ta = document.getElementById('rx-equation');
    if (ta) { ta.value = ''; ta.focus(); }
    const r = document.getElementById('rx-results');
    if (r) r.innerHTML = '<div class="placeholder-msg">🔋 Enter a molecular equation and click <strong>Balance Redox Equation</strong>.</div>';
  }

  function loadExample(key) {
    const ex = EXAMPLES[key];
    if (!ex) return;
    const ta = document.getElementById('rx-equation');
    if (ta) { ta.value = ex; balance(); }
  }

  return { init, balance, clear, setMedium, loadExample };
})();

window.addEventListener('load', () => RedoxBalancer.init());
