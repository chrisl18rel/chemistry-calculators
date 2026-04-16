// app.js

// ── TAB SWITCHING ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
  });
});

// ── SHARED ALERT ──
function showAlert(msg, isError = false) {
  document.querySelectorAll('.styled-alert').forEach(e => e.remove());
  const el = document.createElement('div');
  el.className = 'styled-alert' + (isError ? ' error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

// ── SHARED HTML INJECTION ──
// Each module calls loadTemplate(containerId, htmlString) on init
function loadTemplate(containerId, html) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = html;
}

// ── NUMBER FORMATTING ──
function fmtNum(n, decimals = 4) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const v = parseFloat(n);
  if (Math.abs(v) >= 1e6 || (Math.abs(v) < 0.001 && v !== 0)) {
    return v.toExponential(3);
  }
  return parseFloat(v.toFixed(decimals)).toString();
}

// Round to significant figures
function toSigFigs(n, sig = 4) {
  if (n === 0) return '0';
  const d = Math.ceil(Math.log10(Math.abs(n)));
  const power = sig - d;
  const magnitude = Math.pow(10, power);
  return (Math.round(n * magnitude) / magnitude).toString();
}

// ── SUBSCRIPT RENDERING ──
// Convert formula string to HTML with subscripts
// e.g. "H2O" → "H<sub>2</sub>O", "H₂O" → "H<sub>2</sub>O"
function formulaToHTML(formula) {
  if (!formula) return '';
  // First convert unicode subscripts to plain digits
  const subMap = { '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9' };
  let s = formula.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, c => subMap[c] || c);
  // Then wrap plain digits in subscript tags
  s = s.replace(/(\d+)/g, '<sub>$1</sub>');
  return s;
}

// ── GCD / LCM ──
function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
function lcm(a, b) { return (a * b) / gcd(a, b); }

// ── FRACTION REDUCTION ──
function reduceFraction(num, den) {
  const g = gcd(Math.abs(num), Math.abs(den));
  return [num / g, den / g];
}
