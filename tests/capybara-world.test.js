'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const html = read('index.html');
const boot = read('renderer', 'boot.js');
const originalHome = read('renderer', 'pages', 'beranda.js');
const originalSettings = read('renderer', 'pages', 'pengaturan.js');
const experience = read('renderer', 'experiences', 'capybara-world', 'experience.js');
const pages = read('renderer', 'experiences', 'capybara-world', 'pages.js');
const components = read('renderer', 'experiences', 'capybara-world', 'components.js');
const styles = read('renderer', 'experiences', 'capybara-world', 'experience.css');
const homeStyles = read('renderer', 'experiences', 'capybara-world', 'beranda.css');

test('Experience selection is read before style and renderer initialization', () => {
  assert.match(html, /data-experience',localStorage\.getItem\('jamfokus\.homeExperience'\)/);
  assert.match(html, /id="original-theme" rel="stylesheet"/);
  assert.match(html, /original-theme'\)\.disabled=true/);
  assert.match(html, /renderer\/experiences\/capybara-world\/components\.js/);
  assert.match(html, /renderer\/experiences\/capybara-world\/pages\.js/);
  assert.match(originalHome, /JF\.homeExperience =/);
  assert.doesNotMatch(originalHome, /JF\.capybaraHome\.(mount|render)/);
});

test('Boot routes Capybara before calling any Original page mount or render', () => {
  const capyRoute = boot.indexOf('if (capybaraWorld)');
  const originalMount = boot.indexOf('p.mount && p.mount(sec)');
  const originalRender = boot.indexOf('p.render(sec)');
  assert.ok(capyRoute >= 0 && capyRoute < originalMount && capyRoute < originalRender);
  assert.match(boot, /JF\.experiences\.capybaraWorld\.render\(id\)/);
  assert.match(boot, /selectedExperience !== activeExperience/);
  assert.doesNotMatch(boot, /afterPageRender/);
});

test('Capybara has a private shell and a renderer for all ten routes', () => {
  const routeIds = ['beranda', 'tugas', 'kalender', 'analitik', 'riwayat', 'laporan', 'goals', 'jurnal', 'pengaturan', 'library'];
  routeIds.forEach((id) => {
    assert.ok(experience.includes("['" + id + "',"), 'Missing independent route: ' + id);
    assert.ok(pages.includes("case '" + id + "'"), 'Missing Capybara page renderer: ' + id);
  });
  assert.match(experience, /className = 'cw-app-shell'/);
  assert.match(experience, /JF\.capybaraPages\.render\(id, content\)/);
  assert.doesNotMatch(experience, /afterPageRender|applyPageLayout|querySelector\('\.page/);
  assert.match(pages, /function renderTasks/);
  assert.match(pages, /function renderCalendar/);
  assert.match(pages, /function renderAnalytics/);
  assert.match(pages, /function renderGoals/);
  assert.match(pages, /function renderJournal/);
  assert.match(pages, /function renderLibrary/);
});

test('Capybara renderers use shared productivity state and services', () => {
  [
    'JF.app.rawState()', 'JF.store.addTask(', 'JF.app.startTask(', 'JF.app.completeTask(',
    'JF.analytics.compute(', 'JF.goals.createGoal(', 'JF.goals.linkTask(', 'JF.journal.save(',
    'JF.documents.attachToTask(', 'JF.documents.importStandalone(', 'JF.snapshots.correctionsFor('
  ].forEach((call) => assert.ok(pages.includes(call), 'Missing shared integration: ' + call));
  assert.doesNotMatch(pages, /indexedDB\.open|jamfokus\.v2|createState\(/);
  assert.doesNotMatch(experience + pages, /renderer\/pages\/|JF\.pages\.get/);
});

test('Experience switching is persistent and remains reachable from either experience', () => {
  assert.match(originalSettings, /experienceCard\(\)/);
  assert.match(originalSettings, /JF\.homeExperience\.set\(select\.value\)/);
  assert.match(pages, /JF\.homeExperience\.set\((this\.value|spec\[0\])\)/);
  assert.match(originalHome, /localStorage\.setItem\('jamfokus\.homeExperience', experience\)/);
  assert.match(experience, /originalStyles\.disabled = active/);
});

test('Capybara styles are independently scoped, responsive, and include custom dialogs', () => {
  assert.match(styles, /\.cw-app-shell\s*\{/);
  assert.match(styles, /\.cw-task-card\s*\{/);
  assert.match(styles, /\.cw-calendar-grid\s*\{/);
  assert.match(styles, /#modalRoot \.modal-veil/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /@media \(max-width: 420px\)/);
  assert.doesNotMatch(styles, /\.app\.capybara-world-active \.page \.(card|task-row|cal-cell)/);
  assert.doesNotMatch(components, /className: 'card|ui\.btn\(/);
  assert.match(homeStyles, /\.capy-home\s*\{/);
});

test('Goal, task, and journal relationships remain in the canonical state', () => {
  const dates = require('../shared/dates.js');
  const model = require('../shared/model.js');
  const store = require('../shared/store.js');
  const goals = require('../shared/goals.js');
  const journal = require('../shared/journal.js');
  const state = store.createState();
  const today = dates.todayKey();
  const task = store.addTask(state, { title: 'Riset bahan', targetDate: today, priority: 'high' }, Date.now());
  const goalResult = goals.createGoal(state, { title: 'Menyelesaikan riset', startDate: today }, Date.now());
  assert.equal(goalResult.ok, true);
  const milestoneResult = goals.addMilestone(state, goalResult.goal.id, { title: 'Kumpulkan sumber' }, Date.now());
  assert.equal(milestoneResult.ok, true);
  assert.equal(goals.linkTask(state, goalResult.goal.id, task.id, milestoneResult.milestone.id, Date.now()).ok, true);
  assert.equal(goals.taskRefs(state, goalResult.goal).length, 1);
  assert.equal(journal.save(state, today, { wins: 'Sumber terkumpul' }, Date.now()).ok, true);
  assert.deepEqual(journal.goalLinkOf(state, today), null);
  assert.equal(model.isActive(task), true);
});
