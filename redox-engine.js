// redox-engine.js

// ═══════════════════════════════════════════════════════════════
// SOLUBILITY RULES & ION DISSOCIATION
// ═══════════════════════════════════════════════════════════════

// Strong acids — dissociate fully in (aq)
const STRONG_ACIDS = new Set(['HCl','HBr','HI','HNO3','H2SO4','HClO4','HClO3']);

// Strong bases — dissociate fully in (aq)
const STRONG_BASES = new Set(['LiOH','NaOH','KOH','RbOH','CsOH',
  'Ca(OH)2','Sr(OH)2','Ba(OH)2']);

// Weak acids — stay molecular
const WEAK_ACIDS = new Set(['HF','H2CO3','H2SO3','H3PO4','H2S','HCN',
  'HC2H3O2','CH3COOH','HNO2','H2C2O4','HClO2','HClO','H2CrO4']);

// Weak bases — stay molecular
const WEAK_BASES = new Set(['NH3','NH4OH']);

// Known soluble ion pairs (formula → {cation, anion, cationCharge, anionCharge})
// Used to decide whether an (aq) ionic compound dissociates
// Solubility rules encoded:
//   Always soluble: Na+, K+, NH4+, NO3-, C2H3O2-
//   Usually soluble: Cl-, Br-, I- (except Ag+, Pb2+, Hg2 2+)
//   Usually soluble: SO4 2- (except Ba2+, Pb2+, Ca2+ slightly)
//   Insoluble: CO3 2-, PO4 3-, S2-, OH- (except group 1 / Ba2+)
//   Slightly soluble: AgCl, PbCl2 (insoluble for our purposes)

// Comprehensive ion lookup: formula string → array of ions when dissolved
// Returns null if compound is insoluble / stays molecular
function getIons(formula, state) {
  // Only (aq) compounds dissociate
  if (state !== 'aq') return null;

  // Strong acids
  if (STRONG_ACIDS.has(formula)) return dissociateAcid(formula);

  // Strong bases
  if (STRONG_BASES.has(formula)) return dissociateBase(formula);

  // Weak acids / bases stay molecular
  if (WEAK_ACIDS.has(formula) || WEAK_BASES.has(formula)) return null;

  // Apply solubility rules to ionic compounds
  return applySolubilityRules(formula);
}

function dissociateAcid(formula) {
  const acids = {
    'HCl':   [{ formula:'H', charge:+1, count:1 },{ formula:'Cl',  charge:-1, count:1 }],
    'HBr':   [{ formula:'H', charge:+1, count:1 },{ formula:'Br',  charge:-1, count:1 }],
    'HI':    [{ formula:'H', charge:+1, count:1 },{ formula:'I',   charge:-1, count:1 }],
    'HNO3':  [{ formula:'H', charge:+1, count:1 },{ formula:'NO3', charge:-1, count:1 }],
    'H2SO4': [{ formula:'H', charge:+1, count:2 },{ formula:'SO4', charge:-2, count:1 }],
    'HClO4': [{ formula:'H', charge:+1, count:1 },{ formula:'ClO4',charge:-1, count:1 }],
    'HClO3': [{ formula:'H', charge:+1, count:1 },{ formula:'ClO3',charge:-1, count:1 }],
  };
  return acids[formula] || null;
}

function dissociateBase(formula) {
  const bases = {
    'LiOH':    [{ formula:'Li', charge:+1, count:1 },{ formula:'OH', charge:-1, count:1 }],
    'NaOH':    [{ formula:'Na', charge:+1, count:1 },{ formula:'OH', charge:-1, count:1 }],
    'KOH':     [{ formula:'K',  charge:+1, count:1 },{ formula:'OH', charge:-1, count:1 }],
    'RbOH':    [{ formula:'Rb', charge:+1, count:1 },{ formula:'OH', charge:-1, count:1 }],
    'CsOH':    [{ formula:'Cs', charge:+1, count:1 },{ formula:'OH', charge:-1, count:1 }],
    'Ca(OH)2': [{ formula:'Ca', charge:+2, count:1 },{ formula:'OH', charge:-1, count:2 }],
    'Sr(OH)2': [{ formula:'Sr', charge:+2, count:1 },{ formula:'OH', charge:-1, count:2 }],
    'Ba(OH)2': [{ formula:'Ba', charge:+2, count:1 },{ formula:'OH', charge:-1, count:2 }],
  };
  return bases[formula] || null;
}

// Ionic compound database: formula → cation/anion info
const IONIC_COMPOUNDS = {
  // Nitrates (always soluble)
  'NaNO3':   { c:'Na',   cc:+1, a:'NO3',  ac:-1 },
  'KNO3':    { c:'K',    cc:+1, a:'NO3',  ac:-1 },
  'AgNO3':   { c:'Ag',   cc:+1, a:'NO3',  ac:-1 },
  'Cu(NO3)2':{ c:'Cu',   cc:+2, a:'NO3',  ac:-1 },
  'Zn(NO3)2':{ c:'Zn',   cc:+2, a:'NO3',  ac:-1 },
  'Fe(NO3)3':{ c:'Fe',   cc:+3, a:'NO3',  ac:-1 },
  'Fe(NO3)2':{ c:'Fe',   cc:+2, a:'NO3',  ac:-1 },
  'Pb(NO3)2':{ c:'Pb',   cc:+2, a:'NO3',  ac:-1 },
  'Mg(NO3)2':{ c:'Mg',   cc:+2, a:'NO3',  ac:-1 },
  'Ca(NO3)2':{ c:'Ca',   cc:+2, a:'NO3',  ac:-1 },
  'Al(NO3)3':{ c:'Al',   cc:+3, a:'NO3',  ac:-1 },
  'Ba(NO3)2':{ c:'Ba',   cc:+2, a:'NO3',  ac:-1 },
  'NH4NO3':  { c:'NH4',  cc:+1, a:'NO3',  ac:-1 },
  // Chlorides (soluble except Ag+, Pb2+, Hg2 2+)
  'NaCl':    { c:'Na',   cc:+1, a:'Cl',   ac:-1 },
  'KCl':     { c:'K',    cc:+1, a:'Cl',   ac:-1 },
  'MgCl2':   { c:'Mg',   cc:+2, a:'Cl',   ac:-1 },
  'CaCl2':   { c:'Ca',   cc:+2, a:'Cl',   ac:-1 },
  'BaCl2':   { c:'Ba',   cc:+2, a:'Cl',   ac:-1 },
  'CuCl2':   { c:'Cu',   cc:+2, a:'Cl',   ac:-1 },
  'ZnCl2':   { c:'Zn',   cc:+2, a:'Cl',   ac:-1 },
  'FeCl3':   { c:'Fe',   cc:+3, a:'Cl',   ac:-1 },
  'FeCl2':   { c:'Fe',   cc:+2, a:'Cl',   ac:-1 },
  'AlCl3':   { c:'Al',   cc:+3, a:'Cl',   ac:-1 },
  'NH4Cl':   { c:'NH4',  cc:+1, a:'Cl',   ac:-1 },
  // Insoluble chlorides
  'AgCl':    null,
  'PbCl2':   null,
  // Sulfates (soluble except Ba2+, Pb2+, Ca2+ slightly)
  'Na2SO4':  { c:'Na',   cc:+1, a:'SO4',  ac:-2 },
  'K2SO4':   { c:'K',    cc:+1, a:'SO4',  ac:-2 },
  'MgSO4':   { c:'Mg',   cc:+2, a:'SO4',  ac:-2 },
  'CuSO4':   { c:'Cu',   cc:+2, a:'SO4',  ac:-2 },
  'ZnSO4':   { c:'Zn',   cc:+2, a:'SO4',  ac:-2 },
  'FeSO4':   { c:'Fe',   cc:+2, a:'SO4',  ac:-2 },
  'Fe2(SO4)3':{ c:'Fe',  cc:+3, a:'SO4',  ac:-2 },
  'Al2(SO4)3':{ c:'Al',  cc:+3, a:'SO4',  ac:-2 },
  'NH4)2SO4':{ c:'NH4',  cc:+1, a:'SO4',  ac:-2 },
  '(NH4)2SO4':{ c:'NH4', cc:+1, a:'SO4',  ac:-2 },
  // Insoluble sulfates
  'BaSO4':   null,
  'PbSO4':   null,
  // Carbonates (insoluble except Na+, K+, NH4+)
  'Na2CO3':  { c:'Na',   cc:+1, a:'CO3',  ac:-2 },
  'K2CO3':   { c:'K',    cc:+1, a:'CO3',  ac:-2 },
  '(NH4)2CO3':{ c:'NH4', cc:+1, a:'CO3',  ac:-2 },
  'CaCO3':   null,
  'BaCO3':   null,
  'MgCO3':   null,
  'FeCO3':   null,
  'CuCO3':   null,
  'ZnCO3':   null,
  // Hydroxides (insoluble except group 1 and Ba2+)
  'Cu(OH)2': null,
  'Fe(OH)3': null,
  'Fe(OH)2': null,
  'Zn(OH)2': null,
  'Mg(OH)2': null,
  'Al(OH)3': null,
  'Pb(OH)2': null,
  // Acetates (mostly soluble)
  'NaC2H3O2':{ c:'Na',  cc:+1, a:'C2H3O2', ac:-1 },
  'KC2H3O2': { c:'K',   cc:+1, a:'C2H3O2', ac:-1 },
  // Phosphates (insoluble except Na+, K+, NH4+)
  'Na3PO4':  { c:'Na',  cc:+1, a:'PO4',  ac:-3 },
  'K3PO4':   { c:'K',   cc:+1, a:'PO4',  ac:-3 },
  'Ca3(PO4)2':null,
  'AlPO4':   null,
  // Bromides/Iodides (soluble except Ag+, Pb2+)
  'KBr':     { c:'K',   cc:+1, a:'Br',   ac:-1 },
  'NaBr':    { c:'Na',  cc:+1, a:'Br',   ac:-1 },
  'KI':      { c:'K',   cc:+1, a:'I',    ac:-1 },
  'NaI':     { c:'Na',  cc:+1, a:'I',    ac:-1 },
  'AgBr':    null,
  'AgI':     null,
  // Misc
  'MnSO4':   { c:'Mn',  cc:+2, a:'SO4',  ac:-2 },
  'Cr2(SO4)3':{ c:'Cr', cc:+3, a:'SO4',  ac:-2 },
  'SnCl2':   { c:'Sn',  cc:+2, a:'Cl',   ac:-1 },
  'SnCl4':   { c:'Sn',  cc:+4, a:'Cl',   ac:-1 },
};

function applySolubilityRules(formula) {
  if (formula in IONIC_COMPOUNDS) {
    const entry = IONIC_COMPOUNDS[formula];
    if (!entry) return null; // insoluble — stays as formula unit
    // Return dissociated ions
    const cCount = getCationCount(formula, entry);
    const aCount = getAnionCount(formula, entry, cCount);
    return [
      { formula: entry.c, charge: entry.cc, count: cCount },
      { formula: entry.a, charge: entry.ac, count: aCount },
    ];
  }
  // Unknown compound — if (aq), assume ionic but can't determine ions
  // Return null to keep as molecular (safe default)
  return null;
}

function getCationCount(formula, entry) {
  // Determine cation count from formula
  // Simple heuristic: balance charges
  const anionCount = getAnionCountFromCharges(entry.cc, entry.ac);
  return anionCount[0];
}
function getAnionCount(formula, entry, cCount) {
  const anionCount = getAnionCountFromCharges(entry.cc, entry.ac);
  return anionCount[1];
}
function getAnionCountFromCharges(cc, ac) {
  // Find smallest integers n,m such that n*cc + m*ac = 0
  const absCC = Math.abs(cc), absAC = Math.abs(ac);
  const g = gcd(absCC, absAC);
  return [absAC / g, absCC / g];
}

// ═══════════════════════════════════════════════════════════════
// PARSE MOLECULAR EQUATION WITH STATES
// Returns { reactants: [{formula, state}], products: [{formula, state}] }
// ═══════════════════════════════════════════════════════════════
function parseMolecularEquation(raw) {
  // Normalize arrow
  let s = raw
    .replace(/🡪|➜|➝|⟶|→|→/g, '→')
    .replace(/--?>|=>/g, '→');

  const arrowCount = (s.match(/→/g) || []).length;
  if (arrowCount === 0) throw new Error('No reaction arrow found. Use → or -> to separate reactants from products.');
  if (arrowCount > 1)  throw new Error('Multiple arrows found. Enter one equation at a time.');

  const [leftSide, rightSide] = s.split('→');
  return {
    reactants: parseMolecularSide(leftSide),
    products:  parseMolecularSide(rightSide),
  };
}

function parseMolecularSide(side) {
  const parts = splitOnPlus(side);
  return parts.map(p => parseMolecularCompound(p.trim())).filter(x => x !== null);
}

function splitOnPlus(str) {
  const parts = [];
  let parenDepth = 0, curlyDepth = 0, current = '';
  for (const ch of str) {
    if (ch === '(') { parenDepth++; current += ch; }
    else if (ch === ')') { current += ch; if (parenDepth > 0) parenDepth--; }
    else if (ch === '{') { curlyDepth++; current += ch; }
    else if (ch === '}') { current += ch; if (curlyDepth > 0) curlyDepth--; }
    // Only split on + when outside both parens and curly braces
    else if (ch === '+' && parenDepth === 0 && curlyDepth === 0) {
      parts.push(current); current = '';
    }
    else { current += ch; }
  }
  parts.push(current);
  return parts;
}

function parseMolecularCompound(token) {
  if (!token.trim()) return null;
  let s = token.trim();

  // Strip leading blanks/underscores
  s = s.replace(/^_+/, '').trim();
  // Strip leading coefficient (digits before capital letter or open paren)
  s = s.replace(/^\d+(?=[A-Z(])/, '').trim();

  // Extract state symbol: (s), (l), (g), (aq) at the END
  let state = null;
  const stateMatch = s.match(/\(\s*(s|l|g|aq)\s*\)\s*$/i);
  if (stateMatch) {
    state = stateMatch[1].toLowerCase();
    s = s.slice(0, stateMatch.index).trim();
  }

  // Extract ion charge using formula-validated parsing
  const { formula, charge } = extractIonCharge(s);
  if (!formula) return null;

  return { formula, state, charge };
}

// Robustly extract formula and charge from an ion string using curly brace notation.
// Users MUST write charges in curly braces: I3{-1}, S2O3{2-}, Fe{2+}, MnO4{-}
// Neutral molecules/compounds are written without braces: Fe, H2O, CuSO4
function extractIonCharge(s) {
  s = s.trim().replace(/\s+/g, '');
  if (!s) return { formula: '', charge: 0 };

  // Curly brace notation: formula{charge}
  // Supported charge formats inside braces:
  //   "2-", "3+"        (magnitude then sign)
  //   "-2", "+3", "-1"  (sign then magnitude)
  //   "-", "+"          (bare sign, magnitude = 1)
  const curlyMatch = s.match(/^(.+)\{([^}]+)\}$/);
  if (curlyMatch) {
    const formula = curlyMatch[1].trim();
    const chargeStr = curlyMatch[2].trim();
    const m1 = chargeStr.match(/^(\d+)([+\-])$/);  // "2-", "3+"
    const m2 = chargeStr.match(/^([+\-])(\d+)$/);  // "+2", "-1"
    const m3 = chargeStr.match(/^([+\-])$/);         // "+", "-"
    let charge = 0;
    if      (m1) charge = (m1[2] === '+' ? +1 : -1) * parseInt(m1[1]);
    else if (m2) charge = (m2[1] === '+' ? +1 : -1) * parseInt(m2[2]);
    else if (m3) charge = m3[1] === '+' ? +1 : -1;
    return { formula, charge };
  }

  // No curly braces — treat as neutral (molecular compound or elemental)
  return { formula: s, charge: 0 };
}

// ═══════════════════════════════════════════════════════════════
// BUILD NET IONIC EQUATION
// ═══════════════════════════════════════════════════════════════
function buildNetIonic(reactants, products) {
  // Expand (aq) ionic compounds into their ions.
  // If a species has an explicit charge (parsed from the input), treat it as
  // already ionic — this handles net ionic equations entered directly.
  const expandSide = (compounds) => {
    const expanded = [];
    for (const c of compounds) {
      // Try database dissociation first (for molecular equations with state symbols)
      const ions = getIons(c.formula, c.state);
      if (ions) {
        for (const ion of ions) {
          expanded.push({ formula: ion.formula, charge: ion.charge, count: ion.count, isIon: true, parent: c.formula });
        }
      } else if (c.charge !== 0 && c.charge !== undefined) {
        // Species has explicit charge from input — already an ion
        expanded.push({ formula: c.formula, charge: c.charge, count: 1, isIon: true, parent: c.formula });
      } else {
        // Neutral or unknown — keep as formula unit
        expanded.push({ formula: c.formula, charge: 0, count: 1, isIon: false, state: c.state, parent: c.formula });
      }
    }
    return expanded;
  };

  const expandedR = expandSide(reactants);
  const expandedP = expandSide(products);

  // Find spectator ions: appear on both sides with same formula and charge
  const toKey = (item) => `${item.formula}__${item.charge}`;
  const rKeys = new Map();
  const pKeys = new Map();

  expandedR.forEach(item => {
    if (item.isIon) {
      const k = toKey(item);
      rKeys.set(k, (rKeys.get(k) || 0) + item.count);
    }
  });
  expandedP.forEach(item => {
    if (item.isIon) {
      const k = toKey(item);
      pKeys.set(k, (pKeys.get(k) || 0) + item.count);
    }
  });

  const spectators = new Set();
  for (const [k, rCount] of rKeys) {
    if (pKeys.has(k)) spectators.add(k);
  }

  // Net ionic: remove spectators
  const netR = expandedR.filter(item => !item.isIon || !spectators.has(toKey(item)));
  const netP = expandedP.filter(item => !item.isIon || !spectators.has(toKey(item)));

  // Collect spectator details for display
  const spectatorList = [];
  for (const k of spectators) {
    const [formula, charge] = k.split('__');
    spectatorList.push({ formula, charge: parseInt(charge) });
  }

  return { netR, netP, spectatorList, expandedR, expandedP };
}

// ═══════════════════════════════════════════════════════════════
// OXIDATION NUMBER RULES
// Returns oxidation number for an element in a given compound context
// ═══════════════════════════════════════════════════════════════

// Known fixed oxidation states for simple ions
const FIXED_OX = {
  // Group 1
  'Li':+1,'Na':+1,'K':+1,'Rb':+1,'Cs':+1,'Fr':+1,
  // Group 2
  'Be':+2,'Mg':+2,'Ca':+2,'Sr':+2,'Ba':+2,'Ra':+2,
  // Common fixed
  'Al':+3,'Zn':+2,'Ag':+1,'F':-1,
  // Hydrogen: +1 in most, -1 in metal hydrides (handled contextually)
  // Oxygen: -2 in most, -1 in peroxides, -½ in superoxides (handled contextually)
};

// Assign oxidation numbers to all elements in a formula
// Returns array of { element, count, oxidationNumber, isFractional }
function assignOxidationNumbers(formula, charge) {
  // charge = overall charge on the species (0 for neutral)
  let atoms;
  try { atoms = parseFormula(formula); } catch(e) { return []; }
  const elements = Object.entries(atoms); // [[el, count], ...]

  // Special cases first
  const uniqueEls = new Set(Object.keys(atoms));
  // Single-element species: ON = charge / count (may be fractional, e.g. I3- → -1/3)
  // Elemental form (charge 0) → ON = 0; Ion like I3- (charge -1) → ON = -1/3
  if (uniqueEls.size === 1) {
    const [el, cnt] = elements[0];
    const on = (charge || 0) / cnt;
    const isFrac = !Number.isInteger(on);
    return [{ element: el, count: cnt, oxidationNumber: on, isFractional: isFrac }];
  }

  // Peroxides: O2 2- type or H2O2
  if (formula === 'H2O2' || formula === 'Na2O2' || formula === 'BaO2') {
    const result = [];
    for (const [el, cnt] of elements) {
      result.push({ element: el, count: cnt,
        oxidationNumber: el === 'O' ? -1 : (FIXED_OX[el] || +1),
        isFractional: false });
    }
    return result;
  }

  // Try to solve using known fixed oxidation states for most elements
  // Strategy: assign fixed ONs to known elements, solve for unknown
  const fixedMap = {};
  const unknownEls = [];

  for (const [el, cnt] of elements) {
    if (el === 'H') {
      // H is +1 except in metal hydrides (NaH, CaH2, etc.)
      const hasAlkali = elements.some(([e]) => ['Li','Na','K','Rb','Cs','Ca','Mg','Ba'].includes(e) && e !== 'H');
      fixedMap['H'] = hasAlkali && formula.endsWith('H') ? -1 : +1;
    } else if (el === 'O') {
      fixedMap['O'] = -2; // default; peroxides handled above
    } else if (el in FIXED_OX) {
      fixedMap[el] = FIXED_OX[el];
    } else {
      unknownEls.push(el);
    }
  }

  // Sum of known contributions
  let knownSum = 0;
  for (const [el, cnt] of elements) {
    if (el in fixedMap) knownSum += fixedMap[el] * cnt;
  }

  // Solve for unknown elements
  // charge = sum of all oxidation numbers * counts
  const targetSum = charge || 0;
  const unknownSum = targetSum - knownSum;

  const result = [];
  if (unknownEls.length === 0) {
    // All known — just return
    for (const [el, cnt] of elements) {
      result.push({ element: el, count: cnt, oxidationNumber: fixedMap[el], isFractional: false });
    }
  } else if (unknownEls.length === 1) {
    const el = unknownEls[0];
    const cnt = atoms[el];
    const on = unknownSum / cnt;
    const isFrac = !Number.isInteger(on);
    for (const [e, c] of elements) {
      if (e === el) result.push({ element: e, count: c, oxidationNumber: on, isFractional: isFrac });
      else result.push({ element: e, count: c, oxidationNumber: fixedMap[e], isFractional: false });
    }
  } else {
    // Multiple unknowns — can't solve uniquely, return best guess
    for (const [e, c] of elements) {
      result.push({ element: e, count: c,
        oxidationNumber: e in fixedMap ? fixedMap[e] : 0,
        isFractional: false });
    }
  }

  return result;
}

// Get the charge from an ion formula like "Fe2+", "SO4 2-", "Cu2+"
function parseIonCharge(formula) {
  const m = formula.match(/(\d*)[+\-]$/);
  if (!m) return 0;
  const sign = formula.endsWith('+') ? +1 : -1;
  const mag  = m[1] ? parseInt(m[1]) : 1;
  return sign * mag;
}

// ═══════════════════════════════════════════════════════════════
// IDENTIFY OXIDATION/REDUCTION from net ionic equation
// ═══════════════════════════════════════════════════════════════
function identifyRedoxChanges(netR, netP) {
  // For each species, find the element that changes oxidation state
  // Match reactant species to product species by element
  const changes = [];

  const getON = (species) => {
    const charge = species.charge || 0;
    return assignOxidationNumbers(species.formula, charge);
  };

  // Build map of element → {reactant ON, product ON, reactantFormula, productFormula}
  const rONmap = {}; // element → { on, formula, charge }
  const pONmap = {};

  for (const sp of netR) {
    const ons = getON(sp);
    for (const { element, oxidationNumber } of ons) {
      rONmap[element] = { on: oxidationNumber, formula: sp.formula, charge: sp.charge || 0 };
    }
  }
  for (const sp of netP) {
    const ons = getON(sp);
    for (const { element, oxidationNumber } of ons) {
      pONmap[element] = { on: oxidationNumber, formula: sp.formula, charge: sp.charge || 0 };
    }
  }

  for (const el of Object.keys(rONmap)) {
    if (el in pONmap) {
      const rON = rONmap[el].on;
      const pON = pONmap[el].on;
      if (Math.abs(pON - rON) > 0.001) {
        const change = pON - rON;
        changes.push({
          element: el,
          reactantFormula:  rONmap[el].formula,
          productFormula:   pONmap[el].formula,
          reactantCharge:   rONmap[el].charge,
          productCharge:    pONmap[el].charge,
          reactantON: rON,
          productON:  pON,
          type: change > 0 ? 'oxidation' : 'reduction',
        });
      }
    }
  }

  return changes;
}

// ═══════════════════════════════════════════════════════════════
// HALF-REACTION BUILDER
// Takes a single half-reaction as { leftSpecies[], rightSpecies[] }
// where each species has { formula, charge, coeff }
// Returns step-by-step balancing data
// ═══════════════════════════════════════════════════════════════
function buildHalfReaction(leftSpecies, rightSpecies, medium) {
  const steps = [];

  // Step 1: Write unbalanced half-reaction
  const leftStr  = speciesToString(leftSpecies);
  const rightStr = speciesToString(rightSpecies);
  steps.push({ label: 'Write the unbalanced half-reaction', left: leftStr, right: rightStr });

  // Step 2: Balance atoms other than O and H
  // For the typical single-element change, find the element changing and balance it
  let lCoeff = 1, rCoeff = 1;
  const lAtoms = countAtoms(leftSpecies);
  const rAtoms = countAtoms(rightSpecies);

  // Find main element (not H, not O)
  const mainEls = Object.keys(lAtoms).filter(e => e !== 'H' && e !== 'O');
  for (const el of mainEls) {
    const lCnt = lAtoms[el] || 0;
    const rCnt = rAtoms[el] || 0;
    if (lCnt > 0 && rCnt > 0 && lCnt !== rCnt) {
      const g = gcd(lCnt, rCnt);
      lCoeff = rCnt / g;
      rCoeff = lCnt / g;
      break;
    }
  }

  // Scale species
  const scaledL = scaleSpecies(leftSpecies,  lCoeff);
  const scaledR = scaleSpecies(rightSpecies, rCoeff);
  const scaledLAtoms = countAtoms(scaledL);
  const scaledRAtoms = countAtoms(scaledR);

  const step2L = speciesToString(scaledL);
  const step2R = speciesToString(scaledR);
  const atomsChanged = lCoeff !== 1 || rCoeff !== 1;
  steps.push({
    label: 'Balance atoms other than O and H',
    left: step2L, right: step2R,
    note: atomsChanged
      ? `Multiply left by ${lCoeff}, right by ${rCoeff} to balance ${mainEls[0] || 'main element'} atoms`
      : 'Atoms already balanced — no change needed'
  });

  // Step 3: Balance O with H2O
  const lO = scaledLAtoms['O'] || 0;
  const rO = scaledRAtoms['O'] || 0;
  const oDiff = lO - rO;

  let h2oLeftCount = 0, h2oRightCount = 0;
  if (oDiff > 0)      h2oRightCount = oDiff;
  else if (oDiff < 0) h2oLeftCount  = -oDiff;

  const step3L = step2L + (h2oLeftCount  ? ` + ${h2oLeftCount > 1 ? h2oLeftCount : ''}H₂O` : '');
  const step3R = step2R + (h2oRightCount ? ` + ${h2oRightCount > 1 ? h2oRightCount : ''}H₂O` : '');

  steps.push({
    label: 'Balance O atoms by adding H₂O',
    left: step3L, right: step3R,
    note: (lO === 0 && rO === 0) ? 'No oxygen present — skip this step'
      : oDiff === 0 ? 'Oxygen already balanced'
      : `Added ${Math.abs(oDiff)} H₂O to ${oDiff > 0 ? 'right' : 'left'} side`
  });

  // Step 4: Balance H with H+
  // H now includes original H + H from added H2O
  const lH = (scaledLAtoms['H'] || 0) + h2oLeftCount  * 2;
  const rH = (scaledRAtoms['H'] || 0) + h2oRightCount * 2;
  const hDiff = rH - lH;

  let hLeftCount = 0, hRightCount = 0;
  if (hDiff > 0)      hLeftCount  = hDiff;
  else if (hDiff < 0) hRightCount = -hDiff;

  const step4L = (hLeftCount  ? `${hLeftCount > 1 ? hLeftCount : ''}H⁺ + ` : '') + step3L;
  const step4R = step3R + (hRightCount ? ` + ${hRightCount > 1 ? hRightCount : ''}H⁺` : '');

  steps.push({
    label: 'Balance H atoms by adding H⁺',
    left: step4L, right: step4R,
    note: (lH === 0 && rH === 0) ? 'No hydrogen imbalance — skip this step'
      : hDiff === 0 ? 'Hydrogen already balanced'
      : `Added ${Math.abs(hDiff)} H⁺ to ${hDiff > 0 ? 'left' : 'right'} side`
  });

  // Step 5: Balance charge with electrons
  // Calculate total charge on each side
  const totalLCharge = calcCharge(scaledL) + hLeftCount;
  const totalRCharge = calcCharge(scaledR) + hRightCount;
  const eDiff = totalLCharge - totalRCharge;

  let eLeftCount = 0, eRightCount = 0;
  if (eDiff > 0)      eLeftCount  = eDiff;  // add e- to left (reduction)
  else if (eDiff < 0) eRightCount = -eDiff; // add e- to right (oxidation)

  const eStr = (n) => `${n > 1 ? n : ''}e⁻`;
  const step5L = (eLeftCount  ? `${eStr(eLeftCount)} + ` : '') + step4L;
  const step5R = step4R + (eRightCount ? ` + ${eStr(eRightCount)}` : '');

  const finalLCharge = totalLCharge - eLeftCount;
  const finalRCharge = totalRCharge + eRightCount;

  steps.push({
    label: 'Balance charge by adding electrons (e⁻)',
    left: step5L, right: step5R,
    note: `Left total charge: ${fmtCharge(finalLCharge)} | Right total charge: ${fmtCharge(finalRCharge)}`
  });

  // Step 6 (basic only): Convert H⁺ to OH⁻
  let finalLeft = step5L, finalRight = step5R;
  if (medium === 'basic') {
    const totalH = hLeftCount + hRightCount;
    if (totalH > 0) {
      const n = totalH;
      const ohStr = `${n > 1 ? n : ''}OH⁻`;
      const h2oStr = `${n > 1 ? n : ''}H₂O`;
      if (hLeftCount > 0) {
        // H⁺ on left: add OH⁻ to both sides, H⁺ + OH⁻ → H₂O, replace H⁺ on left with H₂O
        finalLeft  = finalLeft.replace(/\d*H⁺ \+ /, h2oStr + ' + ');
        finalRight = finalRight + ` + ${ohStr}`;
      } else if (hRightCount > 0) {
        // H⁺ on right: add OH⁻ to both sides
        finalRight = finalRight.replace(/\+ \d*H⁺/, `+ ${h2oStr}`);
        finalLeft  = `${ohStr} + ` + finalLeft;
      }
      steps.push({
        label: 'Convert to basic solution: replace H⁺ with OH⁻',
        left: finalLeft, right: finalRight,
        note: `Added ${n} OH⁻ to both sides. H⁺ + OH⁻ → H₂O. Cancel any H₂O appearing on both sides.`
      });
    }
  }

  const electrons = Math.max(eLeftCount, eRightCount);
  const isOxidation = eRightCount > 0;

  return { steps, electrons, isOxidation, finalLeft, finalRight,
           eLeftCount, eRightCount, lCoeff, rCoeff,
           h2oLeftCount, h2oRightCount, hLeftCount, hRightCount };
}

// ── Helpers ──
function speciesToString(species) {
  return species.map(s => {
    const coeff = s.coeff > 1 ? s.coeff : '';
    const charge = s.charge ? formatCharge(s.charge) : '';
    return `${coeff}${s.formula}${charge ? `^${charge}` : ''}`;
  }).join(' + ');
}

function countAtoms(species) {
  const total = {};
  for (const s of species) {
    let atoms = {};
    try { atoms = parseFormula(s.formula); } catch(e) {}
    for (const [el, cnt] of Object.entries(atoms)) {
      total[el] = (total[el] || 0) + cnt * s.coeff;
    }
  }
  return total;
}

function scaleSpecies(species, factor) {
  return species.map(s => ({ ...s, coeff: s.coeff * factor }));
}

function calcCharge(species) {
  return species.reduce((sum, s) => sum + (s.charge || 0) * s.coeff, 0);
}

function formatCharge(n) {
  if (n === 0) return '';
  const abs = Math.abs(n);
  const sign = n > 0 ? '+' : '−';
  return abs === 1 ? sign : `${abs}${sign}`;
}

function fmtCharge(n) {
  if (n === 0) return '0';
  return n > 0 ? `+${n}` : `${n}`;
}

// ═══════════════════════════════════════════════════════════════
// MASTER REDOX SOLVER
// Takes raw molecular equation string + medium
// Returns full step-by-step solution object
// ═══════════════════════════════════════════════════════════════
function solveRedox(raw, medium) {
  // 1. Parse molecular equation
  const molecular = parseMolecularEquation(raw);

  // 2. Build net ionic
  const { netR, netP, spectatorList, expandedR, expandedP } = buildNetIonic(
    molecular.reactants, molecular.products
  );

  // 3. Identify redox changes
  const changes = identifyRedoxChanges(netR, netP);
  if (changes.length === 0) throw new Error('No oxidation state changes detected. This may not be a redox reaction, or state symbols may be missing.');

  const oxidationChange = changes.find(c => c.type === 'oxidation');
  const reductionChange = changes.find(c => c.type === 'reduction');
  if (!oxidationChange) throw new Error('Could not identify the oxidation half-reaction.');
  if (!reductionChange) throw new Error('Could not identify the reduction half-reaction.');

  // 4. Build half-reactions from net ionic species
  // Oxidation: species containing the oxidized element
  const oxReactant = netR.filter(s => s.formula === oxidationChange.reactantFormula);
  const oxProduct  = netP.filter(s => s.formula === oxidationChange.productFormula);
  const redReactant= netR.filter(s => s.formula === reductionChange.reactantFormula);
  const redProduct = netP.filter(s => s.formula === reductionChange.productFormula);

  // Ensure we have at least one species on each side
  if (!oxReactant.length || !oxProduct.length) throw new Error('Could not isolate oxidation half-reaction species.');
  if (!redReactant.length|| !redProduct.length) throw new Error('Could not isolate reduction half-reaction species.');

  // Convert to { formula, charge, coeff:1 } objects
  const toHRSpecies = arr => arr.map(s => ({
    formula: s.formula,
    charge: s.charge || 0,
    coeff: 1
  }));

  // 5. Balance each half-reaction
  const oxHR  = buildHalfReaction(toHRSpecies(oxReactant),  toHRSpecies(oxProduct),  medium);
  const redHR = buildHalfReaction(toHRSpecies(redReactant), toHRSpecies(redProduct), medium);

  // 6. Equalize electrons
  const oxE  = oxHR.electrons  || 1;
  const redE = redHR.electrons || 1;
  const lcmE = lcm(oxE, redE);
  const oxMul  = lcmE / oxE;
  const redMul = lcmE / redE;

  // 7. Get oxidation numbers for all changing species for display
  const oxNumbers = {
    reactant: assignOxidationNumbers(oxidationChange.reactantFormula, oxidationChange.reactantCharge || 0),
    product:  assignOxidationNumbers(oxidationChange.productFormula,  oxidationChange.productCharge  || 0),
  };
  const redNumbers = {
    reactant: assignOxidationNumbers(reductionChange.reactantFormula, reductionChange.reactantCharge || 0),
    product:  assignOxidationNumbers(reductionChange.productFormula,  reductionChange.productCharge  || 0),
  };

  return {
    molecular,
    netR, netP,
    spectatorList,
    expandedR, expandedP,
    changes,
    oxidationChange, reductionChange,
    oxHR, redHR,
    lcmE, oxMul, redMul,
    oxNumbers, redNumbers,
    medium,
  };
}
