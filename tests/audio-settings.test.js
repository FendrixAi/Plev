'use strict';
/* Regresi audio: mode beep/lagu/tanpa suara eksplisit, tanpa fallback beep
   saat pengguna memilih sunyi. Audibilitas aktual tetap perlu dicek manual. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const core = fs.readFileSync(path.join(root, 'renderer', 'core.js'), 'utf8');
const set = fs.readFileSync(path.join(root, 'renderer', 'pages', 'pengaturan.js'), 'utf8');

test('mode audio per kanal tersimpan dan dimigrasikan tanpa merusak data lama', () => {
  assert.match(core, /focusMode: 'beep', breakMode: 'beep'/);
  assert.match(core, /jamfokus\.audio\.foc/);
  assert.match(core, /jamfokus\.audio\.rst/);
  assert.match(core, /stored === 'none' \? 'none' : stored === 'beep' \? 'beep' : \(hasBlob \? 'custom' : 'beep'\)/);
  assert.match(core, /idbGet\('cur'/);
  assert.match(core, /initAudioMode\('foc', true\)/);
});

test('mode Tanpa suara tidak pernah jatuh ke beep', () => {
  assert.match(core, /function alarmFocus\(\)[\s\S]*?if \(music\.focusMode === 'none'\) return;/);
  assert.match(core, /function alarmBreak\(\)[\s\S]*?if \(music\.breakMode === 'none'\) return;/);
  assert.match(core, /music\.testFocus = function \(\) \{\s*if \(music\.focusMode === 'none'\) return false;/);
  assert.match(core, /music\.testBreak = function \(\) \{\s*if \(music\.breakMode === 'none'\) return false;/);
  const silence = core.slice(core.indexOf('music.silenceFocus'), core.indexOf('music.testFocus'));
  assert.doesNotMatch(silence, /beep\(/);
});

test('UI menjelaskan kapan suara berbunyi dan menyediakan kontrol eksplisit', () => {
  assert.match(set, /'Suara penyelesaian'/);
  assert.match(set, /'Tanpa suara'/);
  assert.match(set, /'Pakai beep'/);
  assert.match(set, /Hanya berbunyi saat sesi atau istirahat selesai/);
  assert.match(set, /Tidak ada musik latar selama sesi fokus/);
  assert.match(set, /app\.music\.testFocus\(\)/);
  assert.match(set, /app\.music\.testBreak\(\)/);
});

test('peringatan 8 detik tetap terpisah dari suara penyelesaian', () => {
  assert.match(core, /settings\.warn8 && !warn8Fired/);
  assert.match(core, /beepWarn\(\)/);
  assert.doesNotMatch(core, /warn8[^\n]*focusMode|focusMode[^\n]*warn8/);
  assert.match(set, /Peringatan 8 detik/);
  assert.match(set, /tetap berbunyi meskipun suara penyelesaian dimatikan/);
});
