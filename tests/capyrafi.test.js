'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const cr = require('../renderer/experiences/capybara-world/capyrafi.js');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

function stateWith(tasksDone, milestonesDone, goalsDone) {
  return {
    tasks: Array.from({ length: tasksDone }, () => ({ done: true })).concat([{ done: false }]),
    goals: [{ status: goalsDone ? 'completed' : 'in_progress', milestones: Array.from({ length: milestonesDone }, () => ({ done: true })) }]
      .concat(Array.from({ length: Math.max(0, goalsDone - 1) }, () => ({ status: 'completed', milestones: [] })))
  };
}

test('XP dihitung dari tugas, milestone, dan goal tercapai', () => {
  const info = cr.compute(stateWith(3, 2, 1));
  assert.equal(info.xp, 3 * cr.XP.task + 2 * cr.XP.milestone + 1 * cr.XP.goal);
  assert.equal(info.doneTasks, 3);
  assert.equal(info.milestones, 2);
  assert.equal(info.goalsDone, 1);
});

test('tahap naik seiring XP dan tidak pernah turun saat XP naik', () => {
  let last = -1;
  for (let n = 0; n <= 100; n++) {
    const info = cr.compute(stateWith(n, 0, 0));
    assert.ok(info.stage >= last);
    last = info.stage;
  }
  assert.equal(cr.compute(stateWith(0, 0, 0)).stage, 0);
  assert.equal(cr.compute(stateWith(100, 0, 0)).stage, cr.STAGES.length - 1);
  assert.equal(cr.compute(stateWith(100, 0, 0)).max, true);
});

test('state kosong atau rusak tidak membuat error', () => {
  assert.equal(cr.compute(null).xp, 0);
  assert.equal(cr.compute({}).stage, 0);
  assert.equal(cr.compute({ tasks: [null, undefined], goals: [null, { milestones: [null] }] }).xp, 0);
});

test('mood mengikuti kondisi hari ini', () => {
  assert.equal(cr.moodOf({ onBreak: true }), 'rest');
  assert.equal(cr.moodOf({ running: true }), 'focus');
  assert.equal(cr.moodOf({ todayTotal: 2, todayDone: 2 }), 'party');
  assert.equal(cr.moodOf({ overdue: 4, todayTotal: 1 }), 'worried');
  assert.equal(cr.moodOf({ todayTotal: 0 }), 'sleepy');
  assert.equal(cr.moodOf({ todayTotal: 3, todayDone: 1 }), 'happy');
});

test('setiap tahap dan mood menghasilkan SVG valid dengan label aksesibilitas', () => {
  ['happy', 'focus', 'rest', 'party', 'worried', 'sleepy'].forEach((mood) => {
    cr.STAGES.forEach((stage, i) => {
      const svg = cr.svg({ stage: i, mood });
      assert.match(svg, /^<svg /);
      assert.match(svg, /role="img"/);
      assert.ok(svg.includes(stage.name));
    });
  });
  assert.match(cr.room({ stage: 2, mood: 'happy', night: true }), /Ruang CapyRafi/);
});

test('celoteh CapyRafi selalu menghasilkan teks dan mengganti placeholder', () => {
  ['happy', 'focus', 'rest', 'party', 'worried', 'sleepy'].forEach((mood) => {
    for (let bump = 0; bump < 4; bump++) {
      const text = cr.say(mood, { dayKey: '2026-11-01', todayTotal: 3, overdue: 5 }, bump);
      assert.ok(text.length > 5);
      assert.doesNotMatch(text, /\{[no]\}/);
    }
  });
});

test('Capybara World memakai HUD + dock, dengan musik, timer, dan lencana global', () => {
  const exp = read('renderer', 'experiences', 'capybara-world', 'experience.js');
  assert.match(exp, /cw-dock/);
  assert.match(exp, /cw-hud/);
  assert.doesNotMatch(exp, /cw-rail/);
  assert.match(exp, /app\.on\('music'/);
  assert.match(exp, /function updateTimer/);
  assert.match(exp, /overdue/);
  assert.match(read('index.html'), /capyrafi\.js[\s\S]*capybara-world\/beranda\.js/);
  assert.match(read('renderer', 'boot.js'), /capybaraWorld\.refresh\(/);
});

test('halaman dalam Capybara: papan tugas, kalender stiker, kebun goal', () => {
  const pages = read('renderer', 'experiences', 'capybara-world', 'pages.js');
  assert.match(pages, /function boardColumn/);
  assert.match(pages, /dragstart/);
  assert.match(pages, /JF\.store\.rescheduleTask\(state\(\), id, day/);
  assert.match(pages, /function treeSvg/);
  assert.match(pages, /cw-sticker/);
  assert.match(pages, /JF\.goals\.completeMilestone/);
  assert.match(read('index.html'), /capybara-world\/boards\.css/);
  const css = read('renderer', 'experiences', 'capybara-world', 'boards.css');
  assert.match(css, /\.cw-board/);
  assert.match(css, /prefers-reduced-motion/);
});

test('Jurnal buku harian dan Rapor CapyRafi memakai data bersama', () => {
  const pages = read('renderer', 'experiences', 'capybara-world', 'pages.js');
  assert.match(pages, /JF\.journal\.createAutosave/);
  assert.match(pages, /function writingRun/);
  assert.match(pages, /function focusChart/);
  assert.match(pages, /result\.distribution/);
  assert.match(pages, /result\.deltas/);
  assert.doesNotMatch(pages, /streak/i);
  const css = read('renderer', 'experiences', 'capybara-world', 'boards.css');
  assert.match(css, /\.cw-notebook/);
  assert.match(css, /\.cw-report-hero/);
});

test('Riwayat jejak kaki fokus dan Laporan album harian', () => {
  const pages = read('renderer', 'experiences', 'capybara-world', 'pages.js');
  assert.match(pages, /cw-timeline/);
  assert.match(pages, /cw-trail-cell/);
  assert.match(pages, /function polaroid/);
  assert.match(pages, /function ringSvg/);
  assert.match(pages, /JF\.snapshots\.correctionsFor/);
  assert.match(pages, /Perubahan setelah laporan/);
  assert.match(read('renderer', 'experiences', 'capybara-world', 'beranda.js'), /context: heroContext/);
  const css = read('renderer', 'experiences', 'capybara-world', 'boards.css');
  assert.match(css, /\.cw-polaroid/);
  assert.match(css, /\.cw-tl-item/);
});

test('Pengaturan ruang kontrol dan Library rak pengetahuan', () => {
  const pages = read('renderer', 'experiences', 'capybara-world', 'pages.js');
  assert.match(pages, /cw-settings-nav/);
  assert.match(pages, /function switchField/);
  assert.match(pages, /JF\.homeExperience\.set\(spec\[0\]\)/);
  assert.match(pages, /JF\.store\.setFocusTargetDefault/);
  assert.match(pages, /function libraryCard/);
  assert.match(pages, /search\.addEventListener\('input'/);
  assert.doesNotMatch(pages, /oninput: function \(\) \{ librarySearch/);
  const css = read('renderer', 'experiences', 'capybara-world', 'boards.css');
  assert.match(css, /\.cw-exp-tile/);
  assert.match(css, /\.cw-book/);
});
