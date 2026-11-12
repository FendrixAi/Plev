/* Jam Fokus — Pengaturan: session durations, daily focus targets (+ per-date
   overrides), pomodoro/breaks, alarm & music (legacy features preserved),
   mini-card appearance (same IPC as before), data backup export. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app, host;

  var musicHooked = false;

  function mount(container) {
    ui = JF.ui; app = JF.app; host = container;

    container.appendChild(experienceCard());
    container.appendChild(sessionCard());
    container.appendChild(targetCard());
    container.appendChild(pomoCard());
    container.appendChild(musicCard());
    container.appendChild(miniCard());
    container.appendChild(updateCard());
    container.appendChild(dataCard());

    // Refresh track names while audio state changes (hook once per app run).
    if (!musicHooked) {
      musicHooked = true;
      app.on('music', function () {
        if (location.hash === '#pengaturan') render();
      });
    }

    function experienceCard() {
      var c = ui.el('div.card');
      c.appendChild(ui.el('h2', 'Experience'));
      c.appendChild(ui.el('div.sub', 'Data dan fitur produktivitas tetap sama; yang berubah hanya pengalaman visual aplikasi.'));
      var select = ui.el('select', { 'aria-label': 'Experience aplikasi' });
      select.appendChild(ui.el('option', { value: 'original' }, 'Original'));
      select.appendChild(ui.el('option', { value: 'capybara-world' }, 'Capybara World'));
      select.appendChild(ui.el('option', { value: 'mola-world' }, 'Mola World (siang)'));
      select.appendChild(ui.el('option', { value: 'fast-food' }, 'Fast Food (siang & malam)'));
      select.value = JF.homeExperience.get();
      select.addEventListener('change', function () {
        try {
          JF.homeExperience.set(select.value);
          ui.toast('Experience tersimpan.', { kind: 'ok' });
        } catch (error) {
          select.value = JF.homeExperience.get();
          ui.toast('Experience tidak dapat disimpan: ' + error.message, { kind: 'err' });
        }
      });
      c.appendChild(ui.el('label.field', 'Pilih experience', select));
      return c;
    }
  }

  function st() { return app.rawState(); }
  function setSetting(key, val, label) {
    var s = st();
    s.settings[key] = val;
    JF.store.ev(s, Date.now(), 'settings.changed', null, { key: key, val: val });
    app.save();
    if (label) ui.toast(label + ' disimpan.', { kind: 'ok', timeout: 1800 });
  }

  function numField(labelText, value, min, max, onValid, hint) {
    var input = ui.el('input', { type: 'number', min: min, max: max, value: value });
    var wrap = ui.el('label.field', labelText, input);
    if (hint) wrap.appendChild(ui.el('span.hint', hint));
    input.addEventListener('change', function () {
      var v = Math.round(Number(input.value));
      if (!isFinite(v) || v < min || v > max) {
        ui.toast('Nilai harus antara ' + min + '–' + max + '.', { kind: 'err' });
        input.value = value;
        return;
      }
      onValid(v);
    });
    return wrap;
  }

  function toggle(labelText, checked, onChange, hint) {
    var box = ui.el('label.row', { style: { marginTop: '4px' } });
    var cb = ui.el('input', { type: 'checkbox' });
    cb.checked = !!checked;
    cb.addEventListener('change', function () { onChange(cb.checked); });
    box.appendChild(cb);
    box.appendChild(ui.el('span', labelText));
    var w = ui.el('div', box);
    if (hint) w.appendChild(ui.el('div.hint', { style: { marginLeft: '26px' } }, hint));
    return w;
  }

  /* ── Sesi & pengatur waktu ─────────────────────────────────────────────────── */
  function sessionCard() {
    var s = st();
    var c = ui.el('div.card');
    c.appendChild(ui.el('h2', 'Sesi & pengatur waktu'));
    c.appendChild(ui.el('div.sub', 'Durasi bawaan untuk sesi fokus tanpa tugas dan tugas baru.'));
    var g = ui.el('div.grid.cols-2');
    g.appendChild(numField('Durasi sesi fokus bawaan (menit)', Math.round((s.settings.defaultFocusSec || 1500) / 60),
      1, 600, function (v) { setSetting('defaultFocusSec', v * 60, 'Durasi sesi'); },
      'Tugas yang sudah dibuat memakai durasinya sendiri; ubah lewat "Ubah" di halaman Tugas.'));
    g.appendChild(ui.el('div'));
    c.appendChild(g);
    c.appendChild(toggle('Peringatan 8 detik sebelum sesi selesai', s.settings.warn8, function (v) {
      setSetting('warn8', v, 'Peringatan 8 detik');
    }, 'Bunyi pendek + notifikasi ke kartu mini; tetap berbunyi meskipun suara penyelesaian dimatikan.'));
    return c;
  }

  /* ── Target harian ────────────────────────────────────────────────── */
  function targetCard() {
    var s = st();
    var c = ui.el('div.card');
    c.appendChild(ui.el('h2', 'Target fokus harian'));
    c.appendChild(ui.el('div.sub', 'Target menit fokus per hari. Tanggal tertentu bisa ditimpa tanpa mengubah hari lain.'));
    var cur = JF.store.focusTargetFor(s, app.today());
    var g = ui.el('div.grid.cols-3', { style: { alignItems: 'end' } });

    var defInput = ui.el('input', { type: 'number', min: 1, max: 1440, value: cur.min || '' , placeholder: 'mis. 120' });
    g.appendChild(ui.el('label.field', 'Target bawaan (menit/hari)', defInput,
      ui.el('span.hint', cur.source === 'unknown' ? 'Belum diatur — Analitik akan menampilkan "target tidak diketahui".' : 'Berlaku untuk semua hari tanpa target khusus.')));

    var ovrDate = ui.el('input', { type: 'date', value: app.today() });
    g.appendChild(ui.el('label.field', 'Tanggal khusus', ovrDate));
    var ovrMin = ui.el('input', { type: 'number', min: 1, max: 1440, value: cur.min || '' });
    var ovrWrap = ui.el('label.field', 'Target khusus (menit)', ovrMin);
    g.appendChild(ovrWrap);
    c.appendChild(g);

    var btnRow = ui.el('div', { style: { display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' } });
    btnRow.appendChild(ui.btn('Simpan target bawaan', function () {
      var v = Math.round(Number(defInput.value));
      var r = JF.store.setFocusTargetDefault(st(), v, Date.now());
      if (!r.ok) { ui.toast('Target harus angka positif (1–1440 menit).', { kind: 'err' }); return; }
      app.save(); ui.toast('Target bawaan: ' + ui.fmt.min(r.min) + '.', { kind: 'ok' });
      render();
    }, { primary: true }));
    btnRow.appendChild(ui.btn('Terapkan target khusus', function () {
      var d = ovrDate.value, v = Math.round(Number(ovrMin.value));
      var r = JF.store.setFocusTargetOverride(st(), d, v, Date.now());
      if (!r.ok) { ui.toast('Tanggal/nilai tidak valid.', { kind: 'err' }); return; }
      app.save(); ui.toast('Target ' + ui.fmt.dateShort(d) + ': ' + ui.fmt.min(r.min) + ' (hari lain tidak berubah).', { kind: 'ok' });
      render();
    }, { ghost: true }));
    c.appendChild(btnRow);

    var ovr = Object.keys(s.settings.targetOverrides).sort().reverse();
    if (ovr.length) {
      c.appendChild(ui.el('div.section-label', 'Target khusus tersimpan (' + ovr.length + ')'));
      var list = ui.el('div');
      ovr.forEach(function (d) {
        var row = ui.el('div.mini-task');
        row.appendChild(ui.el('span.mt-name', ui.fmt.date(d)));
        row.appendChild(ui.el('span.chip.accent', ui.fmt.min(s.settings.targetOverrides[d])));
        var del = ui.btn('Hapus', function () {
          JF.store.clearFocusTargetOverride(st(), d, Date.now());
          app.save(); render();
        }, { sm: true, ghost: true });
        row.appendChild(del);
        list.appendChild(row);
      });
      c.appendChild(list);
      c.appendChild(ui.el('div.hint', { style: { marginTop: '6px' } },
        'Menghapus target khusus membuat tanggal itu memakai target bawaan. Laporan lama tidak berubah.'));
    }
    return c;
  }

  /* ── Pomodoro & jeda ──────────────────────────────────────────────── */
  function pomoCard() {
    var s = st();
    var c = ui.el('div.card');
    c.appendChild(ui.el('h2', 'Pomodoro & istirahat'));
    c.appendChild(ui.el('div.sub', 'Setelah sesi selesai, istirahat dimulai otomatis lalu lanjut ke tugas berikutnya.'));
    c.appendChild(toggle('Aktifkan mode pomodoro (istirahat otomatis lalu lanjut)', s.settings.pomoOn, function (v) {
      setSetting('pomoOn', v, 'Mode pomodoro');
    }, s.settings.pomoOn ? 'Sesi berikutnya dimulai otomatis setelah istirahat selesai.' : ''));
    var g = ui.el('div.grid.cols-2', { style: { marginTop: '12px' } });
    g.appendChild(numField('Istirahat pendek (menit)', s.settings.shortBreakMin, 1, 60,
      function (v) { setSetting('shortBreakMin', v, 'Istirahat pendek'); }));
    g.appendChild(numField('Istirahat panjang (menit)', s.settings.longBreakMin, 1, 120,
      function (v) { setSetting('longBreakMin', v, 'Istirahat panjang'); }));
    g.appendChild(numField('Istirahat panjang tiap N sesi', s.settings.longBreakEvery, 2, 12,
      function (v) { setSetting('longBreakEvery', v, 'Interval istirahat panjang'); }));
    g.appendChild(numField('Target tugas per hari (rentetan)', s.settings.tasksPerDay, 1, 50,
      function (v) { setSetting('tasksPerDay', v, 'Target tugas harian'); },
      'Dipakai perhitungan rentetan hari di Beranda.'));
    c.appendChild(g);
    return c;
  }

  /* ── Alarm & musik ────────────────────────────────────────────────── */
  function musicCard() {
    var c = ui.el('div.card');
    c.appendChild(ui.el('h2', 'Alarm & musik'));
    c.appendChild(ui.el('div.sub', 'Memakai bunyi bawaan jika belum ada lagu yang dipilih.'));

    var fileF = ui.el('input', { type: 'file', accept: 'audio/*', multiple: true, hidden: true, 'aria-label': 'Tambah musik ke playlist' });
    var fileR = ui.el('input', { type: 'file', accept: 'audio/*', hidden: true, 'aria-label': 'Pilih lagu untuk akhir istirahat' });
    var REASON = { duplikat: 'sudah ada', 'bukan-audio': 'bukan file audio', kosong: 'file kosong', 'terlalu-besar': 'terlalu besar (maks. 150 MB)', penuh: 'playlist penuh (maks. 50 lagu)' };
    fileF.addEventListener('change', function () {
      var files = Array.prototype.slice.call(this.files || []);
      this.value = '';
      if (!files.length) return;
      app.music.addTracks(files).then(function (r) {
        if (r.added.length) ui.toast(r.added.length === 1 ? '1 lagu ditambahkan ke playlist.' : r.added.length + ' lagu ditambahkan ke playlist.', { kind: 'ok' });
        if (r.added.length && !r.persisted) ui.toast('Playlist belum tersimpan permanen; lagu akan hilang setelah aplikasi ditutup.', { kind: 'err', timeout: 8000 });
        if (r.rejected.length) ui.toast(r.rejected.map(function (x) { return x.name + ': ' + (REASON[x.reason] || x.reason); }).join(' · '), { kind: 'err', timeout: 8000 });
        render();
      });
    });
    fileR.addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (f) { app.music.pickBreak(f, f.name); ui.toast('Lagu istirahat disimpan.', { kind: 'ok' }); render(); }
      this.value = '';
    });

    function playlistBlock() {
      var m = app.music, st = m.status || { active: false }, list = m.tracks || [];
      var b = ui.el('div.pl', { style: { marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--line)' } });
      b.appendChild(ui.el('div.k', { style: { fontSize: '12px', color: 'var(--muted)', fontWeight: '600' } }, 'Musik saat sesi fokus selesai dan istirahat'));
      b.appendChild(ui.el('div.hint', { style: { margin: '3px 0 8px' } }, list.length
        ? 'Playlist diputar berurutan dan diulang otomatis selama istirahat. Musik hanya berhenti saat Anda menekan Hentikan Musik atau istirahat selesai.'
        : 'Belum ada lagu. Tanpa lagu, dipakai bunyi bawaan.'));
      if (list.length) {
        var ul = ui.el('ol.pl-list', { 'aria-label': 'Daftar putar' });
        list.forEach(function (t, i) {
          var now = st.active && st.trackId === t.id;
          var li = ui.el('li.pl-item' + (now ? '.on' : ''));
          li.appendChild(ui.el('span.pl-no', String(i + 1)));
          var info = ui.el('span.pl-info');
          info.appendChild(ui.el('span.pl-name', t.name));
          if (t.missing) info.appendChild(ui.el('span.chip.danger', 'File hilang'));
          else if (now) info.appendChild(ui.el('span.chip.ok', st.paused ? 'Dijeda' : 'Sedang diputar'));
          li.appendChild(info);
          var act = ui.el('span.pl-acts');
          act.appendChild(ui.btn(now && !st.paused ? 'Putar ulang' : 'Putar', function () { m.play(t.id); }, { sm: true, ghost: true, disabled: !!t.missing }));
          act.appendChild(ui.btn('Hapus', function () {
            m.removeTrack(t.id).then(function () { ui.toast('Lagu dihapus dari playlist.'); render(); });
          }, { sm: true, ghost: true }));
          li.appendChild(act);
          ul.appendChild(li);
        });
        b.appendChild(ul);
      }
      var r = ui.el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' } });
      r.appendChild(ui.btn('Tambah Musik', function () { fileF.click(); }, { sm: true }));
      if (list.length) {
        r.appendChild(ui.btn(st.active ? (st.paused ? 'Lanjutkan' : 'Jeda') : 'Putar playlist', function () {
          if (st.active) m.togglePause(); else m.play(null);
        }, { sm: true, ghost: true }));
        r.appendChild(ui.btn('Berikutnya', function () { m.next(); }, { sm: true, ghost: true, disabled: !st.active }));
        r.appendChild(ui.btn('Hentikan Musik', function () { m.stopAllMusic(); }, { sm: true, ghost: true, disabled: !st.active }));
        r.appendChild(ui.btn('Kosongkan playlist', function () {
          ui.confirm({ title: 'Kosongkan playlist?', body: 'Semua lagu dihapus dari playlist Jam Fokus. File asli di komputer Anda tidak disentuh.', okLabel: 'Kosongkan', danger: true }).then(function (yes) {
            if (yes) m.clearPlaylist().then(function () { ui.toast('Playlist dikosongkan.'); render(); });
          });
        }, { sm: true, ghost: true }));
      }
      b.appendChild(r);
      return b;
    }

    function trackBlock(title, name, pick, test, del) {
      var b = ui.el('div', { style: { marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--line)' } });
      b.appendChild(ui.el('div.k', { style: { fontSize: '12px', color: 'var(--muted)', fontWeight: '600' } }, title));
      b.appendChild(ui.el('div', { style: { fontSize: '14px', fontWeight: '600', margin: '3px 0 8px' } }, name));
      var r = ui.el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });
      r.appendChild(ui.btn('Pilih lagu', pick, { sm: true }));
      r.appendChild(ui.btn('Tes', test, { sm: true, ghost: true }));
      r.appendChild(ui.btn('Pakai bunyi bawaan', del, { sm: true, ghost: true }));
      r.appendChild(ui.btn('Hentikan', function () { app.music.stopAllMusic(); }, { sm: true, ghost: true }));
      b.appendChild(r);
      return b;
    }

    /* Suara penyelesaian: pilihan eksplisit per kanal (beep / lagu / tanpa suara). */
    function modeBlock(title, mode, setMode, hasSong, test) {
      var b = ui.el('div', { style: { marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--line)' } });
      b.appendChild(ui.el('div.k', { style: { fontSize: '12px', color: 'var(--muted)', fontWeight: '600' } }, title));
      var r = ui.el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', margin: '6px 0 0' } });
      var seg = ui.el('div.seg', { role: 'group', 'aria-label': title });
      [['beep', 'Pakai beep'], ['custom', 'Pakai lagu'], ['none', 'Tanpa suara']].forEach(function (o) {
        var btn = ui.el('button', { type: 'button', 'aria-pressed': mode === o[0] ? 'true' : 'false',
          disabled: o[0] === 'custom' && !hasSong,
          onclick: function () { setMode(o[0]); render(); } }, o[1]);
        if (mode === o[0]) btn.classList.add('on');
        seg.appendChild(btn);
      });
      r.appendChild(seg);
      r.appendChild(ui.btn('Tes', function () {
        if (test() === false) ui.toast('Mode Tanpa suara aktif, jadi tidak ada bunyi.', { timeout: 2500 });
      }, { sm: true, ghost: true }));
      b.appendChild(r);
      return b;
    }
    function completionBlock() {
      var m = app.music;
      var b = ui.el('div');
      b.appendChild(ui.el('h3', { style: { fontSize: '14px', margin: '0 0 2px' } }, 'Suara penyelesaian'));
      b.appendChild(ui.el('div.hint', { style: { margin: '0 0 8px' } },
        'Hanya berbunyi saat sesi atau istirahat selesai. Tidak ada musik latar selama sesi fokus.'));
      b.appendChild(modeBlock('Saat sesi fokus selesai', m.focusMode, function (v) { m.setFocusMode(v); },
        m.hasTracks(), function () { return app.music.testFocus(); }));
      b.appendChild(modeBlock('Saat istirahat selesai', m.breakMode, function (v) { m.setBreakMode(v); },
        m.hasBreakTrack(), function () { return app.music.testBreak(); }));
      return b;
    }

    c.appendChild(completionBlock());
    c.appendChild(playlistBlock());
    c.appendChild(trackBlock('Saat istirahat selesai', app.music.breakName,
      function () { fileR.click(); }, function () { app.music.testBreak(); }, function () {
        app.music.clearBreak(); ui.toast('Kembali ke bunyi bawaan.'); render();
      }));

    c.appendChild(toggle('Ulangi playlist di luar istirahat (saat istirahat selalu diulang)', app.music.loop, function (v) {
      app.music.setLoop(v);
      ui.toast('Pengulangan lagu ' + (v ? 'aktif' : 'nonaktif') + '.', { timeout: 1500 });
    }));

    c.appendChild(ui.el('div', {}, fileF, fileR));
    return c;
  }

  /* ── Kartu mini ───────────────────────────────────────────────────── */
  function miniCard() {
    var c = ui.el('div.card');
    c.appendChild(ui.el('h2', 'Kartu mini'));
    c.appendChild(ui.el('div.sub', 'Transparansi dan perilaku kartu saat kursor di atasnya.'));

    var slider = ui.el('input', { type: 'range', min: 40, max: 100, value: 100, style: { width: '160px' } });
    var val = ui.el('span', { style: { fontSize: '13px', fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' } }, '100%');
    var solid = ui.el('input', { type: 'checkbox' });

    var row1 = ui.el('label.row', { style: { marginTop: '6px' } }, 'Transparansi', slider, val);
    c.appendChild(row1);
    var row2 = ui.el('label.row', { style: { marginTop: '8px' } }, solid, 'Solid saat kursor di atas kartu');
    c.appendChild(row2);
    var hint = ui.el('div.hint', { style: { marginTop: '6px' } }, 'Pengaturan disimpan perangkat, sama seperti sebelumnya.');
    c.appendChild(hint);

    if (!root.desk || !root.desk.getMiniSettings) {
      c.appendChild(ui.el('div.hint.warn', 'Kontrol kartu mini tidak tersedia di lingkungan ini.'));
      return c;
    }
    root.desk.getMiniSettings().then(function (s) {
      s = s || {};
      var pct = Math.round((s.opacity != null ? s.opacity : 1) * 100);
      slider.value = pct; val.textContent = pct + '%';
      solid.checked = !!s.solidOnHover;
    }).catch(function () {});
    slider.addEventListener('input', function () { val.textContent = slider.value + '%'; });
    slider.addEventListener('change', function () {
      root.desk.saveMiniSettings({ opacity: Number(slider.value) / 100 });
    });
    solid.addEventListener('change', function () {
      root.desk.saveMiniSettings({ solidOnHover: solid.checked });
    });
    return c;
  }

  /* ── Pembaruan aplikasi ───────────────────────────────────────────── */
  function updateCard() {
    var c = ui.el('div.card');
    c.appendChild(ui.el('h2', 'Pembaruan aplikasi'));
    c.appendChild(ui.el('div.sub', 'Unduh, pasang, dan restart otomatis. Datamu dicadangkan lebih dulu.'));
    if (JF.updateUI) c.appendChild(JF.updateUI.mount());
    return c;
  }

  /* ── Data & cadangan ──────────────────────────────────────────────── */
  function dataCard() {
    var s = st();
    var c = ui.el('div.card');
    c.appendChild(ui.el('h2', 'Data & cadangan'));
    c.appendChild(ui.el('div.sub', 'Semua data tersimpan lokal di perangkat. Tidak ada yang dikirim ke internet.'));

    var g = ui.el('div.grid.cols-2');
    var info = ui.el('div');
    info.appendChild(ui.el('div.mini-task', ui.el('span.mt-name', 'Versi data'), ui.el('span.chip.accent', 'v' + (s.version || 2))));
    info.appendChild(ui.el('div.mini-task', ui.el('span.mt-name', 'Tugas'), ui.el('span.chip', String(s.tasks.length))));
    info.appendChild(ui.el('div.mini-task', ui.el('span.mt-name', 'Sesi fokus'), ui.el('span.chip', String(s.sessions.length))));
    info.appendChild(ui.el('div.mini-task', ui.el('span.mt-name', 'Laporan harian'), ui.el('span.chip', String(s.snapshots.length))));
    info.appendChild(ui.el('div.mini-task', ui.el('span.mt-name', 'Catatan jurnal'), ui.el('span.chip', String(JF.journal.count(s)))));
    info.appendChild(ui.el('div.mini-task', ui.el('span.mt-name', 'Goals'), ui.el('span.chip', String(JF.goals.list(s).length))));
    g.appendChild(info);

    var bk = ui.el('div');
    var hasBackup = false;
    try { hasBackup = !!localStorage.getItem('jamfokus.v1.backup'); } catch (e) {}
    var hasV1 = false;
    try { hasV1 = !!localStorage.getItem('jamfokus.v1'); } catch (e) {}
    bk.appendChild(ui.el('div.mini-task', ui.el('span.mt-name', 'Cadangan data lama'),
      ui.el('span.chip' + (hasBackup ? '.ok' : ''), hasBackup ? 'Tersimpan' : 'Tidak ada')));
    bk.appendChild(ui.el('div.mini-task', ui.el('span.mt-name', 'Data versi lama (v1)'),
      ui.el('span.chip' + (hasV1 ? '.ok' : '.outline'), hasV1 ? 'Dipertahankan' : 'Tidak ada')));
    bk.appendChild(ui.el('div.hint', { style: { marginTop: '6px' } },
      'Data versi lama tidak pernah dihapus saat pembaruan.'));
    g.appendChild(bk);
    c.appendChild(g);

    function downloadBackup(prefix) {
      var payload = JSON.stringify({ app: 'jam-fokus', exportedAt: new Date().toISOString(), state: st() }, null, 2);
      var blob = new Blob([payload], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = prefix + app.today() + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }
    function kb(n) { return Math.max(1, Math.round(n / 1024)).toLocaleString('id-ID') + ' KB'; }

    var use = app.storageUsage();
    var storage = ui.el('div.mini-task', ui.el('span.mt-name', 'Penyimpanan terpakai'),
      ui.el('span.chip' + (use.total > use.limit * 0.8 ? '.warn' : ''), kb(use.total) + ' dari ±' + kb(use.limit)));
    bk.appendChild(storage);

    var actions = ui.el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' } });
    var exp = ui.btn('Ekspor cadangan', function () {
      try { downloadBackup('jam-fokus-cadangan-'); ui.toast('Cadangan diunduh.', { kind: 'ok' }); }
      catch (e) { ui.toast('Gagal mengekspor: ' + e.message, { kind: 'err' }); }
    }, { ghost: true });
    actions.appendChild(exp);

    var fileIn = ui.el('input', { type: 'file', accept: '.json,application/json', 'aria-label': 'Pilih berkas cadangan' });
    fileIn.hidden = true;
    var imp = ui.btn('Pulihkan dari cadangan', function () { fileIn.click(); }, { ghost: true });
    fileIn.addEventListener('change', function () {
      var f = fileIn.files && fileIn.files[0];
      fileIn.value = '';
      if (!f) return;
      if (f.size > JF.backup.MAX_CHARS) { ui.toast('Berkas terlalu besar untuk dipulihkan.', { kind: 'err' }); return; }
      f.text().then(function (text) {
        var r = JF.backup.validate(text);
        if (!r.ok) { ui.toast(r.error, { kind: 'err', timeout: 8000 }); return; }
        var sm = r.summary;
        var when = sm.exportedAt ? ' (dibuat ' + new Date(sm.exportedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ')' : '';
        return ui.confirm({
          title: 'Pulihkan dari cadangan?',
          body: 'Cadangan berisi ' + sm.tasks + ' tugas, ' + sm.sessions + ' sesi fokus, dan ' + sm.snapshots + ' laporan harian' +
                (sm.journals ? ', serta ' + sm.journals + ' catatan jurnal' : '') +
                (sm.goals ? ', dan ' + sm.goals + ' goal' : '') + when + '. ' +
                'Data yang sekarang akan diganti. Salinan data saat ini diunduh otomatis lebih dulu sebagai pengaman.',
          okLabel: 'Ganti data', danger: true
        }).then(function (ok) {
          if (!ok) return;
          try { downloadBackup('jam-fokus-sebelum-pemulihan-'); } catch (e) { /* tetap lanjut; pengguna sudah mengonfirmasi */ }
          app.replaceState(r.state);
          ui.toast('Data berhasil dipulihkan dari cadangan.', { kind: 'ok' });
          render();
        });
      }).catch(function () { ui.toast('Berkas tidak bisa dibaca.', { kind: 'err' }); });
    });
    actions.appendChild(imp);
    actions.appendChild(fileIn);

    if (use.hasLegacy) {
      var clean = ui.btn('Hapus salinan data lama', function () {
        ui.confirm({
          title: 'Hapus salinan data lama?',
          body: 'Salinan data versi lama (v1) dan cadangannya akan dihapus untuk membebaskan sekitar ' + kb(use.legacy) + '. Data yang sedang dipakai tidak terpengaruh. Disarankan ekspor cadangan dulu.',
          okLabel: 'Hapus', danger: true
        }).then(function (ok) {
          if (!ok) return;
          var freed = app.removeLegacyCopies();
          ui.toast('Salinan lama dihapus (' + kb(freed) + ' dibebaskan).', { kind: 'ok' });
          render();
        });
      }, { ghost: true });
      actions.appendChild(clean);
    }
    c.appendChild(actions);
    return c;
  }

  function render() {
    if (!host) return;
    var y = host.scrollTop;
    ui.clear(host);
    mount(host);
    host.scrollTop = y;
  }

  JF.pages.register({
    id: 'pengaturan',
    title: 'Pengaturan',
    sub: 'Tersimpan otomatis di perangkat',
    mount: mount,
    render: function () { /* settings are static per mount; render() refreshes after changes */ }
  });

  // Re-expose an explicit refresh for internal use (self-render after edits).
  JF.pengaturanRefresh = render;
})(typeof self !== 'undefined' ? self : this);
