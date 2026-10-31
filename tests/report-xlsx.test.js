'use strict';
/* Laporan Excel: model builder + xlsx writer. Container integrity is checked
   here (zip structure, CRC32, XML parts, strings); how it LOOKS in Excel was
   verified separately by rendering with LibreOffice (manual step). */
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const dates = require('../shared/dates.js');
const store = require('../shared/store.js');
const sessions = require('../shared/sessions.js');
const goals = require('../shared/goals.js');
const library = require('../shared/library.js');
const A = require('../shared/analytics.js');
const report = require('../shared/report.js');
const X = require('../shared/xlsx.js');

const TODAY = '2026-10-28';
const T = (day, h = 12) => { const p = dates.parseDay(day); return new Date(p.y, p.m - 1, p.d, h, 0).getTime(); };

function seed() {
  const s = store.createState();
  const t1 = store.addTask(s, { title: 'Riset kompetitor', targetDate: '2026-10-27', priority: 'high' }, T('2026-10-27', 8));
  const t2 = store.addTask(s, { title: '=HYPERLINK("http://x")', targetDate: '2026-10-29' }, T('2026-10-27', 8));
  store.completeTask(s, t1.id, T('2026-10-27', 15));
  const x = sessions.createSession(s, { taskId: t1.id, taskName: 'a', plannedSec: 1500 }, T('2026-10-27', 9));
  sessions.completeSession(s, x, T('2026-10-27', 9) + 1500000);
  const g = goals.createGoal(s, { title: 'Leviant', category: 'Bisnis' }, T('2026-10-01')).goal;
  const m = goals.addMilestone(s, g.id, { title: 'Market Validation' }, T('2026-10-01')).milestone;
  goals.linkTask(s, g.id, t1.id, m.id, T('2026-10-02'));
  const reg = (name, h, task) => library.registerFile(s, { fileName: 'libfile_' + h + '_' + name, originalName: name, size: 2048, contentHash: h.repeat(64).slice(0, 64), source: { module: 'goals', entityId: task.id }, taskId: task.id }, T('2026-10-27', 16));
  reg('Competitor Analysis.xlsx', 'a', t1); reg('Ringkasan <Riset> & Data.pdf', 'b', t1);
  return { s, t1, t2, g, m };
}
const compute = (s, filters) => A.compute(s, { today: TODAY, period: A.period('week', TODAY, TODAY), filters });

/* minimal zip reader (central directory) to verify the container */
function unzip(buf) {
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  assert.ok(e >= 0, 'EOCD found');
  const n = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16); const out = {};
  for (let i = 0; i < n; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const crc = buf.readUInt32LE(p + 16), size = buf.readUInt32LE(p + 24), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nl);
    const ln = buf.readUInt16LE(off + 26), le = buf.readUInt16LE(off + 28), start = off + 30 + ln + le;
    const data = buf.subarray(start, start + size);
    assert.equal(zlib.crc32 ? zlib.crc32(data) : X.crc32(data), crc, 'CRC ' + name);
    out[name] = data.toString('utf8'); p += 46 + nl + el + cl;
  }
  return out;
}

test('workbook has the six report sheets with real zip/CRC integrity', () => {
  const { s } = seed();
  const wb = report.buildReport(s, compute(s), { now: T(TODAY, 20) });
  assert.deepEqual(wb.sheets.map((x) => x.name), ['Ringkasan', 'Rincian Harian', 'Tugas', 'Goals', 'Milestone', 'Lampiran']);
  const files = unzip(Buffer.from(X.build(wb)));
  ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/styles.xml', 'xl/sharedStrings.xml', 'xl/worksheets/sheet6.xml'].forEach((f) => assert.ok(files[f], f));
  assert.match(files['xl/workbook.xml'], /name="Ringkasan"/);
  assert.match(files['xl/styles.xml'], /<fill><patternFill patternType="solid">/);
});

test('attached file names appear per task, goal, milestone and in the Lampiran sheet', () => {
  const { s } = seed();
  const files = unzip(Buffer.from(X.build(report.buildReport(s, compute(s), { now: T(TODAY, 20) }))));
  const strings = files['xl/sharedStrings.xml'];
  assert.ok(strings.includes('• Competitor Analysis.xlsx'), 'task row lists the file');
  assert.ok(strings.includes('• Ringkasan &lt;Riset&gt; &amp; Data.pdf'), 'XML special characters are escaped');
  assert.ok(strings.includes('Competitor Analysis.xlsx'));
  const wb = report.buildReport(s, compute(s), { now: T(TODAY, 20) });
  const text = (name) => JSON.stringify(wb.sheets.find((x) => x.name === name).rows);
  ['Tugas', 'Goals', 'Milestone', 'Lampiran'].forEach((n) => assert.ok(text(n).includes('Competitor Analysis.xlsx'), n));
  assert.ok(text('Lampiran').includes('Leviant') && text('Lampiran').includes('Market Validation') && text('Lampiran').includes('Riset kompetitor'));
});

test('missing files are flagged (red) only when availability is known; otherwise "Belum dicek"', () => {
  const { s } = seed();
  const names = s.library.map((x) => x.fileName);
  const known = JSON.stringify(report.buildReport(s, compute(s), { now: 1, fileStatus: { [names[0]]: { exists: true }, [names[1]]: { exists: false } } }).sheets[2].rows);
  assert.ok(known.includes('✖ 1 file hilang'));
  const unknown = JSON.stringify(report.buildReport(s, compute(s), { now: 1 }).sheets[2].rows);
  assert.ok(unknown.includes('Belum dicek') && !unknown.includes('file hilang'));
});

test('task titles that look like formulas are stored as text, never as formulas', () => {
  const { s } = seed();
  const bytes = Buffer.from(X.build(report.buildReport(s, compute(s), { now: 1 })));
  const files = unzip(bytes);
  const sheet3 = files['xl/worksheets/sheet3.xml'];
  assert.ok(files['xl/sharedStrings.xml'].includes('=HYPERLINK(&quot;http://x&quot;)'));
  assert.ok(!/<f>[^<]*HYPERLINK/.test(sheet3));
});

test('goal filter limits tasks, goals and files to that goal', () => {
  const { s, g } = seed();
  const g2 = goals.createGoal(s, { title: 'Lain' }, T('2026-10-01')).goal;
  const t = store.addTask(s, { title: 'Tugas lain', targetDate: '2026-10-28' }, T('2026-10-27', 8));
  goals.linkTask(s, g2.id, t.id, null, T('2026-10-02'));
  const wb = report.buildReport(s, compute(s, { goalId: g.id }), { now: 1 });
  const all = JSON.stringify(wb.sheets);
  assert.ok(!all.includes('Tugas lain') && !all.includes('"Lain"'));
  assert.ok(all.includes('Riset kompetitor'));
});

test('empty state still produces a valid workbook with friendly empty rows', () => {
  const s = store.createState();
  const wb = report.buildReport(s, compute(s), { now: 1 });
  const files = unzip(Buffer.from(X.build(wb)));
  assert.ok(files['xl/worksheets/sheet1.xml']);
  assert.ok(JSON.stringify(wb.sheets[5].rows).includes('Belum ada file di Library.'));
  assert.ok(JSON.stringify(wb.sheets[2].rows).includes('Tidak ada tugas'));
});

test('totals use formulas with cached values; numbers match the dashboard', () => {
  const { s } = seed();
  const res = compute(s);
  const wb = report.buildReport(s, res, { now: 1 });
  const daily = wb.sheets[1];
  const total = daily.rows[daily.rows.length - 1];
  assert.equal(total[0].v, 'TOTAL');
  assert.match(total[2].f, /^SUM\(C\d+:C\d+\)$/);
  assert.equal(total[4].v, Math.round(res.current.focusSec / 60));
  const kpi = JSON.stringify(wb.sheets[0].rows);
  assert.ok(kpi.includes('Tugas selesai (unik)') && kpi.includes('Tingkat penyelesaian') && kpi.includes('File lampiran di Library'));
});

test('file name carries the period; sheet names are sanitised and unique', () => {
  const { s } = seed();
  assert.equal(report.fileName(compute(s)), 'jam-fokus-laporan-2026-10-26_2026-11-01.xlsx');
  const files = unzip(Buffer.from(X.build({ sheets: [{ name: 'A/B:C', rows: [['x']] }, { name: 'A/B:C', rows: [['y']] }] })));
  assert.match(files['xl/workbook.xml'], /name="A B C"[\s\S]*name="A B C 2"/);
});

test('wiring: Analitik offers Ekspor Excel as the only export and builds from JF.report/JF.xlsx', () => {
  const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
  const page = fs.readFileSync(path.join(root, 'renderer/pages/analitik.js'), 'utf8');
  const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(page.includes('Ekspor Excel') && page.includes('JF.report.buildReport') && page.includes('JF.xlsx.build'));
  // CSV export sudah dihapus total: tidak ada tombol, handler, atau util yang tersisa.
  assert.doesNotMatch(page, /Ekspor CSV|exportCSV|toCSV|analitik-.*\.csv/);
  assert.strictEqual(typeof require('../shared/analytics.js').toCSV, 'undefined');
  ['shared/xlsx.js', 'shared/report.js'].forEach((f) => assert.ok(idx.indexOf(f) > 0 && idx.indexOf(f) < idx.indexOf('renderer/core.js'), f));
  assert.ok(idx.indexOf('shared/report.js') > idx.indexOf('shared/analytics.js') && idx.indexOf('shared/report.js') > idx.indexOf('shared/library.js'));
});

test('file service stores generated .xlsx bytes (dedupe + zip-header check) and still refuses other binaries', async () => {
  const fs = require('fs'), os = require('os'), path = require('path');
  const { createLibraryService } = require('../library-service.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jf-x-'));
  const svc = createLibraryService({ userDataDir: dir, dialog: {}, shell: {}, getWindow: () => null });
  const { s } = seed();
  const bytes = X.build(report.buildReport(s, compute(s), { now: 1 }));
  const a = await svc.storeGenerated({ name: 'laporan.xlsx', bytes });
  assert.equal(a.ok, true);
  assert.equal(Buffer.compare(fs.readFileSync(path.join(dir, 'library', 'files', a.fileName)), Buffer.from(bytes)), 0);
  const b = await svc.storeGenerated({ name: 'laporan.xlsx', bytes, reuse: [{ hash: a.hash, fileName: a.fileName }] });
  assert.equal(b.reused, true);
  assert.equal((await svc.storeGenerated({ name: 'x.xlsx', bytes: new Uint8Array([1, 2, 3, 4, 5, 6]) })).reason, 'bad-input');
  assert.equal((await svc.storeGenerated({ name: 'x.exe', bytes })).reason, 'unsupported-type');
});
