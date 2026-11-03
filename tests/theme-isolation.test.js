'use strict';
/* Original vs Capybara World CSS isolation.
   Bug guarded here: #modalRoot and #toastRoot are shared singletons, but the
   Capybara stylesheet styled them unscoped. In the Original theme the --cw-*
   tokens are undefined, so `background: var(--cw-card)` became invalid and the
   dialog rendered transparent. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const capyDir = path.join(root, 'renderer', 'experiences', 'capybara-world');

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Collect every rule selector (including rules nested in @media). */
function ruleSelectors(css) {
  const out = [];
  const stack = [];
  let prelude = '';
  for (const ch of stripComments(css)) {
    if (ch === '{') {
      stack.push(prelude.trim());
      prelude = '';
    } else if (ch === '}') {
      const sel = stack.pop();
      if (sel && !sel.startsWith('@') && !sel.startsWith('/*')) out.push(sel);
      prelude = '';
    } else if (stack.length === 0 || !prelude.trim().startsWith('@')) {
      prelude += ch;
    } else {
      prelude += ch;
    }
  }
  return out;
}

const SHARED = /(^|,)\s*(#modalRoot|#toastRoot|body|html|button|input|select|textarea|\.btn|\.card|\.modal|\.toast|\.nav|\.sidebar|\.app)\b/;

test('Capybara World never styles shared Original singletons (#modalRoot/#toastRoot)', () => {
  const files = fs.readdirSync(capyDir).filter((f) => f.endsWith('.css'));
  assert.ok(files.length > 0, 'capybara stylesheets should exist');

  for (const file of files) {
    const css = fs.readFileSync(path.join(capyDir, file), 'utf8');
    for (const selector of ruleSelectors(css)) {
      for (const one of selector.split(',').map((s) => s.trim()).filter(Boolean)) {
        if (!(/#modalRoot|#toastRoot/.test(one))) continue;
        assert.match(
          one,
          /\[data-experience="capybara-world"\]/,
          file + ': selector must be scoped to Capybara World:\n  ' + one
        );
      }
    }
  }
});

test('Capybara World does not restyle generic Original components unscoped', () => {
  const files = fs.readdirSync(capyDir).filter((f) => f.endsWith('.css'));
  let checked = 0;

  for (const file of files) {
    const css = fs.readFileSync(path.join(capyDir, file), 'utf8');
    for (const selector of ruleSelectors(css)) {
      for (const one of selector.split(',').map((s) => s.trim()).filter(Boolean)) {
        if (!SHARED.test(one)) continue;
        checked++;
        assert.match(
          one,
          /\[data-experience="capybara-world"\]|\.capybara-world-active|\.capy-home|\.cw-|\.cr-/,
          file + ': global selector must be experience-scoped:\n  ' + one
        );
      }
    }
  }
  // Sanity: the scan really found the modal/toast rules it is supposed to guard.
  assert.ok(checked > 0, 'expected to inspect shared-component selectors');
});

test('Original theme keeps solid modal, veil and toast backgrounds', () => {
  const theme = fs.readFileSync(path.join(root, 'renderer', 'theme.css'), 'utf8');
  const modal = theme.match(/\.modal\s*\{([^}]*)\}/);
  assert.ok(modal, '.modal base rule must exist');
  assert.match(modal[1], /background:\s*var\(--surface\)/, '.modal must use the solid --surface token');
  assert.match(modal[1], /border:\s*1px solid var\(--line\)/);

  const veil = theme.match(/\.modal-veil\s*\{([^}]*)\}/);
  assert.ok(veil, '.modal-veil base rule must exist');
  assert.match(veil[1], /background:\s*var\(--veil\)/);

  const toast = theme.match(/\.toast\s*\{([^}]*)\}/);
  assert.ok(toast, '.toast base rule must exist');
  assert.match(toast[1], /background:\s*var\(--surface\)/);
});

test('Capybara World still styles its own dialogs after the isolation fix', () => {
  const css = fs.readFileSync(path.join(capyDir, 'experience.css'), 'utf8');
  assert.match(css, /\[data-experience="capybara-world"\]\s+#modalRoot\s+\.modal\s*\{[^}]*background:\s*var\(--cw-card\)/);
  assert.match(css, /\[data-experience="capybara-world"\]\s+#modalRoot\s+\.btn\.primary\s*\{[^}]*background:\s*var\(--cw-accent\)/);
  assert.match(css, /\[data-experience="capybara-world"\]\s+#toastRoot\s+\.toast\s*\{[^}]*background:\s*var\(--cw-card\)/);
});
