'use strict';
/* Form "Tandai selesai" (dialog setelah timer selesai): wiring, dan logika simpan
   dengan DOM tiruan (tanpa Electron). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const core = read('renderer', 'core.js');
const index = read('index.html');

test('dialog setelah timer: "Tandai selesai" menggantikan "Kembali ke tugas"', () => {
  assert.doesNotMatch(core, /Kembali ke tugas/);
  assert.match(core, /label: 'Tandai selesai'/);
  assert.match(core, /JF\.completion\.open\(t, s,/);
  assert.match(core, /onCancel: function \(\) \{ showCompletionChoices\(s, t\); \}/);
  assert.match(core, /label: 'Istirahat'/);
  assert.match(core, /label: 'Lanjut fokus'/);
});

test('completion.js dimuat setelah documents.js dan sebelum halaman', () => {
  const i = index.indexOf('renderer/completion.js');
  assert.ok(i > index.indexOf('renderer/documents.js'));
  assert.ok(i < index.indexOf('renderer/pages/beranda.js'));
});

/* ── DOM tiruan minimal ── */
function fakeNode(tag) {
  const n = { tag, children: [], style: {}, value: '', classList: { add() {} }, listeners: {},
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(k, fn) { this.listeners[k] = fn; }, setAttribute() {}, textContent: '' };
  return n;
}
function setup(opts) {
  opts = opts || {};
  const lib = require('../shared/library.js');
  const state = { tasks: [{ id: 't1', title: 'Tulis laporan', requiresOutput: !!opts.requiresOutput }], goals: [], library: [], events: [] };
  const calls = { completed: [], saved: 0, modal: null, toasts: [], removed: [] };
  const JF = { library: lib };
  JF.ui = {
    el(spec, attrs) {
      const n = fakeNode(spec);
      let start = 1;
      if (attrs && typeof attrs === 'object' && !attrs.tag) { n.attrs = attrs; start = 2; }
      for (let i = start; i < arguments.length; i++) if (arguments[i] && typeof arguments[i] === 'object') n.children.push(arguments[i]);
      return n;
    },
    btn(label, fn) { const n = fakeNode('button'); n.label = label; n.onclick = fn; return n; },
    clear(n) { n.children = []; return n; },
    modal(o) { calls.modal = o; return { close() {} }; },
    toast(m) { calls.toasts.push(m); },
    fmt: { dur: (s) => s + 's' }
  };
  JF.app = {
    rawState: () => state, save() { calls.saved++; },
    completeTask(id) { calls.completed.push(id); return true; }
  };
  JF.documents = {
    fmtSize: (n) => n + ' B', message: (r) => r,
    attachToTask: () => Promise.resolve(opts.pick || { canceled: true, added: [], linked: [], failed: [] }),
    removeDocument(it) { calls.removed.push(['doc', it.id]); return Promise.resolve({ ok: true }); },
    removeFromTask(it) { calls.removed.push(['detach', it.id]); return Promise.resolve({ ok: true }); }
  };
  global.self = global; // modul memakai `self`
  global.window = undefined;
  const code = read('renderer', 'completion.js');
  new Function('root', code.replace('})(typeof self !== \'undefined\' ? self : this);', '})(root);'))({ JF });
  return { JF, state, calls };
}
const task = (s) => s.state.tasks[0];

test('simpan: ringkasan jadi catatan Library, tautan tersimpan, lalu tugas diselesaikan', () => {
  const s = setup();
  s.JF.completion.open(task(s), { plannedSec: 1500 }, {});
  const m = s.calls.modal;
  assert.strictEqual(m.title, 'Tandai selesai');
  assert.strictEqual(m.dismiss, false);
  assert.deepStrictEqual(m.actions.map((a) => a.label), ['Batal', 'Simpan dan tandai selesai']);
  // isi ringkasan lewat textarea (oninput)
  const find = (n, pred) => { if (pred(n)) return n; for (const c of n.children || []) { const r = find(c, pred); if (r) return r; } return null; };
  const wrap = { children: m.body };
  const ta = find(wrap, (n) => n.attrs && n.attrs.oninput && n.attrs.rows);
  ta.attrs.oninput({ target: { value: 'Selesai bab 1 dan 2' } });
  const urlInput = find(wrap, (n) => n.attrs && n.attrs.type === 'url');
  urlInput.value = 'https://contoh.id/dok';
  const addBtn = find(wrap, (n) => n.label === 'Tambah tautan');
  addBtn.onclick();
  const res = m.actions[1].onClick();
  assert.notStrictEqual(res, false);
  const lib = s.state.library;
  const note = lib.find((i) => i.type === 'note');
  const link = lib.find((i) => i.type === 'link');
  assert.strictEqual(note.noteText, 'Selesai bab 1 dan 2');
  assert.deepStrictEqual(note.taskIds, ['t1']);
  assert.strictEqual(note.source.module, 'tugas');
  assert.strictEqual(link.url, 'https://contoh.id/dok');
  assert.deepStrictEqual(link.taskIds, ['t1']);
  assert.deepStrictEqual(s.calls.completed, ['t1']);
  assert.ok(s.calls.saved >= 1);
});

test('simpan tanpa isian tetap menandai selesai dan tidak membuat dokumen kosong', () => {
  const s = setup();
  s.JF.completion.open(task(s), null, {});
  s.calls.modal.actions[1].onClick();
  assert.strictEqual(s.state.library.length, 0);
  assert.deepStrictEqual(s.calls.completed, ['t1']);
});

test('tautan tidak valid ditolak dan tidak ikut tersimpan', () => {
  const s = setup();
  s.JF.completion.open(task(s), null, {});
  const m = s.calls.modal;
  const find = (n, pred) => { if (pred(n)) return n; for (const c of n.children || []) { const r = find(c, pred); if (r) return r; } return null; };
  const wrap = { children: m.body };
  find(wrap, (n) => n.attrs && n.attrs.type === 'url').value = 'bukan url';
  find(wrap, (n) => n.label === 'Tambah tautan').onclick();
  assert.ok(s.calls.toasts.some((t) => /tidak valid/.test(t)));
  m.actions[1].onClick();
  assert.strictEqual(s.state.library.filter((i) => i.type === 'link').length, 0);
});

test('batal: file yang baru dilampirkan dibatalkan dan pilihan langkah dibuka lagi', async () => {
  const fresh = { id: 'lib_a', title: 'a.pdf', fileName: 'x.pdf', size: 10, type: 'file', taskIds: ['t1'] };
  const s = setup({ pick: { canceled: false, added: [fresh], linked: [], failed: [] } });
  let cancelled = 0;
  s.JF.completion.open(task(s), null, { onCancel: () => { cancelled++; } });
  const m = s.calls.modal;
  const find = (n, pred) => { if (pred(n)) return n; for (const c of n.children || []) { const r = find(c, pred); if (r) return r; } return null; };
  await find({ children: m.body }, (n) => n.label === 'Lampirkan file').onclick();
  await new Promise((r) => setTimeout(r, 5));
  m.actions[0].onClick();
  await new Promise((r) => setTimeout(r, 5));
  assert.deepStrictEqual(s.calls.removed, [['doc', 'lib_a']]);
  assert.strictEqual(cancelled, 1);
  assert.deepStrictEqual(s.calls.completed, []);
});

test('file yang sudah terlampir sebelumnya tidak ikut dilepas saat batal', async () => {
  const lib = require('../shared/library.js');
  const existing = { id: 'lib_old', title: 'lama.pdf', fileName: 'old.pdf', size: 5, type: 'file', taskIds: ['t1'] };
  const s = setup({ pick: { canceled: false, added: [], linked: [existing], failed: [] } });
  s.state.library.push(lib.createItem({ id: 'lib_old', type: 'file', title: 'lama.pdf', fileName: 'old.pdf', taskIds: ['t1'], source: { module: 'goals', entityId: 't1' } }, 1));
  s.JF.completion.open(task(s), null, {});
  const m = s.calls.modal;
  const find = (n, pred) => { if (pred(n)) return n; for (const c of n.children || []) { const r = find(c, pred); if (r) return r; } return null; };
  await find({ children: m.body }, (n) => n.label === 'Lampirkan file').onclick();
  await new Promise((r) => setTimeout(r, 5));
  m.actions[0].onClick();
  await new Promise((r) => setTimeout(r, 5));
  assert.deepStrictEqual(s.calls.removed, []);
});
