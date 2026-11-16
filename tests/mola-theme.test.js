'use strict';
/* Regresi F-04: Mola World memaksa mode terang saat aktif, tetapi harus
   memulihkan pilihan tema pengguna ketika pengguna pindah experience. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const themeSrc = fs.readFileSync(path.join(root, 'renderer', 'theme.js'), 'utf8');
const molaSrc = fs.readFileSync(path.join(root, 'renderer', 'experiences', 'mola-world', 'experience.js'), 'utf8');

function setup(storedTheme) {
  const attrs = { 'data-experience': 'mola-world', 'data-theme': 'light' };
  const app = { classList: { add() {}, remove() {} } };
  const toggle = {
    attrs: {},
    setAttribute(name, value) { this.attrs[name] = value; }
  };
  const document = {
    documentElement: {
      getAttribute(name) { return attrs[name] == null ? null : attrs[name]; },
      setAttribute(name, value) { attrs[name] = value; }
    },
    getElementById(id) {
      if (id === 'app') return app;
      if (id === 'themeToggle') return toggle;
      return null;
    },
    addEventListener() {}
  };
  const sandbox = {
    document,
    localStorage: {
      getItem(key) { return key === 'jamfokus.theme' ? storedTheme : null; },
      setItem() {}
    },
    matchMedia() { return { matches: false, addEventListener() {} }; },
    setTimeout,
    clearTimeout,
    console
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(themeSrc, sandbox, { filename: 'renderer/theme.js' });
  vm.runInContext(molaSrc, sandbox, { filename: 'renderer/experiences/mola-world/experience.js' });
  return { sandbox, attrs, toggle };
}

test('F-04: keluar dari Mola memulihkan tema gelap dan status toggle', () => {
  const { sandbox, attrs, toggle } = setup('dark');
  assert.strictEqual(attrs['data-theme'], 'light', 'Mola aktif harus tetap terang');

  sandbox.JF.experiences.molaWorld.setActive(false);

  assert.strictEqual(attrs['data-experience'], 'original');
  assert.strictEqual(attrs['data-theme'], 'dark');
  assert.strictEqual(toggle.attrs['aria-pressed'], 'true');
});

test('F-04: keluar dari Mola tidak menimpa experience lain yang sudah aktif', () => {
  const { sandbox, attrs } = setup('dark');
  attrs['data-experience'] = 'capybara-world';

  sandbox.JF.experiences.molaWorld.setActive(false);

  assert.strictEqual(attrs['data-experience'], 'capybara-world');
  assert.strictEqual(attrs['data-theme'], 'dark');
});
