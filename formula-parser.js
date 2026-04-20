// formula-parser.js

// ── ATOMIC MASSES ──
const ATOMIC_MASSES = {
  H:1.00794, He:4.0026, Li:6.941, Be:9.01218, B:10.81, C:12.011, N:14.0067,
  O:15.9994, F:18.298403, Ne:20.179, Na:22.98977, Mg:24.305, Al:26.98154, Si:28.0855,
  P:30.97376, S:32.06, Cl:35.453, Ar:39.948, K:39.0983, Ca:40.08, Sc:44.9559,
  Ti:47.88, V:50.9415, Cr:51.996, Mn:54.938, Fe:55.847, Co:58.9332, Ni:58.68,
  Cu:63.546, Zn:65.38, Ga:69.72, Ge:72.59, As:74.9216, Se:78.96, Br:79.904,
  Kr:83.8, Rb:85.4678, Sr:87.62, Y:88.9059, Zr:91.22, Nb:92.9064, Mo:95.94,
  Tc:98, Ru:101.07, Rh:102.9055, Pd:106.42, Ag:107.8682, Cd:112.41, In:114.82,
  Sn:118.69, Sb:121.75, Te:127.6, I:126.9045, Xe:131.29, Cs:132.9054, Ba:137.33,
  La:138.9055, Ce:140.12, Pr:140.9077, Nd:144.24, Pm:145, Sm:150.36, Eu:151.96,
  Gd:157.25, Tb:158.9254, Dy:162.5, Ho:164.9304, Er:167.26, Tm:168.9342, Yb:173.04,
  Lu:174.967, Hf:178.49, Ta:180.9479, W:183.85, Re:186.207, Os:190.2, Ir:192.22,
  Pt:195.08, Au:196.9665, Hg:200.59, Tl:204.383, Pb:207.2, Bi:208.9804, Po:209,
  At:210, Rn:222, Fr:223, Ra:226.0254, Ac:227.0278, Th:232.0381, Pa:231.0359, U:238.0289,
  Np:237.0482, Pu:244, Am:243, Cm:247, Bk:247, Cf:251, Es:252, Fm:257, Md:258,
  No:259, Lr:260
};

// ── PARSE FORMULA ──
// Returns an object { element: count } or throws on invalid formula
// Supports:
//   - Parenthetical groups: Ca(OH)2, Fe2(SO4)3, Al2(SO4)3
//   - Hydrates: CuSO4*5H2O  (* asterisk recommended, · and • also work)
//   - Unicode subscripts: H₂O
//   - Nested parentheses: Ca(H2(PO4))2 (limited depth)
//   - Charges in brackets: [Fe(CN)6]4- (bracket treated like paren)

function parseFormula(formula) {
  if (!formula || !formula.trim()) throw new Error('Empty formula');

  // Normalize unicode subscripts to plain digits
  const subMap = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
  let f = formula.trim().replace(/[₀₁₂₃₄₅₆₇₈₉]/g, c => subMap[c] || c);

  // Handle hydrate separator: * (asterisk), · (middle dot), or • (bullet)
  // e.g. CuSO4*5H2O, CuSO4·5H2O, CuSO4•5H2O
  const hydrateParts = f.split(/[·•*]/);
  const combined = {};
  for (const part of hydrateParts) {
    const partResult = _parseSegment(part.trim());
    for (const [el, cnt] of Object.entries(partResult)) {
      combined[el] = (combined[el] || 0) + cnt;
    }
  }
  return combined;
}

// Internal recursive parser
function _parseSegment(f) {
  // Replace square brackets with parens
  f = f.replace(/\[/g, '(').replace(/\]/g, ')');
  // Remove charge notation at end: e.g. 4-, 2+, +, -
  f = f.replace(/[0-9]*[+-]$/, '');
  f = f.trim();
  return _parse(f, 0).result;
}

function _parse(f, i) {
  const result = {};

  function addEl(el, cnt) {
    result[el] = (result[el] || 0) + cnt;
  }

  while (i < f.length) {
    const ch = f[i];

    if (ch === '(') {
      // Find matching closing paren
      const sub = _parse(f, i + 1);
      i = sub.i; // points to char after ')'
      // Read multiplier
      let numStr = '';
      while (i < f.length && /[0-9]/.test(f[i])) { numStr += f[i++]; }
      const mul = numStr ? parseInt(numStr) : 1;
      for (const [el, cnt] of Object.entries(sub.result)) addEl(el, cnt * mul);

    } else if (ch === ')') {
      return { result, i: i + 1 };

    } else if (/[A-Z]/.test(ch)) {
      // Element symbol: capital letter optionally followed by lowercase letters
      let sym = ch; i++;
      while (i < f.length && /[a-z]/.test(f[i])) { sym += f[i++]; }
      if (!(sym in ATOMIC_MASSES)) {
        throw new Error(`Unknown element: "${sym}"`);
      }
      // Read count
      let numStr = '';
      while (i < f.length && /[0-9]/.test(f[i])) { numStr += f[i++]; }
      const cnt = numStr ? parseInt(numStr) : 1;
      addEl(sym, cnt);

    } else if (/[0-9]/.test(ch)) {
      // Standalone number at start (e.g. in hydrate coefficient handled outside)
      // Skip — shouldn't normally appear here
      i++;
    } else {
      // Unknown character — skip silently (handles spaces, dashes, etc.)
      i++;
    }
  }

  return { result, i };
}

// ── COMPUTE MOLAR MASS ──
// Returns { mass, breakdown } where breakdown is array of { element, count, atomicMass, contribution }
function computeMolarMass(formula) {
  const atoms = parseFormula(formula);
  let mass = 0;
  const breakdown = [];
  for (const [el, cnt] of Object.entries(atoms)) {
    if (!(el in ATOMIC_MASSES)) throw new Error(`Unknown element: "${el}"`);
    const am = ATOMIC_MASSES[el];
    const contrib = am * cnt;
    mass += contrib;
    breakdown.push({ element: el, count: cnt, atomicMass: am, contribution: contrib });
  }
  // Sort by order they appear (already insertion-ordered from parser)
  return { mass, breakdown, atoms };
}

// ── BALANCE EQUATION (matrix / null-space method) ──
// Input: reactants[], products[]  (arrays of formula strings)
// Output: coefficients[] (same length as reactants + products) or throws

function balanceEquation(reactants, products) {
  const allFormulas = [...reactants, ...products];
  const n = allFormulas.length;
  if (n < 2) throw new Error('Need at least 2 compounds');

  // Collect all unique elements
  const elementSet = new Set();
  const atomMaps = allFormulas.map(f => {
    const atoms = parseFormula(f);
    Object.keys(atoms).forEach(el => elementSet.add(el));
    return atoms;
  });
  const elements = [...elementSet];
  const m = elements.length;

  // Build stoichiometry matrix (m rows × n cols)
  // Reactants are positive, products are negative (we solve for null space)
  const matrix = elements.map((el, r) =>
    allFormulas.map((_, c) => {
      const cnt = atomMaps[c][el] || 0;
      return c < reactants.length ? cnt : -cnt;
    })
  );

  // Solve using integer Gaussian elimination to find null space
  const coeffs = _nullSpaceInteger(matrix, n, m);
  if (!coeffs) throw new Error('Could not balance equation — check formulas');

  // All coefficients must be positive
  const anyNeg = coeffs.some(c => c < 0);
  if (anyNeg) {
    const minNeg = Math.min(...coeffs);
    // flip sign if needed
    const flipped = coeffs.map(c => -c);
    if (flipped.every(c => c > 0)) return flipped;
    throw new Error('Could not balance equation — check formulas');
  }
  if (coeffs.every(c => c === 0)) throw new Error('Trivial solution — check formulas');
  return coeffs;
}

// Integer null-space solver via fraction-free Gaussian elimination
function _nullSpaceInteger(matrix, n, m) {
  // Augment matrix with identity for tracking column ops
  // We work with rational numbers as [numerator, denominator] pairs
  // For simplicity, use floating-point Gaussian elimination then round

  // Build a copy as floats
  const A = matrix.map(row => [...row]);

  // Append slack: we want to find x s.t. A*x = 0
  // Use fraction-free approach: augment A with extra variable column, set last compound coeff = 1
  // Then solve the (m × (n-1)) system for the first n-1 unknowns

  if (n === 1) return null;

  // Set last coefficient = 1, move to RHS
  const rhs = A.map(row => -row[n - 1]);
  const lhs = A.map(row => row.slice(0, n - 1));

  // Gaussian elimination
  const nRows = m;
  const nCols = n - 1;
  const aug = lhs.map((row, i) => [...row, rhs[i]]);

  const pivotCols = [];
  let row = 0;
  for (let col = 0; col < nCols && row < nRows; col++) {
    // Find pivot
    let pivotRow = -1;
    let best = 0;
    for (let r = row; r < nRows; r++) {
      if (Math.abs(aug[r][col]) > best) { best = Math.abs(aug[r][col]); pivotRow = r; }
    }
    if (pivotRow === -1 || best < 1e-10) continue;
    // Swap
    [aug[row], aug[pivotRow]] = [aug[pivotRow], aug[row]];
    // Eliminate
    const pv = aug[row][col];
    for (let r = 0; r < nRows; r++) {
      if (r === row) continue;
      const factor = aug[r][col] / pv;
      for (let c = 0; c <= nCols; c++) aug[r][c] -= factor * aug[row][c];
    }
    pivotCols.push(col);
    row++;
  }

  // Back-substitute for free variables = 1
  const x = new Array(nCols).fill(1);
  for (let i = pivotCols.length - 1; i >= 0; i--) {
    const pc = pivotCols[i];
    // Find the row for this pivot col
    let pivRow = -1;
    for (let r = 0; r < nRows; r++) {
      if (Math.abs(aug[r][pc]) > 1e-10) { pivRow = r; break; }
    }
    if (pivRow === -1) continue;
    let sum = aug[pivRow][nCols];
    for (let c = 0; c < nCols; c++) {
      if (c !== pc) sum -= aug[pivRow][c] * x[c];
    }
    x[pc] = sum / aug[pivRow][pc];
  }
  x.push(1); // last compound = 1

  // Convert to integers via LCM of denominators
  // Find LCM of denominators when expressed as rationals
  const rationalized = x.map(v => {
    const r = _toRational(v, 1000);
    return r;
  });
  let denomLCM = 1;
  for (const [, d] of rationalized) denomLCM = lcm(denomLCM, d);
  let intCoeffs = rationalized.map(([n, d]) => Math.round(n * denomLCM / d));

  // Reduce by GCD
  let g = intCoeffs.reduce((a, b) => gcd(Math.abs(a), Math.abs(b)), 0);
  if (g === 0) return null;
  intCoeffs = intCoeffs.map(c => c / g);

  // Validate: all must be non-zero
  if (intCoeffs.some(c => c === 0)) return null;

  // Validate: A * x should ≈ 0
  for (let r = 0; r < m; r++) {
    let sum = 0;
    for (let c = 0; c < n; c++) {
      sum += matrix[r][c] * intCoeffs[c];
    }
    if (Math.abs(sum) > 0.5) return null;
  }

  return intCoeffs;
}

// Convert float to rational [num, den] with tolerance
function _toRational(x, maxDen) {
  if (Math.abs(x - Math.round(x)) < 1e-8) return [Math.round(x), 1];
  for (let d = 2; d <= maxDen; d++) {
    const n = Math.round(x * d);
    if (Math.abs(n / d - x) < 1e-7) return [n, d];
  }
  return [Math.round(x * maxDen), maxDen];
}// formula-parser.js

// ── ATOMIC MASSES (IUPAC 2021) ──
const ATOMIC_MASSES = {
  H:1.008, He:4.0026, Li:6.941, Be:9.0122, B:10.811, C:12.011, N:14.007,
  O:15.999, F:18.998, Ne:20.180, Na:22.990, Mg:24.305, Al:26.982, Si:28.086,
  P:30.974, S:32.06, Cl:35.453, Ar:39.948, K:39.098, Ca:40.078, Sc:44.956,
  Ti:47.867, V:50.942, Cr:51.996, Mn:54.938, Fe:55.845, Co:58.933, Ni:58.693,
  Cu:63.546, Zn:65.38, Ga:69.723, Ge:72.630, As:74.922, Se:78.971, Br:79.904,
  Kr:83.798, Rb:85.468, Sr:87.62, Y:88.906, Zr:91.224, Nb:92.906, Mo:95.96,
  Tc:98, Ru:101.07, Rh:102.91, Pd:106.42, Ag:107.87, Cd:112.41, In:114.82,
  Sn:118.71, Sb:121.76, Te:127.60, I:126.90, Xe:131.29, Cs:132.91, Ba:137.33,
  La:138.91, Ce:140.12, Pr:140.91, Nd:144.24, Pm:145, Sm:150.36, Eu:151.96,
  Gd:157.25, Tb:158.93, Dy:162.50, Ho:164.93, Er:167.26, Tm:168.93, Yb:173.04,
  Lu:174.97, Hf:178.49, Ta:180.95, W:183.84, Re:186.21, Os:190.23, Ir:192.22,
  Pt:195.08, Au:196.97, Hg:200.59, Tl:204.38, Pb:207.2, Bi:208.98, Po:209,
  At:210, Rn:222, Fr:223, Ra:226, Ac:227, Th:232.04, Pa:231.04, U:238.03,
  Np:237, Pu:244, Am:243, Cm:247, Bk:247, Cf:251, Es:252, Fm:257, Md:258,
  No:259, Lr:262, Rf:267, Db:268, Sg:271, Bh:272, Hs:270, Mt:276, Ds:281,
  Rg:280, Cn:285
};

// ── PARSE FORMULA ──
// Returns an object { element: count } or throws on invalid formula
// Supports:
//   - Parenthetical groups: Ca(OH)2, Fe2(SO4)3, Al2(SO4)3
//   - Hydrates: CuSO4*5H2O  (* asterisk recommended, · and • also work)
//   - Unicode subscripts: H₂O
//   - Nested parentheses: Ca(H2(PO4))2 (limited depth)
//   - Charges in brackets: [Fe(CN)6]4- (bracket treated like paren)

function parseFormula(formula) {
  if (!formula || !formula.trim()) throw new Error('Empty formula');

  // Normalize unicode subscripts to plain digits
  const subMap = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
  let f = formula.trim().replace(/[₀₁₂₃₄₅₆₇₈₉]/g, c => subMap[c] || c);

  // Handle hydrate separator: * (asterisk), · (middle dot), or • (bullet)
  // e.g. CuSO4*5H2O, CuSO4·5H2O, CuSO4•5H2O
  const hydrateParts = f.split(/[·•*]/);
  const combined = {};
  for (const part of hydrateParts) {
    const partResult = _parseSegment(part.trim());
    for (const [el, cnt] of Object.entries(partResult)) {
      combined[el] = (combined[el] || 0) + cnt;
    }
  }
  return combined;
}

// Internal recursive parser
function _parseSegment(f) {
  // Replace square brackets with parens
  f = f.replace(/\[/g, '(').replace(/\]/g, ')');
  // Remove charge notation at end: e.g. 4-, 2+, +, -
  f = f.replace(/[0-9]*[+-]$/, '');
  f = f.trim();
  return _parse(f, 0).result;
}

function _parse(f, i) {
  const result = {};

  function addEl(el, cnt) {
    result[el] = (result[el] || 0) + cnt;
  }

  while (i < f.length) {
    const ch = f[i];

    if (ch === '(') {
      // Find matching closing paren
      const sub = _parse(f, i + 1);
      i = sub.i; // points to char after ')'
      // Read multiplier
      let numStr = '';
      while (i < f.length && /[0-9]/.test(f[i])) { numStr += f[i++]; }
      const mul = numStr ? parseInt(numStr) : 1;
      for (const [el, cnt] of Object.entries(sub.result)) addEl(el, cnt * mul);

    } else if (ch === ')') {
      return { result, i: i + 1 };

    } else if (/[A-Z]/.test(ch)) {
      // Element symbol: capital letter optionally followed by lowercase letters
      let sym = ch; i++;
      while (i < f.length && /[a-z]/.test(f[i])) { sym += f[i++]; }
      if (!(sym in ATOMIC_MASSES)) {
        throw new Error(`Unknown element: "${sym}"`);
      }
      // Read count
      let numStr = '';
      while (i < f.length && /[0-9]/.test(f[i])) { numStr += f[i++]; }
      const cnt = numStr ? parseInt(numStr) : 1;
      addEl(sym, cnt);

    } else if (/[0-9]/.test(ch)) {
      // Standalone number at start (e.g. in hydrate coefficient handled outside)
      // Skip — shouldn't normally appear here
      i++;
    } else {
      // Unknown character — skip silently (handles spaces, dashes, etc.)
      i++;
    }
  }

  return { result, i };
}

// ── COMPUTE MOLAR MASS ──
// Returns { mass, breakdown } where breakdown is array of { element, count, atomicMass, contribution }
function computeMolarMass(formula) {
  const atoms = parseFormula(formula);
  let mass = 0;
  const breakdown = [];
  for (const [el, cnt] of Object.entries(atoms)) {
    if (!(el in ATOMIC_MASSES)) throw new Error(`Unknown element: "${el}"`);
    const am = ATOMIC_MASSES[el];
    const contrib = am * cnt;
    mass += contrib;
    breakdown.push({ element: el, count: cnt, atomicMass: am, contribution: contrib });
  }
  // Sort by order they appear (already insertion-ordered from parser)
  return { mass, breakdown, atoms };
}

// ── BALANCE EQUATION (matrix / null-space method) ──
// Input: reactants[], products[]  (arrays of formula strings)
// Output: coefficients[] (same length as reactants + products) or throws

function balanceEquation(reactants, products) {
  const allFormulas = [...reactants, ...products];
  const n = allFormulas.length;
  if (n < 2) throw new Error('Need at least 2 compounds');

  // Collect all unique elements
  const elementSet = new Set();
  const atomMaps = allFormulas.map(f => {
    const atoms = parseFormula(f);
    Object.keys(atoms).forEach(el => elementSet.add(el));
    return atoms;
  });
  const elements = [...elementSet];
  const m = elements.length;

  // Build stoichiometry matrix (m rows × n cols)
  // Reactants are positive, products are negative (we solve for null space)
  const matrix = elements.map((el, r) =>
    allFormulas.map((_, c) => {
      const cnt = atomMaps[c][el] || 0;
      return c < reactants.length ? cnt : -cnt;
    })
  );

  // Solve using integer Gaussian elimination to find null space
  const coeffs = _nullSpaceInteger(matrix, n, m);
  if (!coeffs) throw new Error('Could not balance equation — check formulas');

  // All coefficients must be positive
  const anyNeg = coeffs.some(c => c < 0);
  if (anyNeg) {
    const minNeg = Math.min(...coeffs);
    // flip sign if needed
    const flipped = coeffs.map(c => -c);
    if (flipped.every(c => c > 0)) return flipped;
    throw new Error('Could not balance equation — check formulas');
  }
  if (coeffs.every(c => c === 0)) throw new Error('Trivial solution — check formulas');
  return coeffs;
}

// Integer null-space solver via fraction-free Gaussian elimination
function _nullSpaceInteger(matrix, n, m) {
  // Augment matrix with identity for tracking column ops
  // We work with rational numbers as [numerator, denominator] pairs
  // For simplicity, use floating-point Gaussian elimination then round

  // Build a copy as floats
  const A = matrix.map(row => [...row]);

  // Append slack: we want to find x s.t. A*x = 0
  // Use fraction-free approach: augment A with extra variable column, set last compound coeff = 1
  // Then solve the (m × (n-1)) system for the first n-1 unknowns

  if (n === 1) return null;

  // Set last coefficient = 1, move to RHS
  const rhs = A.map(row => -row[n - 1]);
  const lhs = A.map(row => row.slice(0, n - 1));

  // Gaussian elimination
  const nRows = m;
  const nCols = n - 1;
  const aug = lhs.map((row, i) => [...row, rhs[i]]);

  const pivotCols = [];
  let row = 0;
  for (let col = 0; col < nCols && row < nRows; col++) {
    // Find pivot
    let pivotRow = -1;
    let best = 0;
    for (let r = row; r < nRows; r++) {
      if (Math.abs(aug[r][col]) > best) { best = Math.abs(aug[r][col]); pivotRow = r; }
    }
    if (pivotRow === -1 || best < 1e-10) continue;
    // Swap
    [aug[row], aug[pivotRow]] = [aug[pivotRow], aug[row]];
    // Eliminate
    const pv = aug[row][col];
    for (let r = 0; r < nRows; r++) {
      if (r === row) continue;
      const factor = aug[r][col] / pv;
      for (let c = 0; c <= nCols; c++) aug[r][c] -= factor * aug[row][c];
    }
    pivotCols.push(col);
    row++;
  }

  // Back-substitute for free variables = 1
  const x = new Array(nCols).fill(1);
  for (let i = pivotCols.length - 1; i >= 0; i--) {
    const pc = pivotCols[i];
    // Find the row for this pivot col
    let pivRow = -1;
    for (let r = 0; r < nRows; r++) {
      if (Math.abs(aug[r][pc]) > 1e-10) { pivRow = r; break; }
    }
    if (pivRow === -1) continue;
    let sum = aug[pivRow][nCols];
    for (let c = 0; c < nCols; c++) {
      if (c !== pc) sum -= aug[pivRow][c] * x[c];
    }
    x[pc] = sum / aug[pivRow][pc];
  }
  x.push(1); // last compound = 1

  // Convert to integers via LCM of denominators
  // Find LCM of denominators when expressed as rationals
  const rationalized = x.map(v => {
    const r = _toRational(v, 1000);
    return r;
  });
  let denomLCM = 1;
  for (const [, d] of rationalized) denomLCM = lcm(denomLCM, d);
  let intCoeffs = rationalized.map(([n, d]) => Math.round(n * denomLCM / d));

  // Reduce by GCD
  let g = intCoeffs.reduce((a, b) => gcd(Math.abs(a), Math.abs(b)), 0);
  if (g === 0) return null;
  intCoeffs = intCoeffs.map(c => c / g);

  // Validate: all must be non-zero
  if (intCoeffs.some(c => c === 0)) return null;

  // Validate: A * x should ≈ 0
  for (let r = 0; r < m; r++) {
    let sum = 0;
    for (let c = 0; c < n; c++) {
      sum += matrix[r][c] * intCoeffs[c];
    }
    if (Math.abs(sum) > 0.5) return null;
  }

  return intCoeffs;
}

// Convert float to rational [num, den] with tolerance
function _toRational(x, maxDen) {
  if (Math.abs(x - Math.round(x)) < 1e-8) return [Math.round(x), 1];
  for (let d = 2; d <= maxDen; d++) {
    const n = Math.round(x * d);
    if (Math.abs(n / d - x) < 1e-7) return [n, d];
  }
  return [Math.round(x * maxDen), maxDen];
}
