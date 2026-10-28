/* Jam Fokus - Journaling: one locally stored reflection per day.
   The page is mounted once; render() updates chrome/summary without rebuilding
   the textareas, so autosaves and app 'change' events never steal focus. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app, host, saver;
  var selected = null, loadedDay = null, switching = false, lastSavedAt = null;
  var fields = {}, els = {}, baseContent = null;

  var FIELDS = [
    { key: 'wins', num: '01', label: 'Pencapaian hari ini',
      prompt: 'Apa yang berhasil Anda selesaikan hari ini?',
      placeholder: 'Tulis satu atau beberapa hal yang membuat hari ini berarti...' },
    { key: 'challenges', num: '02', label: 'Tantangan',
      prompt: 'Apa yang menghambat atau mengalihkan fokus?',
      placeholder: 'Ceritakan hambatan, distraksi, atau hal yang terasa berat...' },
    { key: 'learned', num: '03', label: 'Yang saya pelajari',
      prompt: 'Pengetahuan, keterampilan, atau wawasan baru apa yang Anda dapatkan?',
      placeholder: 'Satu insight kecil tetap berarti...' },
    { key: 'priorities', num: '04', label: 'Prioritas besok',
      prompt: 'Langkah konkret apa yang ingin Anda lakukan besok?',
      placeholder: 'Tulis 1-3 prioritas yang jelas...' }
  ];

  function validDay(day) { return !!day && JF.dates.isDayKey(day); }

  function dayFromHash() {
    var hash = location.hash || '';
    var q = hash.indexOf('?') >= 0 ? hash.slice(hash.indexOf('?') + 1) : '';
    var m = /(?:^|&)date=([^&]+)/.exec(q);
    if (!m) return null;
    var day = '';
    try { day = decodeURIComponent(m[1]); } catch (e) { return null; }
    return validDay(day) ? day : null;
  }

  function targetDay() { return dayFromHash() || app.today(); }

  function setHash(day) {
    var next = '#jurnal?date=' + day;
    if (location.hash === next) return;
    try { history.replaceState(null, '', next); }
    catch (e) { location.hash = next; }
  }

  function read() {
    var out = {};
    FIELDS.forEach(function (f) { out[f.key] = fields[f.key] ? fields[f.key].value : ''; });
    return out;
  }

  function contentOf(entry) {
    var out = {};
    FIELDS.forEach(function (f) { out[f.key] = entry ? (entry[f.key] || '') : ''; });
    return out;
  }

  function sameContent(a, b) {
    return !!a && !!b && FIELDS.every(function (f) { return String(a[f.key] || '') === String(b[f.key] || ''); });
  }

  function setSaveStatus(kind, message, title) {
    if (!els.save) return;
    els.save.className = 'jr-save' + (kind ? ' ' + kind : '');
    els.saveText.textContent = message;
    if (title) els.save.title = title;
    else els.save.removeAttribute('title');
  }

  function persist(day, content) {
    var r = JF.journal.save(app.rawState(), day, content, Date.now());
    if (!r.ok) return false;
    // Always write the state: a previous quota failure may already have mutated
    // the in-memory entry, so a no-op journal.save must still be retried.
    var ok = app.save();
    if (ok) {
      lastSavedAt = Date.now();
      baseContent = contentOf(content);
    }
    return ok;
  }

  function onInput() {
    if (!selected) return;
    saver.schedule(selected, read());
  }

  function makeNavButton(icon, label, onClick) {
    var b = ui.btn(ui.svg(icon, 16), onClick, { ghost: true, sm: true, title: label });
    b.setAttribute('aria-label', label);
    return b;
  }

  function buildHeader() {
    var wrap = ui.el('div.jr-head');
    var intro = ui.el('div.jr-intro');
    intro.appendChild(ui.el('div.section-label.jr-kicker', 'Jurnal harian'));
    els.dateTitle = ui.el('h2.jr-date', { id: 'jr-date' });
    els.dateRel = ui.el('div.jr-rel.hint', { id: 'jr-rel' });
    intro.appendChild(els.dateTitle);
    intro.appendChild(els.dateRel);

    var tools = ui.el('div.jr-tools');
    var prev = makeNavButton(ui.ICON.chevL, 'Hari sebelumnya', function () {
      requestSelect(JF.dates.addDays(selected, -1));
    });
    els.dateInput = ui.el('input.jr-date-input', {
      type: 'date', 'aria-label': 'Pilih tanggal jurnal'
    });
    els.dateInput.addEventListener('change', function () {
      var day = els.dateInput.value;
      if (validDay(day)) requestSelect(day);
      else els.dateInput.value = selected;
    });
    els.todayBtn = ui.btn('Hari ini', function () { requestSelect(app.today()); }, { ghost: true, sm: true });
    var next = makeNavButton(ui.ICON.chevR, 'Hari berikutnya', function () {
      requestSelect(JF.dates.addDays(selected, 1));
    });

    tools.appendChild(prev);
    tools.appendChild(els.dateInput);
    tools.appendChild(els.todayBtn);
    tools.appendChild(next);
    wrap.appendChild(intro);
    wrap.appendChild(tools);
    host.appendChild(wrap);
  }

  function addStat(parent, key, label) {
    var box = ui.el('div.stat.jr-stat');
    box.appendChild(ui.el('div.k', label));
    var v = ui.el('div.v', '-');
    var u = ui.el('div.u', '');
    box.appendChild(v);
    box.appendChild(u);
    parent.appendChild(box);
    els['stat_' + key] = { v: v, u: u };
  }

  function buildSummary() {
    var wrap = ui.el('section.jr-summary-wrap', { 'aria-label': 'Ringkasan hari itu' });
    var head = ui.el('div.jr-summary-head');
    head.appendChild(ui.el('div.section-label', { style: { margin: '0' } }, 'Ringkasan hari itu'));
    els.dataNote = ui.el('span.chip.outline');
    els.dataNote.hidden = true;
    head.appendChild(els.dataNote);
    var stats = ui.el('div.jr-stats');
    addStat(stats, 'done', 'Tugas selesai');
    addStat(stats, 'focus', 'Waktu fokus');
    addStat(stats, 'sessions', 'Sesi fokus');
    wrap.appendChild(head);
    wrap.appendChild(stats);
    host.appendChild(wrap);
  }

  function buildEditor() {
    var card = ui.el('section.card.jr-editor', { 'aria-labelledby': 'jr-editor-title' });
    var head = ui.el('div.jr-editor-head');
    var title = ui.el('div.jr-editor-title');
    title.appendChild(ui.el('h2', { id: 'jr-editor-title' }, 'Catatan hari ini'));
    els.editorHint = ui.el('div.hint', { id: 'jr-editor-hint' });
    title.appendChild(els.editorHint);

    var savebar = ui.el('div.jr-savebar');
    els.save = ui.el('span.jr-save', { role: 'status', 'aria-live': 'polite' });
    els.save.appendChild(ui.el('i.dot', { 'aria-hidden': 'true' }));
    els.saveText = ui.el('span', { id: 'jr-save-text' }, 'Belum ada perubahan');
    els.save.appendChild(els.saveText);
    els.saveBtn = ui.btn('Simpan sekarang', saveNow, { ghost: true, sm: true });
    savebar.appendChild(els.save);
    savebar.appendChild(els.saveBtn);

    head.appendChild(title);
    head.appendChild(savebar);

    var grid = ui.el('div.jr-grid');
    FIELDS.forEach(function (f) {
      var block = ui.el('div.jr-block', { dataset: { section: f.key } });
      var blockHead = ui.el('div.jr-block-head');
      blockHead.appendChild(ui.el('span.jr-num', { 'aria-hidden': 'true' }, f.num));
      blockHead.appendChild(ui.el('label.jr-label', { for: 'jr-' + f.key }, f.label));
      var prompt = ui.el('p.jr-prompt', { id: 'jr-' + f.key + '-prompt' }, f.prompt);
      var ta = ui.el('textarea.jr-textarea', {
        id: 'jr-' + f.key,
        rows: 5,
        placeholder: f.placeholder,
        'aria-describedby': 'jr-' + f.key + '-prompt',
        spellcheck: 'true'
      });
      ta.addEventListener('input', onInput);
      fields[f.key] = ta;
      block.appendChild(blockHead);
      block.appendChild(prompt);
      block.appendChild(ta);
      grid.appendChild(block);
    });

    card.appendChild(head);
    card.appendChild(grid);
    card.appendChild(ui.el('div.jr-foot.hint',
      'Perubahan tersimpan otomatis di perangkat ini. Tidak ada catatan yang dikirim ke internet.'));
    host.appendChild(card);
  }

  function updateSummary() {
    var s = JF.journal.summary(app.rawState(), selected);
    if (!s) return;
    els.stat_done.v.textContent = String(s.completed);
    els.stat_done.u.textContent = s.completed ? 'tugas selesai' : 'Belum ada yang selesai';
    els.stat_focus.v.textContent = s.focusSec > 0 ? ui.fmt.durShort(s.focusSec) : '-';
    els.stat_focus.u.textContent = s.focusSec > 0 ? 'fokus tercatat' : 'Belum ada sesi fokus';
    els.stat_sessions.v.textContent = String(s.sessions);
    els.stat_sessions.u.textContent = s.sessions ? 'sesi fokus selesai' : 'Belum ada sesi fokus';

    if (s.hasSnapshot) {
      els.dataNote.hidden = false;
      els.dataNote.className = 'chip ' + (s.complete ? 'ok' : 'warn');
      els.dataNote.textContent = s.complete ? 'Laporan final' : 'Data tidak lengkap';
    } else if (selected === app.today()) {
      els.dataNote.hidden = false;
      els.dataNote.className = 'chip lilac';
      els.dataNote.textContent = 'Berjalan';
    } else {
      els.dataNote.hidden = true;
    }
  }

  function updateChrome(entry) {
    els.dateTitle.textContent = ui.fmt.date(selected);
    els.dateRel.textContent = ui.dayRel(selected) + '  ·  catatan refleksi harian';
    els.dateInput.value = selected;
    els.todayBtn.disabled = selected === app.today();
    if (entry === undefined) entry = JF.journal.entryFor(app.rawState(), selected);
    els.editorHint.textContent = entry
      ? 'Terakhir diperbarui ' + ui.fmt.time(entry.updatedAt) + '.'
      : 'Belum ada catatan untuk tanggal ini. Mulai dari bagian mana pun.';
    updateSummary();
  }

  function load(day) {
    selected = day;
    loadedDay = day;
    var entry = JF.journal.entryFor(app.rawState(), day);
    FIELDS.forEach(function (f) {
      fields[f.key].value = entry ? (entry[f.key] || '') : '';
    });
    baseContent = contentOf(entry);
    lastSavedAt = entry && entry.updatedAt != null ? entry.updatedAt : null;
    updateChrome(entry);
    if (entry) setSaveStatus('saved', 'Tersimpan · ' + ui.fmt.time(entry.updatedAt || Date.now()));
    else setSaveStatus('idle', 'Belum ada perubahan');
  }

  function saveNow() {
    if (switching || !selected) return;
    saver.schedule(selected, read());
    saver.flush().then(function (ok) {
      if (ok) ui.toast('Catatan tersimpan.', { kind: 'ok', timeout: 1400 });
      else ui.toast('Gagal menyimpan catatan. Periksa ruang penyimpanan lalu coba lagi.', { kind: 'err', timeout: 9000 });
    });
  }

  function requestSelect(day) {
    if (!validDay(day) || switching) return;
    if (day === selected && loadedDay === day) { setHash(day); return; }

    function apply() { load(day); setHash(day); }

    if (saver && saver.isDirty()) {
      switching = true;
      setSaveStatus('saving', 'Menyimpan...');
      saver.flush().then(function (ok) {
        switching = false;
        if (!ok) {
          setSaveStatus('error', 'Gagal menyimpan', 'Catatan belum tersimpan. Coba simpan lagi.');
          setHash(selected);
          ui.toast('Tanggal belum dipindahkan karena catatan Anda belum tersimpan.', { kind: 'err', timeout: 9000 });
          return;
        }
        apply();
      });
    } else apply();
  }

  function render() {
    if (!host) return;
    var target = targetDay();
    if (target !== selected) { requestSelect(target); return; }
    if (loadedDay !== selected) { load(selected); return; }
    var entry = JF.journal.entryFor(app.rawState(), selected);
    if (!saver.isDirty() && !sameContent(contentOf(entry), baseContent)) {
      load(selected);
      return;
    }
    updateChrome(entry);
  }

  function bindLifecycle() {
    function flushNow() { if (saver && saver.isDirty()) saver.flush(); }

    root.addEventListener('beforeunload', flushNow);
    root.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', function () { if (document.hidden) flushNow(); });

    root.addEventListener('hashchange', function () {
      var id = (location.hash || '').replace(/^#/, '').split('?')[0] || 'beranda';
      if (id === 'jurnal' || !saver || !saver.isDirty()) return;
      saver.flush().then(function (ok) {
        if (ok) return;
        // Use a real hash change so boot routes back to the still-unsaved editor.
        location.hash = '#jurnal?date=' + selected;
        ui.toast('Catatan belum tersimpan. Halaman dikembalikan ke Journaling.', { kind: 'err', timeout: 9000 });
      });
    });
  }

  function mount(container) {
    ui = JF.ui; app = JF.app; host = container;
    selected = app.today();
    saver = JF.journal.createAutosave({ delay: 650, save: persist, onStatus: function (status, meta) {
      if (!meta || meta.day !== selected) return;
      if (status === 'saving') setSaveStatus('saving', 'Menyimpan...');
      else if (status === 'saved') setSaveStatus('saved', 'Tersimpan' + (lastSavedAt ? ' · ' + ui.fmt.time(lastSavedAt) : ''));
      else if (status === 'error') setSaveStatus('error', 'Gagal menyimpan', 'Catatan belum tersimpan. Coba simpan lagi.');
    } });

    buildHeader();
    buildSummary();
    buildEditor();
    bindLifecycle();
    load(targetDay());
    setHash(selected);
  }

  JF.pages.register({
    id: 'jurnal',
    title: 'Journaling',
    sub: function () {
      return 'Refleksi harian: catat pencapaian, tantangan, pelajaran, dan rencana besok.';
    },
    mount: mount,
    render: render
  });
})(typeof self !== 'undefined' ? self : this);
