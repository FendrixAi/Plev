'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const model = require(path.join(root, 'shared', 'model.js'));
const store = require(path.join(root, 'shared', 'store.js'));
const goals = require(path.join(root, 'shared', 'goals.js'));
const library = require(path.join(root, 'shared', 'library.js'));
const { createLibraryService } = require(path.join(root, 'library-service.js'));

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

/* A state with one goal -> milestone -> task, built through the real modules. */
function fixture() {
  const s = store.createState();
  const task = model.newTask({ title: 'Competitor Analysis', targetDate: '2026-11-01' }, 1000);
  s.tasks.push(task);
  const g = goals.createGoal(s, { title: 'Leviant' }, 1000).goal;
  const m = goals.addMilestone(s, g.id, { title: 'Market Validation' }, 1000).milestone;
  assert.equal(goals.linkTask(s, g.id, task.id, m.id, 1000).ok, true);
  return { s, task, g, m };
}
const file = (n, h) => ({ fileName: 'libfile_' + n + '_Analysis.xlsx', originalName: 'Analysis.xlsx', size: 10, contentHash: h });

/* 1-2. Attaching from a Goal task registers it automatically with inherited context */
test('attachment from a goal task is registered in Library with Goal/Milestone/Task context', () => {
  const { s, task, g, m } = fixture();
  const r = library.registerFile(s, Object.assign(file('1', HASH_A), { source: { module: 'goals', entityId: task.id }, taskId: task.id }), 2000);
  assert.equal(r.ok, true);
  const it = r.item;
  assert.deepEqual(it.taskIds, [task.id]);
  assert.deepEqual(it.goalIds, [g.id]);
  assert.deepEqual(it.milestoneRefs, [{ goalId: g.id, milestoneId: m.id }]);
  assert.equal(it.source.module, 'goals');
  assert.equal(it.createdAt, 2000);
  assert.deepEqual(library.attachmentsForTask(s, task.id).map((x) => x.id), [it.id]);
  const paths = library.contextPaths(s, it);
  assert.equal(paths.length, 1);
  assert.equal(paths[0].label, 'Leviant → Market Validation → Competitor Analysis');
});

test('context is derived live: moving the task updates the path without touching the document', () => {
  const { s, task, g } = fixture();
  const it = library.registerFile(s, Object.assign(file('1', HASH_A), { source: { module: 'goals', entityId: task.id }, taskId: task.id }), 2000).item;
  const m2 = goals.addMilestone(s, g.id, { title: 'Launch' }, 1500).milestone;
  goals.linkTask(s, g.id, task.id, m2.id, 3000);
  assert.equal(library.contextPaths(s, it)[0].label, 'Leviant → Launch → Competitor Analysis');
});

/* 3. Direct import without a goal */
test('direct Library import works without a Goal or Task', () => {
  const s = store.createState();
  const r = library.registerFile(s, Object.assign(file('9', HASH_B), { source: { module: 'library' } }), 5);
  assert.equal(r.ok, true);
  assert.deepEqual(r.item.taskIds, []);
  assert.deepEqual(library.contextPaths(s, r.item), []);
  assert.equal(library.query(s, { context: 'standalone' }).length, 1);
});

/* 4-5. Multiple attachments, no duplicate records */
test('multiple attachments register separately; identical content is never duplicated', () => {
  const { s, task } = fixture();
  const reg = (n, h) => library.registerFile(s, Object.assign(file(n, h), { source: { module: 'goals', entityId: task.id }, taskId: task.id }), 10);
  reg('1', HASH_A); reg('2', HASH_B);
  assert.equal(library.attachmentsForTask(s, task.id).length, 2);
  const again = reg('3', HASH_A);                 // same bytes, different managed name
  assert.equal(again.existing, true);
  assert.equal(s.library.length, 2);
  const same = reg('1', HASH_A);                  // same managed file re-registered
  assert.equal(same.existing, true);
  assert.equal(s.library.length, 2);
});

test('the same file attached to a second task is linked, not copied', () => {
  const { s, task } = fixture();
  const t2 = model.newTask({ title: 'Second', targetDate: '2026-11-02' }, 1000);
  s.tasks.push(t2);
  library.registerFile(s, Object.assign(file('1', HASH_A), { source: { module: 'goals', entityId: task.id }, taskId: task.id }), 10);
  const r = library.registerFile(s, Object.assign(file('7', HASH_A), { source: { module: 'goals', entityId: t2.id }, taskId: t2.id }), 11);
  assert.equal(s.library.length, 1);
  assert.deepEqual(r.item.taskIds.sort(), [task.id, t2.id].sort());
  // detaching from one task keeps the document for the other
  const d = library.detachFromTask(s, r.item.id, task.id, 12);
  assert.equal(d.removed, false);
  assert.equal(s.library.length, 1);
  // detaching the last task removes it only when that task was the original source
  const d2 = library.detachFromTask(s, r.item.id, t2.id, 13);
  assert.equal(d2.removed, false);   // origin was `task`, so a doc created by it stays reachable
});

test('detaching a task-owned document removes it and reports the orphan file', () => {
  const { s, task } = fixture();
  const it = library.registerFile(s, Object.assign(file('1', HASH_A), { source: { module: 'goals', entityId: task.id }, taskId: task.id }), 10).item;
  const d = library.detachFromTask(s, it.id, task.id, 11);
  assert.equal(d.removed, true);
  assert.equal(d.orphanFile, it.fileName);
  assert.equal(s.library.length, 0);
});

test('a managed file shared by two records is not reported orphan until the last one goes', () => {
  const s = store.createState();
  const a = library.createItem({ type: 'file', title: 'A', fileName: 'shared.pdf' }, 1);
  const b = library.createItem({ type: 'file', title: 'B', fileName: 'shared.pdf' }, 2);
  s.library.push(a, b);
  assert.equal(library.removeDocument(s, a.id, 3).orphanFile, null);
  assert.equal(library.removeDocument(s, b.id, 4).orphanFile, 'shared.pdf');
});

/* 6-7, 12. Completion rules */
test('required-output task cannot complete without a verified attachment; state stays untouched on failure', () => {
  const { s, task } = fixture();
  store.setRequiresOutput(s, task.id, true, 1500);
  let r = store.completeTask(s, task.id, 2000, 'user');
  assert.equal(r.ok, false); assert.equal(r.reason, 'output-required');
  assert.equal(task.done, false); assert.equal(task.completedAt, null); assert.equal(task.completionEvents.length, 0);

  const it = library.registerFile(s, Object.assign(file('1', HASH_A), { source: { module: 'goals', entityId: task.id }, taskId: task.id }), 10).item;
  r = store.completeTask(s, task.id, 2100, 'user');                       // attached but not verified on disk
  assert.equal(r.reason, 'output-missing'); assert.equal(task.done, false);
  r = store.completeTask(s, task.id, 2200, 'user', { availableFileNames: ['other.txt'] });
  assert.equal(r.ok, false); assert.equal(task.done, false);

  r = store.completeTask(s, task.id, 2300, 'user', { availableFileNames: [it.fileName] });
  assert.equal(r.ok, true); assert.equal(task.done, true);
  assert.deepEqual(task.deliverables.map((d) => d.id), [it.id]);
});

test('ordinary tasks still complete without any attachment', () => {
  const { s, task } = fixture();
  const r = store.completeTask(s, task.id, 2000, 'user');
  assert.equal(r.ok, true); assert.equal(task.done, true);
  assert.equal(task.deliverables, undefined);
});

/* 11. Removing a document must not erase completion history */
test('removing a document keeps the task completed and keeps its deliverable history', () => {
  const { s, task } = fixture();
  store.setRequiresOutput(s, task.id, true, 1);
  const it = library.registerFile(s, Object.assign(file('1', HASH_A), { source: { module: 'goals', entityId: task.id }, taskId: task.id }), 10).item;
  store.completeTask(s, task.id, 2000, 'user', { availableFileNames: [it.fileName] });
  library.removeDocument(s, it.id, 3000);
  assert.equal(task.done, true);
  assert.equal(task.completedAt, 2000);
  assert.equal(task.completionEvents.length, 1);
  assert.equal(task.deliverables.length, 1);
  assert.equal(task.deliverables[0].title, 'Analysis.xlsx');
  assert.equal(library.attachmentsForTask(s, task.id).length, 0);
});

/* 8. Survives restart (JSON round trip + normalize) */
test('relationships survive a save/load round trip', () => {
  const { s, task, g, m } = fixture();
  const it = library.registerFile(s, Object.assign(file('1', HASH_A), { source: { module: 'goals', entityId: task.id }, taskId: task.id }), 10).item;
  const loaded = JSON.parse(JSON.stringify(s));
  library.normalize(loaded, 99);
  const back = loaded.library[0];
  assert.equal(back.id, it.id);
  assert.equal(back.contentHash, HASH_A);
  assert.deepEqual(back.source, { module: 'goals', entityId: task.id });
  assert.deepEqual(back.taskIds, [task.id]);
  assert.deepEqual(back.milestoneRefs, [{ goalId: g.id, milestoneId: m.id }]);
});

/* 13. Legacy compatibility */
test('legacy items without source/hash load as direct imports and stay usable', () => {
  const s = { library: [
    { id: 'old1', type: 'file', title: 'Lama', fileName: 'libfile_x_lama.pdf', createdAt: 5, updatedAt: 5, taskIds: ['t1'], goalIds: ['g1'], milestoneRefs: [] },
    { id: 'old2', type: 'link', title: 'L', url: 'https://example.com', createdAt: 6, updatedAt: 6 }
  ] };
  library.normalize(s, 10);
  assert.equal(s.library.length, 2);
  assert.deepEqual(s.library[0].source, { module: 'library', entityId: null });
  assert.equal(s.library[0].contentHash, undefined);
  assert.equal(library.typeGroup(s.library[0]), 'pdf');
  // stale refs are preserved and still produce a readable path instead of throwing
  assert.ok(Array.isArray(library.contextPaths({ tasks: [], goals: [] }, s.library[0])));
});

test('registerFile rejects traversal names and bad input', () => {
  const s = store.createState();
  assert.equal(library.registerFile(s, { fileName: '../evil.txt' }, 1).ok, false);
  assert.equal(library.registerFile(s, { fileName: 'a/b.txt' }, 1).ok, false);
  assert.equal(library.registerFile(s, null, 1).ok, false);
  assert.equal(s.library.length, 0);
});

/* Library organisation */
test('query filters by type, source, goal, search, missing; sorts by name/date', () => {
  const { s, task, g } = fixture();
  library.registerFile(s, Object.assign(file('1', HASH_A), { title: 'Zeta.xlsx', source: { module: 'goals', entityId: task.id }, taskId: task.id }), 100);
  library.registerFile(s, { fileName: 'libfile_2_report.pdf', originalName: 'Report.pdf', contentHash: HASH_B, source: { module: 'library' } }, 200);
  assert.equal(library.query(s, { type: 'spreadsheet' }).length, 1);
  assert.equal(library.query(s, { type: 'pdf' }).length, 1);
  assert.equal(library.query(s, { module: 'goals' }).length, 1);
  assert.equal(library.query(s, { goalId: g.id }).length, 1);
  assert.equal(library.query(s, { search: 'report' }).length, 1);
  assert.deepEqual(library.query(s, { sort: 'date' }).map((x) => x.title), ['Report.pdf', 'Zeta.xlsx']);
  assert.deepEqual(library.query(s, { sort: 'name' }).map((x) => x.title), ['Report.pdf', 'Zeta.xlsx']);
  const status = { 'libfile_1_Analysis.xlsx': { exists: false } };
  assert.equal(library.query(s, { missingOnly: true }, status).length, 1);
  assert.equal(library.overview(s, status, 300).missing, 1);
});

test('future modules can register without touching Library code', () => {
  const s = store.createState();
  library.registerModule('laporan', 'Laporan');
  const r = library.registerFile(s, { fileName: 'libfile_3_r.csv', originalName: 'r.csv', contentHash: HASH_B, source: { module: 'laporan', entityId: 'x' } }, 1);
  assert.equal(r.item.source.module, 'laporan');
  assert.equal(library.moduleLabel('laporan'), 'Laporan');
  assert.equal(library.typeGroup(r.item), 'spreadsheet');
});

/* ── main-process service on a real temp directory ─────────────────── */
function svc(dialogPaths) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jf-lib-'));
  const src = path.join(dir, 'src'); fs.mkdirSync(src);
  const opened = [];
  const s = createLibraryService({
    userDataDir: path.join(dir, 'ud'),
    dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: dialogPaths(src) }) },
    shell: { openPath: async (p) => { opened.push(p); return ''; } },
    getWindow: () => null
  });
  return { s, dir, src, opened };
}

test('service: pick (multi) -> import copies into managed dir and returns a content hash', async () => {
  const t = svc((src) => { fs.writeFileSync(path.join(src, 'a.xlsx'), 'AAA'); fs.writeFileSync(path.join(src, 'b.pdf'), 'BBB'); return [path.join(src, 'a.xlsx'), path.join(src, 'b.pdf')]; });
  const p = await t.s.pick({ multiple: true });
  assert.equal(p.files.length, 2);
  const imp = await t.s.importFile({ token: p.files[0].token });
  assert.equal(imp.ok, true);
  assert.match(imp.hash, /^[0-9a-f]{64}$/);
  assert.equal(fs.readFileSync(path.join(t.dir, 'ud', 'library', 'files', imp.fileName), 'utf8'), 'AAA');
  assert.equal((await t.s.importFile({ token: p.files[0].token })).reason, 'bad-token');   // tokens are one-time
});

test('service: identical content is reused instead of copied again', async () => {
  const t = svc((src) => { fs.writeFileSync(path.join(src, 'a.xlsx'), 'SAME'); fs.writeFileSync(path.join(src, 'copy.xlsx'), 'SAME'); return [path.join(src, 'a.xlsx'), path.join(src, 'copy.xlsx')]; });
  const p = await t.s.pick({ multiple: true });
  const first = await t.s.importFile({ token: p.files[0].token });
  const second = await t.s.importFile({ token: p.files[1].token, reuse: [{ hash: first.hash, fileName: first.fileName }] });
  assert.equal(second.reused, true);
  assert.equal(second.fileName, first.fileName);
  assert.equal(fs.readdirSync(path.join(t.dir, 'ud', 'library', 'files')).length, 1);
});

test('service: a lying reuse hint cannot point at different bytes or escape the directory', async () => {
  const t = svc((src) => { fs.writeFileSync(path.join(src, 'a.xlsx'), 'ONE'); fs.writeFileSync(path.join(src, 'b.xlsx'), 'TWO'); return [path.join(src, 'a.xlsx'), path.join(src, 'b.xlsx')]; });
  const p = await t.s.pick({ multiple: true });
  const first = await t.s.importFile({ token: p.files[0].token });
  const second = await t.s.importFile({ token: p.files[1].token, reuse: [{ hash: first.hash, fileName: first.fileName }, { hash: first.hash, fileName: '../../src/a.xlsx' }] });
  assert.equal(second.reused, false);
  assert.notEqual(second.fileName, first.fileName);
});

test('service: rejects unsupported types and oversized files at pick time', async () => {
  const t = svc((src) => { fs.writeFileSync(path.join(src, 'x.exe'), 'MZ'); fs.writeFileSync(path.join(src, 'ok.txt'), 'ok'); return [path.join(src, 'x.exe'), path.join(src, 'ok.txt')]; });
  const p = await t.s.pick({ multiple: true });
  assert.equal(p.files.length, 1);
  assert.deepEqual(p.errors, [{ name: 'x.exe', error: 'unsupported-type' }]);
});

test('service: open / check / delete respect path validation and report missing files', async () => {
  const t = svc((src) => { fs.writeFileSync(path.join(src, 'a.txt'), 'hi'); return [path.join(src, 'a.txt')]; });
  const p = await t.s.pick({ multiple: true });
  const imp = await t.s.importFile({ token: p.files[0].token });
  assert.equal((await t.s.open({ fileName: imp.fileName })).ok, true);
  assert.equal(t.opened.length, 1);
  assert.equal((await t.s.open({ fileName: '../../src/a.txt' })).reason, 'bad-path');
  assert.equal((await t.s.open({ fileName: path.join(t.src, 'a.txt') })).reason, 'bad-path');
  let c = await t.s.checkFiles({ fileNames: [imp.fileName, 'nope.txt', '../x'] });
  assert.equal(c.files[imp.fileName].exists, true);
  assert.equal(c.files['nope.txt'].exists, false);
  assert.equal(c.files['../x'].reason, 'bad-path');
  assert.equal((await t.s.deleteFile({ fileName: imp.fileName })).ok, true);
  c = await t.s.checkFiles({ fileNames: [imp.fileName] });
  assert.equal(c.files[imp.fileName].exists, false);
  assert.equal((await t.s.open({ fileName: imp.fileName })).reason, 'missing');
});

test('service: generated text documents are stored, deduped, and restricted to text types', async () => {
  const t = svc(() => []);
  const a = await t.s.storeGenerated({ name: 'laporan.csv', text: 'a,b\n1,2' });
  assert.equal(a.ok, true);
  const b = await t.s.storeGenerated({ name: 'laporan.csv', text: 'a,b\n1,2', reuse: [{ hash: a.hash, fileName: a.fileName }] });
  assert.equal(b.reused, true);
  assert.equal((await t.s.storeGenerated({ name: 'evil.exe', text: 'x' })).reason, 'unsupported-type');
  assert.equal((await t.s.storeGenerated({ name: 5, text: 'x' })).reason, 'bad-input');
});

/* 9, 14. Wiring checks (static): IPC exposed, no raw paths/ipcRenderer in renderer */
test('wiring: IPC channels are trusted-only, exposed via preload, and the build ships the service', () => {
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  ['pick', 'import', 'store-generated', 'open', 'delete-file', 'cleanup-pending', 'recover-deletions', 'check-files'].forEach((c) => {
    assert.match(main, new RegExp("handleTrusted\\('library:" + c + "'"));
    assert.match(preload, new RegExp("'library:" + c + "'"));
  });
  assert.ok(pkg.build.files.includes('library-service.js'));
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(index.indexOf('renderer/documents.js') > index.indexOf('renderer/core.js') && index.indexOf('renderer/documents.js') < index.indexOf('renderer/pages/goals.js'));
  const docs = fs.readFileSync(path.join(root, 'renderer', 'documents.js'), 'utf8');
  assert.doesNotMatch(docs, /ipcRenderer|require\(|localStorage/);
});

test('wiring: Goals task rows expose Output, Library has no manual id entry, Analitik export registers a document', () => {
  const g = fs.readFileSync(path.join(root, 'renderer', 'pages', 'goals.js'), 'utf8');
  const l = fs.readFileSync(path.join(root, 'renderer', 'pages', 'library.js'), 'utf8');
  const a = fs.readFileSync(path.join(root, 'renderer', 'pages', 'analitik.js'), 'utf8');
  assert.match(g, /attachToTask\(t\.id\)/);
  assert.match(g, /setRequiresOutput/);
  assert.doesNotMatch(l, /ID tugas|ID goal|taskIds: parseIds/);
  assert.match(a, /registerGenerated\(\{\s*module: 'analitik'/);
});
