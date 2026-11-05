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
  assert.match(core, /onCancel: function \(\) \{ showCompletionChoices\(s, t, copts\); \}/);
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
    findTask: (id) => state.tasks.find((t) => t.id === id) || null,
    currentSession: () => null, emit() { calls.emits = (calls.emits || 0) + 1; },
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


const find = (n, pred) => { if (pred(n)) return n; for (const c of n.children || []) { const r = find(c, pred); if (r) return r; } return null; };

test('forTask membaca ringkasan terbaru, tautan, dan file milik tugas', () => {
  const s = setup();
  const lib = require('../shared/library.js');
  s.state.library.push(
    lib.createItem({ type: 'note', title: 'Ringkasan: a', noteText: 'lama', taskIds: ['t1'], source: { module: 'tugas', entityId: 't1' } }, 1),
    lib.createItem({ type: 'note', title: 'Ringkasan: a', noteText: 'baru', taskIds: ['t1'], source: { module: 'tugas', entityId: 't1' } }, 5),
    lib.createItem({ type: 'link', url: 'https://a.id', taskIds: ['t1'] }, 2),
    lib.createItem({ type: 'link', url: 'https://b.id', taskIds: ['lain'] }, 2),
    lib.createItem({ type: 'file', title: 'f.pdf', fileName: 'f.pdf', taskIds: ['t1'] }, 3)
  );
  const info = s.JF.completion.forTask('t1');
  assert.strictEqual(info.summary.noteText, 'baru');
  assert.strictEqual(info.links.length, 1);
  assert.strictEqual(info.files.length, 1);
  assert.strictEqual(info.count, 2);
  assert.strictEqual(info.any, true);
  assert.strictEqual(s.JF.completion.forTask('kosong').any, false);
});

test('mode ubah: memperbarui ringkasan yang ada, tidak menggandakan, tidak menyelesaikan tugas', () => {
  const s = setup();
  const lib = require('../shared/library.js');
  s.state.tasks[0].done = true;
  s.state.library.push(lib.createItem({ type: 'note', title: 'Ringkasan: Tulis laporan', noteText: 'awal', taskIds: ['t1'], source: { module: 'tugas', entityId: 't1' } }, 1));
  s.JF.completion.open(task(s), null, { mode: 'edit' });
  const m = s.calls.modal;
  assert.strictEqual(m.title, 'Ringkasan tugas');
  assert.deepStrictEqual(m.actions.map((a) => a.label), ['Batal', 'Simpan']);
  const ta = find({ children: m.body }, (n) => n.attrs && n.attrs.oninput && n.attrs.rows);
  ta.attrs.oninput({ target: { value: 'sudah direvisi' } });
  m.actions[1].onClick();
  const notes = s.state.library.filter((i) => i.type === 'note');
  assert.strictEqual(notes.length, 1);
  assert.strictEqual(notes[0].noteText, 'sudah direvisi');
  assert.deepStrictEqual(s.calls.completed, []);
});

test('mode ubah: mengosongkan ringkasan menghapus catatan itu', () => {
  const s = setup();
  const lib = require('../shared/library.js');
  s.state.tasks[0].done = true;
  s.state.library.push(lib.createItem({ type: 'note', title: 'x', noteText: 'awal', taskIds: ['t1'], source: { module: 'tugas', entityId: 't1' } }, 1));
  s.JF.completion.open(task(s), null, { mode: 'edit' });
  const ta = find({ children: s.calls.modal.body }, (n) => n.attrs && n.attrs.oninput && n.attrs.rows);
  ta.attrs.oninput({ target: { value: '   ' } });
  s.calls.modal.actions[1].onClick();
  assert.strictEqual(s.state.library.filter((i) => i.type === 'note').length, 0);
});

test('start hanya untuk tugas aktif; summaryBlock hanya untuk tugas selesai', () => {
  const s = setup();
  assert.strictEqual(s.JF.completion.start('t1'), true);
  assert.strictEqual(s.calls.modal.title, 'Tandai selesai');
  assert.strictEqual(s.JF.completion.start('tidak-ada'), false);
  assert.strictEqual(s.JF.completion.summaryBlock(task(s)), null);
  task(s).done = true;
  assert.strictEqual(s.JF.completion.start('t1'), false);
  assert.ok(s.JF.completion.summaryBlock(task(s)));
  assert.strictEqual(s.JF.completion.chip('t1'), null);
});

test('reportSection hanya muncul bila ada ringkasan atau lampiran pada tugas selesai', () => {
  const s = setup();
  const lib = require('../shared/library.js');
  assert.strictEqual(s.JF.completion.reportSection(['t1']), null);
  task(s).done = true;
  assert.strictEqual(s.JF.completion.reportSection(['t1']), null);
  s.state.library.push(lib.createItem({ type: 'link', url: 'https://a.id', taskIds: ['t1'] }, 1));
  assert.ok(s.JF.completion.reportSection(['t1']));
});

test('tombol "Selesai + ringkasan" ada di Tugas, Beranda, dan Capybara; ringkasan tampil di Riwayat dan Laporan', () => {
  assert.match(read('renderer', 'pages', 'tugas.js'), /Selesai \+ ringkasan[\s\S]*JF\.completion\.start\(t\.id\)/);
  assert.match(read('renderer', 'pages', 'tugas.js'), /JF\.completion\.summaryBlock\(t\)/);
  const ber = read('renderer', 'pages', 'beranda.js');
  assert.strictEqual((ber.match(/Selesai \+ ringkasan/g) || []).length, 3);
  assert.match(read('renderer', 'pages', 'riwayat.js'), /JF\.completion\.chip\(s\.taskId\)/);
  const lap = read('renderer', 'pages', 'laporan.js');
  assert.match(lap, /detailBlock\(snap\.completedTaskIds, snap\.unfinishedTaskIds, state\)/);
  assert.match(lap, /detailBlock\(todayDone, \[\], todayState\)/);
  assert.match(lap, /JF\.completion\.summaryBlock\(t\)/);
  assert.match(read('renderer', 'experiences', 'capybara-world', 'pages.js'), /Selesai \+ ringkasan/);
  assert.match(read('renderer', 'experiences', 'capybara-world', 'beranda.js'), /Selesai \+ ringkasan/);
});

test('tautan http(s) dibuka lewat browser bawaan, bukan jendela baru', () => {
  const main = read('main.js');
  assert.match(main, /shell\.openExternal/);
  assert.match(main, /action: 'deny'/);
});

test('Tugas (Original): tidak ada centang cepat; selesai hanya lewat "Selesai + ringkasan"', () => {
  const js = read('renderer', 'pages', 'tugas.js');
  assert.doesNotMatch(js, /button\.tick/);
  assert.doesNotMatch(js, /app\.completeTask\(/);
  assert.match(js, /Selesai \+ ringkasan/);
  assert.match(js, /span\.done-mark/);                 // tanda status tugas selesai (bukan tombol)
  assert.match(js, /app\.reopenTask\(t\.id\)/);        // mengembalikan lewat tombol Urungkan
  const css = read('renderer', 'theme.css');
  assert.doesNotMatch(css, /\.task-row \.tick/);
  assert.match(css, /\.task-row \.done-mark/);
});

test('Laporan harian: kartu ringkas dengan "Lihat selengkapnya" / "Tutup" dan panah', () => {
  const lap = read('renderer', 'pages', 'laporan.js');
  assert.match(lap, /'Lihat selengkapnya'/);
  assert.match(lap, /'Tutup'/);
  assert.match(lap, /aria-expanded/);
  assert.match(lap, /M6 9l6 6 6-6/);        // panah bawah (buka)
  assert.match(lap, /M6 15l6-6 6 6/);       // panah atas (tutup)
  assert.match(lap, /var openCards = \{\}/);  // status buka/tutup bertahan antar render
  assert.match(lap, /detail\.style\.display = isOpen \? '' : 'none'/);
  const css = read('renderer', 'theme.css');
  assert.match(css, /\.report \.rep-toggle/);
  assert.match(css, /\.report \.rep-detail/);
});

test('jalur selesai seragam: Kalender dan Goals membuka form "Selesai + ringkasan"', () => {
  const kal = read('renderer', 'pages', 'kalender.js');
  assert.doesNotMatch(kal, /app\.completeTask\(/);
  assert.match(kal, /'Selesai \+ ringkasan', function \(\) \{ JF\.completion\.start\(t\.id\); \}/);
  const gl = read('renderer', 'pages', 'goals.js');
  assert.doesNotMatch(gl, /app\.completeTask\(/);
  assert.match(gl, /t\.done \? app\.reopenTask\(t\.id\) : JF\.completion\.start\(t\.id\)/);
});

test('jendela mini: tombol ikon "Lanjut fokus" memakai slot tombol yang ada, ukuran jendela tetap', () => {
  const mini = read('mini.html');
  assert.match(mini, /#pill\{[^}]*width:280px;height:88px/);          // ukuran pill tidak berubah
  assert.match(read('main.js'), /const w = 296, h = 104;/);           // ukuran jendela tidak berubah
  assert.match(mini, /var CONT=/);
  assert.match(mini, /window\.mini\.cmd\(st\.mode==="idle"&&st\.canContinue\?"continue":"toggle"\)/);
  assert.match(mini, /"Lanjut fokus"/);
  assert.match(mini, /#pp\.cont\{/);
  assert.match(mini, /<button id="pp"[^>]*hidden>/);                  // tombol yang sama, tersembunyi saat tidak dipakai
  assert.strictEqual((mini.match(/<button /g) || []).length, 2);      // tidak ada tombol tambahan
  assert.match(read('main.js'), /c === 'toggle' \|\| c === 'continue'/);
});

test('inti: Lanjut fokus dari mini hanya aktif selama dialog sesi selesai terbuka', () => {
  const core = read('renderer', 'core.js');
  assert.match(core, /var completionDialog = null, completionCtx = null;/);
  assert.match(core, /canContinue: true/);
  assert.match(core, /app\.continueFocus = function/);
  assert.match(core, /if \(c === 'continue'\) \{ app\.continueFocus\(\); return; \}/);
  assert.match(core, /closeCompletionDialog\(\);   \/\/ memulai fokus dari mana pun/);
  assert.match(core, /onClose: function \(\) \{ completionDialog = null; completionCtx = null;/);
});
