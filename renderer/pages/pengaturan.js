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

    container.appendChild(sessionCard());
    container.appendChild(targetCard());
    container.appendChild(pomoCard());
    container.appendChild(musicCard());
    container.appendChild(miniCard());
    container.appendChild(dataCard());

    // Refresh track names while audio state changes (hook once per app run).
    if (!musicHooked) {
      musicHooked = true;
      app.on('music', function () {
        if (location.hash === '#pengaturan') render();
      });
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

  /* ── Sesi & timer ─────────────────────────────────────────────────── */
  function sessionCard() {
    var s = st();
    var c = ui.el('div.card');
    c.appendChild(ui.el('h2', 'Sesi & timer'));
    c.appendChild(ui.el('div.sub', 'Durasi bawaan untuk sesi fokus tanpa task dan task baru.'));
    var g = ui.el('div.grid.cols-2');
    g.appendChild(numField('Durasi sesi fokus bawaan (menit)', Math.round((s.settings.defaultFocusSec || 1500) / 60),
      1, 600, function (v) { setSetting('defaultFocusSec', v * 60, 'Durasi sesi'); },
      'Task yang sudah dibuat memakai durasinya sendiri; ubah lewat "Ubah" di halaman Tugas.'));
    g.appendChild(ui.el('div'));
    c.appendChild(g);
    c.appendChild(toggle('Peringatan 8 detik sebelum sesi selesai', s.settings.warn8, function (v) {
      setSetting('warn8', v, 'Peringatan 8 detik');
    }, 'Bunyi pendek + notifikasi ke kartu mini.'));
    return c;
  }

  /* ── Target harian ────────────────────────────────────────────────── */
  function targetCard() {
    var s = st();
    var c = ui.el('div.card');
    c.appendChild(ui.el('h2', 'Target fokus harian'));
    c.appendChild(ui.el('div.sub', 'Target menit fokus resmi per hari. Tanggal tertentu bisa ditimpa tanpa mengubah hari lain.'));
    var cur = JF.store.focusTargetFor(s, app.today());
    var g = ui.el('div.grid.cols-3', { style: { alignItems: 'end' } });

    var defInput = ui.el('input', { type: 'number', min: 1, max: 1440, value: cur.min || '' , placeholder: 'mis. 120' });
    g.appendChild(ui.el('label.field', 'Target bawaan (menit/hari)', defInput,
      ui.el('span.hint', cur.source === 'unknown' ? 'Belum diatur — Analitik akan menampilkan "target tidak diketahui".' : 'Berlaku untuk semua hari tanpa override.')));

    var ovrDate = ui.el('input', { type: 'date', value: app.today() });
    g.appendChild(ui.el('label.field', 'Tanggal override', ovrDate));
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
    btnRow.appendChild(ui.btn('Terapkan override tanggal', function () {
      var d = ovrDate.value, v = Math.round(Number(ovrMin.value));
      var r = JF.store.setFocusTargetOverride(st(), d, v, Date.now());
      if (!r.ok) { ui.toast('Tanggal/nilai tidak valid.', { kind: 'err' }); return; }
      app.save(); ui.toast('Target ' + ui.fmt.dateShort(d) + ': ' + ui.fmt.min(r.min) + ' (hari lain tidak berubah).', { kind: 'ok' });
      render();
    }, { ghost: true }));
    c.appendChild(btnRow);

    var ovr = Object.keys(s.settings.targetOverrides).sort().reverse();
    if (ovr.length) {
      c.appendChild(ui.el('div.section-label', 'Override tersimpan (' + ovr.length + ')'));
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
        'Menghapus override membuat tanggal itu memakai target bawaan. Laporan lama tidak berubah.'));
    }
    return c;
  }

  /* ── Pomodoro & jeda ──────────────────────────────────────────────── */
  function pomoCard() {
    var s = st();
    var c = ui.el('div.card');
    c.appendChild(ui.el('h2', 'Pomodoro & jeda'));
    c.appendChild(ui.el('div.sub', 'Mode lama tetap tersedia: setelah sesi selesai, jeda otomatis lalu lanjut ke task berikutnya.'));
    c.appendChild(toggle('Aktifkan mode pomodoro (jeda otomatis lalu lanjut)', s.settings.pomoOn, function (v) {
      setSetting('pomoOn', v, 'Mode pomodoro');
    }, s.settings.pomoOn ? 'Dengan mode ini sesi berikutnya dimulai otomatis setelah jeda — pilihanmu sendiri.' : ''));
    var g = ui.el('div.grid.cols-2', { style: { marginTop: '12px' } });
    g.appendChild(numField('Jeda pendek (menit)', s.settings.shortBreakMin, 1, 60,
      function (v) { setSetting('shortBreakMin', v, 'Jeda pendek'); }));
    g.appendChild(numField('Jeda panjang (menit)', s.settings.longBreakMin, 1, 120,
      function (v) { setSetting('longBreakMin', v, 'Jeda panjang'); }));
    g.appendChild(numField('Jeda panjang tiap N sesi', s.settings.longBreakEvery, 2, 12,
      function (v) { setSetting('longBreakEvery', v, 'Interval jeda panjang'); }));
    g.appendChild(numField('Target task per hari (streak)', s.settings.tasksPerDay, 1, 50,
      function (v) { setSetting('tasksPerDay', v, 'Target task harian'); },
      'Dipakai perhitungan streak di Beranda.'));
    c.appendChild(g);
    return c;
  }

  /* ── Alarm & musik ────────────────────────────────────────────────── */
  function musicCard() {
    var c = ui.el('div.card');
    c.appendChild(ui.el('h2', 'Alarm & musik'));
    c.appendChild(ui.el('div.sub', 'Tetap memakai beep bawaan jika tidak ada lagu pilihanmu.'));

    var fileF = ui.el('input', { type: 'file', accept: 'audio/*', hidden: true });
    var fileR = ui.el('input', { type: 'file', accept: 'audio/*', hidden: true });
    fileF.addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (f) { app.music.pickFocus(f, f.name); ui.toast('Lagu sesi fokus disimpan.', { kind: 'ok' }); render(); }
      this.value = '';
    });
    fileR.addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (f) { app.music.pickBreak(f, f.name); ui.toast('Lagu jeda disimpan.', { kind: 'ok' }); render(); }
      this.value = '';
    });

    function trackBlock(title, name, pick, test, del) {
      var b = ui.el('div', { style: { marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--line)' } });
      b.appendChild(ui.el('div.k', { style: { fontSize: '11.5px', color: 'var(--text-3)', fontWeight: '650' } }, title));
      b.appendChild(ui.el('div', { style: { fontSize: '13.5px', fontWeight: '600', margin: '3px 0 8px' } }, name));
      var r = ui.el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } });
      r.appendChild(ui.btn('Pilih lagu', pick, { sm: true }));
      r.appendChild(ui.btn('Tes', test, { sm: true, ghost: true }));
      r.appendChild(ui.btn('Pakai beep', del, { sm: true, ghost: true }));
      r.appendChild(ui.btn('Hentikan', function () { app.music.stopAllMusic(); }, { sm: true, ghost: true }));
      b.appendChild(r);
      return b;
    }

    c.appendChild(trackBlock('Saat sesi fokus selesai', app.music.focusName,
      function () { fileF.click(); }, function () { app.music.testFocus(); }, function () {
        app.music.clearFocus(); ui.toast('Balik ke beep bawaan.'); render();
      }));
    c.appendChild(trackBlock('Saat jeda selesai', app.music.breakName,
      function () { fileR.click(); }, function () { app.music.testBreak(); }, function () {
        app.music.clearBreak(); ui.toast('Balik ke beep bawaan.'); render();
      }));

    c.appendChild(toggle('Ulangi lagu selama alarm berbunyi', app.music.loop, function (v) {
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

  /* ── Data & cadangan ──────────────────────────────────────────────── */
  function dataCard() {
    var s = st();
    var c = ui.el('div.card');
    c.appendChild(ui.el('h2', 'Data & cadangan'));
    c.appendChild(ui.el('div.sub', 'Semua data tersimpan lokal di perangkat. Tidak ada yang dikirim ke internet.'));

    var g = ui.el('div.grid.cols-2');
    var info = ui.el('div');
    info.appendChild(ui.el('div.mini-task', ui.el('span.mt-name', 'Skema data'), ui.el('span.chip.accent', 'v' + (s.version || 2))));
    info.appendChild(ui.el('div.mini-task', ui.el('span.mt-name', 'Task'), ui.el('span.chip', String(s.tasks.length))));
    info.appendChild(ui.el('div.mini-task', ui.el('span.mt-name', 'Sesi fokus'), ui.el('span.chip', String(s.sessions.length))));
    info.appendChild(ui.el('div.mini-task', ui.el('span.mt-name', 'Laporan harian'), ui.el('span.chip', String(s.snapshots.length))));
    g.appendChild(info);

    var bk = ui.el('div');
    var hasBackup = false;
    try { hasBackup = !!localStorage.getItem('jamfokus.v1.backup'); } catch (e) {}
    var hasV1 = false;
    try { hasV1 = !!localStorage.getItem('jamfokus.v1'); } catch (e) {}
    bk.appendChild(ui.el('div.mini-task', ui.el('span.mt-name', 'Cadangan data lama'),
      ui.el('span.chip' + (hasBackup ? '.ok' : ''), hasBackup ? 'Tersimpan' : 'Tidak ada')));
    bk.appendChild(ui.el('div.mini-task', ui.el('span.mt-name', 'Kunci asli jamfokus.v1'),
      ui.el('span.chip' + (hasV1 ? '.ok' : '.outline'), hasV1 ? 'Dipertahankan' : 'Tidak ada')));
    bk.appendChild(ui.el('div.hint', { style: { marginTop: '6px' } },
      'Migrasi v1 → v2 bersifat idempoten; data lama tidak pernah dihapus.'));
    g.appendChild(bk);
    c.appendChild(g);

    var exp = ui.btn('Ekspor cadangan JSON', function () {
      try {
        var payload = JSON.stringify({ app: 'jam-fokus', exportedAt: new Date().toISOString(), state: st() }, null, 2);
        var blob = new Blob([payload], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'jam-fokus-cadangan-' + app.today() + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        ui.toast('Cadangan diunduh.', { kind: 'ok' });
      } catch (e) {
        ui.toast('Gagal mengekspor: ' + e.message, { kind: 'err' });
      }
    }, { ghost: true });
    exp.style.marginTop = '14px';
    c.appendChild(exp);
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
