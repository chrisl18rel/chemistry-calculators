// redox-balancer.js

const RedoxBalancer = (() => {
  let medium = 'acidic';

  // Ion display: strips trailing charge notation for formula parsing but preserves it for display
  const EXAMPLES = {
    fe_mn_acid:  { oxL:'Fe2+', oxR:'Fe3+',    redL:'MnO4-',   redR:'Mn2+',  medium:'acidic' },
    cr_acid:     { oxL:'Cr3+', oxR:'Cr2O72-', redL:'Cr2O72-', redR:'Cr3+',  medium:'acidic' },
    fe_mn_basic: { oxL:'Fe2+', oxR:'Fe3+',    redL:'MnO4-',   redR:'MnO2',  medium:'basic'  },
    sn_bi:       { oxL:'Sn2+', oxR:'Sn4+',    redL:'Bi3+',    redR:'Bi',    medium:'acidic' },
    io3_i:       { oxL:'I-',   oxR:'IO3-',    redL:'IO3-',    redR:'I-',    medium:'acidic' },
  };

  function init() {
    fetch('redox-balancer.html')
      .then(r => r.text())
      .then(html => {
        loadTemplate('redox-balancer-container', html);
        setMedium('acidic');
      })
      .catch(() => {});
  }

  function setMedium(m) {
    medium = m;
    const aBtn = document.getElementById('rx-acid-btn');
    const bBtn = document.getElementById('rx-base-btn');
    if (aBtn) aBtn.classList.toggle('active', m === 'acidic');
    if (bBtn) bBtn.classList.toggle('active', m === 'basic');
  }

  // Parse an ion formula like "MnO4-", "Fe2+", "Cr2O72-", "Fe3+" into
  // { formula: "MnO4", charge: -1 }
  function parseIon(str) {
    str = str.trim();
    if (!str) return { formula: '', charge: 0 };

    // Detect trailing charge: e.g. 2+, 3-, +, -, 2-, 4-
    const chargeMatch = str.match(/^(.*?)(\d*[+\-])$/);
    let formula = str;
    let charge = 0;

    if (chargeMatch) {
      formula = chargeMatch[1];
      const chargeStr = chargeMatch[2];
      const sign = chargeStr.endsWith('+') ? 1 : -1;
      const mag = parseInt(chargeStr.slice(0, -1)) || 1;
      charge = sign * mag;
    }

    return { formula, charge };
  }

  // Display an ion nicely
  function ionDisplay(formula, charge) {
    let s = formulaToHTML(formula);
    if (charge === 0) return s;
    const abs = Math.abs(charge);
    const sign = charge > 0 ? '+' : '−';
    const chargeStr = abs === 1 ? sign : abs + sign;
    return s + '<sup>' + chargeStr + '</sup>';
  }

  // Count oxygen atoms in a formula string
  function oxygenCount(formula) {
    if (!formula) return 0;
    try { return parseFormula(formula)['O'] || 0; } catch(e) { return 0; }
  }

  // Count hydrogen atoms in a formula string
  function hydrogenCount(formula) {
    if (!formula) return 0;
    try { return parseFormula(formula)['H'] || 0; } catch(e) { return 0; }
  }

  // Core half-reaction balancer
  // Balances a single half-reaction given:
  //   leftFormula, leftCharge, rightFormula, rightCharge
  //   medium: 'acidic' or 'basic'
  // Returns detailed steps object
  function balanceHalfReaction(leftFormula, leftCharge, rightFormula, rightCharge, med) {
    const steps = [];
    const leftDisplay  = ionDisplay(leftFormula, leftCharge);
    const rightDisplay = ionDisplay(rightFormula, rightCharge);

    steps.push({
      title: 'Step 1: Write the unbalanced half-reaction',
      eq: `${leftDisplay} → ${rightDisplay}`
    });

    // Step 2: Balance all atoms except O and H
    // For now, we do simple atom balancing by finding element counts
    let leftAtoms = {}, rightAtoms = {};
    try { leftAtoms  = leftFormula  ? parseFormula(leftFormula)  : {}; } catch(e) { leftAtoms = {}; }
    try { rightAtoms = rightFormula ? parseFormula(rightFormula) : {}; } catch(e) { rightAtoms = {}; }

    // Find coefficients for left and right that balance non-O, non-H atoms
    // This is a simplified approach for single-element redox (one species each side)
    // Determine ratio by matching main element (non H, non O)
    const leftMain  = Object.entries(leftAtoms).filter(([el]) => el !== 'H' && el !== 'O');
    const rightMain = Object.entries(rightAtoms).filter(([el]) => el !== 'H' && el !== 'O');

    let lCoeff = 1, rCoeff = 1;
    if (leftMain.length > 0 && rightMain.length > 0) {
      const el = leftMain[0][0];
      const lCnt = leftMain[0][1];
      const rCnt = rightAtoms[el] || 1;
      const g = gcd(lCnt, rCnt);
      lCoeff = rCnt / g;
      rCoeff = lCnt / g;
    }

    // Scale atom counts
    const scaledLeftAtoms  = {};
    const scaledRightAtoms = {};
    for (const [el, cnt] of Object.entries(leftAtoms))  scaledLeftAtoms[el]  = cnt * lCoeff;
    for (const [el, cnt] of Object.entries(rightAtoms)) scaledRightAtoms[el] = cnt * rCoeff;
    const scaledLeftCharge  = leftCharge  * lCoeff;
    const scaledRightCharge = rightCharge * rCoeff;

    const lStr = (lCoeff > 1 ? lCoeff : '') + leftDisplay;
    const rStr = (rCoeff > 1 ? rCoeff : '') + rightDisplay;

    if (lCoeff !== 1 || rCoeff !== 1) {
      steps.push({
        title: 'Step 2: Balance atoms other than O and H',
        eq: `${lStr} → ${rStr}`
      });
    } else {
      steps.push({
        title: 'Step 2: Balance atoms other than O and H',
        eq: `Atoms already balanced — ${lStr} → ${rStr}`
      });
    }

    // Step 3: Balance O by adding H2O
    const leftO  = scaledLeftAtoms['O']  || 0;
    const rightO = scaledRightAtoms['O'] || 0;
    const oDiff  = leftO - rightO; // positive → add H2O to right; negative → add to left

    let h2oLeft = 0, h2oRight = 0;
    if (oDiff > 0)       h2oRight = oDiff;
    else if (oDiff < 0)  h2oLeft  = -oDiff;

    // Build equation with H2O
    const step3L = lStr + (h2oLeft  ? ` + ${h2oLeft > 1 ? h2oLeft : ''}H<sub>2</sub>O` : '');
    const step3R = rStr + (h2oRight ? ` + ${h2oRight > 1 ? h2oRight : ''}H<sub>2</sub>O` : '');

    steps.push({
      title: 'Step 3: Balance O atoms by adding H₂O',
      eq: h2oLeft === 0 && h2oRight === 0
        ? 'No oxygen present — skip this step'
        : `${step3L} → ${step3R}`
    });

    // Total H on each side after adding H2O
    const h2oLeftH  = h2oLeft  * 2;
    const h2oRightH = h2oRight * 2;
    const leftH  = (scaledLeftAtoms['H']  || 0) + h2oLeftH;
    const rightH = (scaledRightAtoms['H'] || 0) + h2oRightH;
    const hDiff  = rightH - leftH; // how many H+ need to be added to left side

    // Step 4: Balance H by adding H+
    let hLeft = 0, hRight = 0;
    if (hDiff > 0)       hLeft  = hDiff;
    else if (hDiff < 0)  hRight = -hDiff;

    const step4L = (hLeft  ? `${hLeft > 1 ? hLeft : ''}H<sup>+</sup> + ` : '') + step3L;
    const step4R = step3R + (hRight ? ` + ${hRight > 1 ? hRight : ''}H<sup>+</sup>` : '');

    steps.push({
      title: 'Step 4: Balance H atoms by adding H⁺',
      eq: hLeft === 0 && hRight === 0
        ? 'No hydrogen imbalance — skip this step'
        : `${step4L} → ${step4R}`
    });

    // Step 5: Balance charge by adding electrons
    // Charge on left: scaledLeftCharge + hLeft*(+1) + (charges from H2O = 0)
    // Charge on right: scaledRightCharge + hRight*(+1) + (charges from H2O = 0)
    const totalLeftCharge  = scaledLeftCharge  + hLeft;
    const totalRightCharge = scaledRightCharge + hRight;
    const eDiff = totalLeftCharge - totalRightCharge;
    // If eDiff > 0, electrons go to left (reduction); if < 0, electrons go to right (oxidation)

    let eLeft = 0, eRight = 0;
    if (eDiff > 0)       eLeft  = eDiff;
    else if (eDiff < 0)  eRight = -eDiff;

    const eStr = (n) => n === 1 ? 'e<sup>−</sup>' : `${n}e<sup>−</sup>`;
    const step5L = (eLeft  ? `${eStr(eLeft)} + ` : '') + step4L;
    const step5R = step4R + (eRight ? ` + ${eStr(eRight)}` : '');

    const finalLeftCharge  = totalLeftCharge  - eLeft;
    const finalRightCharge = totalRightCharge + eRight;

    steps.push({
      title: 'Step 5: Balance charge by adding electrons',
      eq: `${step5L} → ${step5R}`,
      note: `Left charge: ${finalLeftCharge >= 0 ? '+' : ''}${finalLeftCharge} | Right charge: ${finalRightCharge >= 0 ? '+' : ''}${finalRightCharge}`
    });

    // For basic medium: convert H+ to OH-
    // Add same # of OH- to both sides as there are H+, H+ + OH- → H2O
    let finalEq = `${step5L} → ${step5R}`;
    if (med === 'basic') {
      const totalH = hLeft + hRight;
      if (totalH > 0) {
        const addOH = totalH;
        // Replace H+ on left side with H2O (if hLeft > 0)
        // Replace H+ on right side with H2O (if hRight > 0)
        let basicL = step5L;
        let basicR = step5R;
        if (hLeft > 0) {
          // Replace hLeft H+ with: add hLeft OH- to right, left H+ become hLeft H2O
          basicL = basicL.replace(
            new RegExp(`${hLeft > 1 ? hLeft : ''}H<sup>\\+<\\/sup> \\+ `),
            `${hLeft > 1 ? hLeft : ''}H<sub>2</sub>O + `
          );
          const ohStr = (hLeft > 1 ? hLeft : '') + 'OH<sup>−</sup>';
          basicR += ` + ${ohStr}`;
        }
        if (hRight > 0) {
          basicR = basicR.replace(
            new RegExp(` \\+ ${hRight > 1 ? hRight : ''}H<sup>\\+<\\/sup>`),
            ` + ${hRight > 1 ? hRight : ''}H<sub>2</sub>O`
          );
          const ohStr = (hRight > 1 ? hRight : '') + 'OH<sup>−</sup>';
          basicL = `${ohStr} + ` + basicL;
        }
        finalEq = `${basicL} → ${basicR}`;
        steps.push({
          title: 'Step 6 (Basic only): Replace H⁺ with OH⁻',
          eq: finalEq,
          note: `Added OH⁻ to both sides. H⁺ + OH⁻ → H₂O. Simplify any H₂O that appears on both sides.`
        });
      }
    }

    return {
      steps,
      electrons: Math.max(eLeft, eRight),
      isOxidation: eRight > 0, // electrons on product side = oxidation
      lCoeff, rCoeff,
      h2oLeft, h2oRight, hLeft, hRight, eLeft, eRight,
      finalEq
    };
  }

  function balance() {
    const oxLVal  = document.getElementById('rx-ox-left')?.value.trim()  || '';
    const oxRVal  = document.getElementById('rx-ox-right')?.value.trim() || '';
    const redLVal = document.getElementById('rx-red-left')?.value.trim() || '';
    const redRVal = document.getElementById('rx-red-right')?.value.trim()|| '';

    if (!oxLVal || !oxRVal || !redLVal || !redRVal) {
      showAlert('Please fill in all four half-reaction fields.', true);
      return;
    }

    const oxL  = parseIon(oxLVal);
    const oxR  = parseIon(oxRVal);
    const redL = parseIon(redLVal);
    const redR = parseIon(redRVal);

    const resultsEl = document.getElementById('rx-results');
    let oxResult, redResult;

    try {
      oxResult  = balanceHalfReaction(oxL.formula,  oxL.charge,  oxR.formula,  oxR.charge,  medium);
      redResult = balanceHalfReaction(redL.formula, redL.charge, redR.formula, redR.charge, medium);
    } catch(e) {
      resultsEl.innerHTML = `<div class="placeholder-msg" style="color:#e74c3c;">⚠ ${e.message}</div>`;
      showAlert('Error: ' + e.message, true);
      return;
    }

    const medLabel = medium === 'acidic' ? 'Acidic Solution' : 'Basic Solution';
    let html = `<h2>🔋 Redox Balancing — ${medLabel}</h2>`;

    // Oxidation half-reaction steps
    html += `<div class="results-section-title" style="color:#e94560;">Oxidation Half-Reaction</div>`;
    html += renderSteps(oxResult.steps);

    // Reduction half-reaction steps
    html += `<div class="results-section-title" style="color:#4a90e2;margin-top:18px;">Reduction Half-Reaction</div>`;
    html += renderSteps(redResult.steps);

    // Combine
    html += `<div class="results-section-title" style="margin-top:18px;">Combining the Half-Reactions</div>`;
    const oxE  = oxResult.electrons;
    const redE = redResult.electrons;
    const lcmE = lcm(oxE || 1, redE || 1);
    const oxMul  = oxE  ? lcmE / oxE  : 1;
    const redMul = redE ? lcmE / redE : 1;

    html += `<div class="step-card">
      <div class="step-title">Multiply to equalize electrons transferred</div>
      <div class="step-eq">
        Oxidation half-reaction × ${oxMul}<br>
        Reduction half-reaction × ${redMul}<br>
        Electrons transferred: ${lcmE}e⁻
      </div>
    </div>`;

    html += `<div class="step-card">
      <div class="step-title">Cancel electrons and combine</div>
      <div class="step-eq">
        Add the two half-reactions, canceling the ${lcmE}e⁻ and any H₂O / H⁺ / OH⁻ that appear on both sides.
      </div>
    </div>`;

    html += `<div class="answer-box" style="flex-direction:column;gap:6px;">
      <span class="answer-label" style="font-size:13px;">Balanced Net Ionic Equation (overall)</span>
      <div style="font-size:12px;color:#555;">
        Multiply each half-reaction by the factors above, then add and simplify.<br>
        Verify atom counts and charge balance on both sides.
      </div>
    </div>`;

    resultsEl.innerHTML = html;
  }

  function renderSteps(steps) {
    return steps.map(s => `
      <div class="step-card">
        <div class="step-title">${s.title}</div>
        <div class="step-eq">${s.eq}</div>
        ${s.note ? `<div style="font-size:11px;color:#555;margin-top:4px;">${s.note}</div>` : ''}
      </div>`).join('');
  }

  function clear() {
    ['rx-ox-left','rx-ox-right','rx-red-left','rx-red-right'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('rx-results').innerHTML =
      '<div class="placeholder-msg">🔋 Enter oxidation and reduction half-reactions, then click <strong>Balance Redox Equation</strong>.</div>';
  }

  function loadExample(key) {
    const ex = EXAMPLES[key];
    if (!ex) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    set('rx-ox-left',  ex.oxL);
    set('rx-ox-right', ex.oxR);
    set('rx-red-left', ex.redL);
    set('rx-red-right',ex.redR);
    setMedium(ex.medium);
    balance();
  }

  return { init, balance, clear, setMedium, loadExample };
})();

window.addEventListener('load', () => RedoxBalancer.init());
