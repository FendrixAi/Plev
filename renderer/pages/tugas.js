/* Jam Fokus — Tugas: quick-add, lifecycle (selesai/urungkan/arsip/pulihkan),
   rescheduling with stable IDs, inline detail editing. */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app, host;
  var tab = 'aktif';
  var showDetails = false;
  var expandDone = false;
  var dateFilter = 'all';   // 'all' | 'late' | 'today' | 'tomorrow' | 'date'
  var pickedDate = '';      // dipakai saat dateFilter === 'date'
  var sel = {};             // id tugas yang dipilih (aksi massal)
  var formState = { title: '', date: '', desc: '', priority: 'normal', min: null };

  function mount(container) {
    ui = JF.ui; app = JF.app; host = container;

    // Quick add
    var add = ui.el('div.card');
    var addHead = ui.el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' } });
    addHead.appendChild(ui.el('h2', 'Tambah tugas cepat'));
    var bulkBtn = ui.btn('Tambah Banyak Tugas', openBulkModal, { ghost: true, sm: true });
    bulkBtn.id = 'btn-bulk-tasks';
    addHead.appendChild(bulkBtn);
    add.appendChild(addHead);
    add.appendChild(ui.el('div.sub', 'Setiap tugas wajib punya tanggal target. Detail lain opsional.'));
    var form = ui.el('form.add-form', { id: 'ta-form', onsubmit: submitQuick });
    form.appendChild(ui.el('input#ta-title', { 'aria-label': 'Judul tugas', placeholder: 'Judul tugas…', maxlength: 120, autocomplete: 'off', value: formState.title }));
    form.appendChild(ui.el('input#ta-date', { 'aria-label': 'Tanggal target', type: 'date', value: formState.date || app.today() }));
    var addBtn = ui.btn('Tambah', null, { primary: true });
    addBtn.type = 'submit'; // tombol ini bagian dari <form>: harus submit, bukan type=button
    form.appendChild(addBtn);

    // Detail selalu ter-mount dan hanya disembunyikan. Dengan begitu nilai yang
    // sudah diketik (deskripsi, prioritas, durasi) tidak hilang saat panel
    // dibuka/ditutup berulang kali sebelum menekan Tambah.
    var det = ui.el('div.form-grid', { id: 'ta-details', style: { marginTop: '12px' } });
    det.appendChild(ui.el('label.field', 'Deskripsi (opsional)', ui.el('textarea#ta-desc', { placeholder: 'Catatan singkat…', maxlength: 2000 }, formState.desc)));
    var row = ui.el('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap' } });
    var pr = ui.el('label.field', 'Prioritas');
    var sel = ui.el('select#ta-pri');
    JF.model.PRIORITIES.forEach(function (p) {
      var o = ui.el('option', { value: p }, JF.model.PRIORITY_LABEL[p]);
      if (p === formState.priority) o.selected = true;
      sel.appendChild(o);
    });
    pr.appendChild(sel); row.appendChild(pr);
    var du = ui.el('label.field', 'Durasi fokus (menit)');
    du.appendChild(ui.el('input#ta-min', { 'aria-label': 'Durasi fokus (menit)', type: 'number', min: 1, max: 600, placeholder: 'bawaan', value: formState.min || '' }));
    row.appendChild(du);
    det.appendChild(row);
    det.hidden = !showDetails;

    var tog = ui.btn('', function () {
      showDetails = !showDetails;
      det.hidden = !showDetails;
      paintTog();
    }, { ghost: true });
    tog.id = 'ta-tog';
    tog.setAttribute('aria-controls', 'ta-details');
    function paintTog() {
      tog.textContent = showDetails ? '− Detail' : '+ Detail';
      tog.setAttribute('aria-expanded', String(showDetails));
    }
    paintTog();
    form.appendChild(tog);
    add.appendChild(form);
    add.appendChild(det);
    container.appendChild(add);

    // Tabs
    var tabs = ui.el('div.ta-toolbar');
    var tg = ui.el('div.tabs');
    var b1 = ui.btn('Aktif', function () { tab = 'aktif'; sel = {}; render(); });
    var b2 = ui.btn('Arsip', function () { tab = 'arsip'; sel = {}; render(); });
    b1.id = 'tab-aktif'; b2.id = 'tab-arsip';
    tg.appendChild(b1); tg.appendChild(b2);
    tabs.appendChild(tg);
    tabs.appendChild(ui.el('div.ta-filter', { id: 'ta-filter' }));
    container.appendChild(tabs);

    container.appendChild(ui.el('div', { id: 'ta-list' }));
  }

  function submitQuick(e) {
    e.preventDefault();
    var title = (document.getElementById('ta-title').value || '').trim();
    var date = document.getElementById('ta-date').value;
    var descEl = document.getElementById('ta-desc');
    var priEl = document.getElementById('ta-pri');
    var minEl = document.getElementById('ta-min');
    formState.title = title; formState.date = date;
    formState.desc = descEl ? descEl.value : '';
    formState.priority = priEl ? priEl.value : 'normal';
    formState.min = minEl ? parseInt(minEl.value, 10) : null;
    if (!title) { ui.toast('Judul tugas wajib diisi.', { kind: 'err' }); return false; }
    if (!JF.dates.isDayKey(date)) { ui.toast('Tanggal target wajib dipilih.', { kind: 'err' }); return false; }
    var t = JF.store.addTask(app.rawState(), {
      title: title, targetDate: date, description: formState.desc,
      priority: formState.priority,
      durationSec: formState.min > 0 ? formState.min * 60 : null
    }, Date.now());
    formState = { title: '', date: date, desc: '', priority: 'normal', min: null };
    showDetails = false;
    app.save();
    ui.toast('Tugas ditambahkan: ' + t.title, { kind: 'ok' });
    ui.clear(host); mount(host); render();
    var t3 = document.getElementById('ta-title'); if (t3) t3.focus();
    return false;
  }

  /* ── rows ──────────────────────────────────────────────────────── */
  function metaChips(t, d) {
    var box = ui.el('div.meta');
    if (t.priority !== 'normal') {
      box.appendChild(ui.el('span.chip' + (t.priority === 'high' ? '.danger' : '.outline'),
        t.priority === 'high' ? 'Prioritas tinggi' : 'Prioritas rendah'));
    }
    var od = JF.model.isOverdue(t, d);
    box.appendChild(ui.el('span.chip' + (od ? '.danger' : '.outline'),
      ui.dayRel(t.targetDate) + ', ' + ui.fmt.dateShort(t.targetDate)));
    if (od) box.appendChild(ui.el('span.chip.danger', 'Terlambat'));
    if (t.done) box.appendChild(ui.el('span.chip.ok', 'Selesai ' + ui.fmt.dateShort(JF.dates.dayKey(t.completedAt || t.firstCompletedAt))));
    if (t.migrated) box.appendChild(ui.el('span.chip.outline', { title: 'Dipindahkan dari data lama' }, 'Data lama'));
    var s = app.currentSession();
    if (s && s.taskId === t.id && s.state === 'running') box.appendChild(ui.el('span.chip.accent', '● berjalan'));
    else if (s && s.taskId === t.id && s.state === 'paused') box.appendChild(ui.el('span.chip.warn', '● dijeda'));
    else if (!t.done && t.left > 0 && t.left < t.durationSec) box.appendChild(ui.el('span.chip.outline', 'sisa ' + ui.fmt.mmss(t.left)));
    return box;
  }

  function row(t, d, opts) {
    var s = app.currentSession();
    var runningHere = s && s.taskId === t.id && (s.state === 'running' || s.state === 'paused');
    var r = ui.el('div.task-row' + (JF.model.isOverdue(t, d) ? '.overdue' : '') + (t.done ? '.done' : '') + (runningHere ? '.running' : ''));

    if (opts && opts.sel) r.appendChild(opts.sel.box(t));

    // Tidak ada centang cepat: menandai selesai lewat "Selesai + ringkasan". Tugas selesai hanya diberi tanda status
    // (bukan tombol); mengembalikannya lewat tombol "Urungkan".
    if (t.done) {
      r.appendChild(ui.el('span.done-mark', { role: 'img', 'aria-label': 'Selesai', title: 'Selesai' }, ui.svg(ui.ICON.check, 12, 3)));
    }

    var body = ui.el('div.body');
    body.appendChild(ui.el('div.tt', t.title));
    if (t.description) body.appendChild(ui.el('div.desc', t.description));
    body.appendChild(metaChips(t, d));
    if (t.done && JF.completion) { var sb = JF.completion.summaryBlock(t); if (sb) body.appendChild(sb); }
    r.appendChild(body);

    var acts = ui.el('div.acts');
    if (!t.done) {
      if (!runningHere) {
        acts.appendChild(ui.btn('Mulai', function () { app.startTask(t.id); }, { sm: true, primary: true }));
      } else if (s.state === 'paused') {
        acts.appendChild(ui.btn('Lanjut', function () { app.resume(); }, { sm: true, primary: true }));
      } else {
        acts.appendChild(ui.btn('Jeda', function () { app.pause(); }, { sm: true, primary: true }));
      }
      if (JF.completion) acts.appendChild(ui.btn('Selesai + ringkasan', function () { JF.completion.start(t.id); }, { sm: true, ghost: true }));
    } else {
      acts.appendChild(ui.btn('Urungkan', function () { app.reopenTask(t.id); }, { sm: true, ghost: true }));
    }
    acts.appendChild(ui.btn('Ubah', function () { openEdit(t); }, { sm: true, ghost: true }));
    acts.appendChild(ui.btn('Arsip', function () { doArchive(t); }, { sm: true, ghost: true }));
    r.appendChild(acts);
    return r;
  }

  function doArchive(t) {
    JF.store.archiveTask(app.rawState(), t.id, Date.now());
    app.save();
    ui.toast('Diarsipkan: ' + t.title, {
      action: {
        label: 'Batal', onClick: function () {
          JF.store.restoreTask(app.rawState(), t.id, t.targetDate, Date.now());
          app.save();
        }
      }, timeout: 7000
    });
    render();
  }

  function openEdit(t) {
    var state = app.rawState();
    var body = ui.el('div.form-grid');
    body.appendChild(ui.el('label.field', 'Judul', ui.el('input#ed-title', { value: t.title, maxlength: 120 })));
    body.appendChild(ui.el('label.field', 'Deskripsi', ui.el('textarea#ed-desc', { maxlength: 2000 }, t.description || '')));
    var row1 = ui.el('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap' } });
    var fDate = ui.el('label.field', 'Tanggal target (mengubah jadwal tugas)',
      ui.el('input#ed-date', { type: 'date', value: t.targetDate }));
    row1.appendChild(fDate);
    var fPri = ui.el('label.field', 'Prioritas');
    var sel = ui.el('select#ed-pri');
    JF.model.PRIORITIES.forEach(function (p) {
      var o = ui.el('option', { value: p }, JF.model.PRIORITY_LABEL[p]);
      if (p === t.priority) o.selected = true;
      sel.appendChild(o);
    });
    fPri.appendChild(sel); row1.appendChild(fPri);
    var fMin = ui.el('label.field', 'Durasi fokus (menit)', ui.el('input#ed-min', { type: 'number', min: 1, max: 600, value: Math.round((t.durationSec || 1500) / 60) }));
    row1.appendChild(fMin);
    body.appendChild(row1);
    body.appendChild(ui.el('div.hint',
      'Durasi baru langsung mengatur ulang sisa waktu. Jika sesi tugas ini sedang berjalan atau dijeda, durasi baru berlaku untuk sesi berikutnya.'));
    if (t.targetDateHistory && t.targetDateHistory.length > 1) {
      var hist = t.targetDateHistory.slice(-4).map(function (h) {
        return (h.from ? ui.fmt.dateShort(h.from) + ' → ' : 'mulanya ') + ui.fmt.dateShort(h.to) +
          (h.source === 'restored' ? ' (dipulihkan)' : h.source === 'rescheduled' ? ' (dijadwalkan ulang)' : '');
      });
      body.appendChild(ui.el('div.hint', 'Riwayat jadwal: ' + hist.join(' · ')));
    }
    if (t.completionEvents && t.completionEvents.length) {
      body.appendChild(ui.el('div.hint', 'Pernah selesai ' + t.completionEvents.length + '× (' +
        t.completionEvents.map(function (e) { return ui.fmt.dateTime(e.at); }).join(', ') + ')'));
    }

    ui.modal({
      title: 'Ubah tugas', body: body, wide: false,
      actions: [
        { label: 'Batal', ghost: true },
        {
          label: 'Simpan', primary: true, onClick: function () {
            var newDate = document.getElementById('ed-date').value;
            var newTitle = (document.getElementById('ed-title').value || '').trim();
            if (!newTitle) { ui.toast('Judul tidak boleh kosong.', { kind: 'err' }); return false; }
            if (!JF.dates.isDayKey(newDate)) { ui.toast('Tanggal target wajib diisi.', { kind: 'err' }); return false; }
            var changedDate = newDate !== t.targetDate;
            var r = JF.store.editTask(state, t.id, {
              title: newTitle,
              description: document.getElementById('ed-desc').value,
              priority: document.getElementById('ed-pri').value,
              durationSec: parseInt(document.getElementById('ed-min').value, 10) * 60
            }, Date.now());
            if (!r.ok) { ui.toast('Gagal menyimpan.', { kind: 'err' }); return false; }
            if (changedDate) {
              var rr = JF.store.rescheduleTask(state, t.id, newDate, Date.now());
              if (rr.ok && rr.changed) ui.toast('Jadwal dipindah — laporan hari sebelumnya tidak diubah.');
            }
            app.save(); render();
            return true;
          }
        }
      ]
    });
  }

  function openRestore(t) {
    var body = ui.el('div.form-grid');
    body.appendChild(ui.el('p.hint',
      'Pilih tanggal target baru untuk mengaktifkan kembali tugas ini.'));
    if (t.targetDate) {
      body.appendChild(ui.el('p.hint', 'Jadwal sebelumnya: ' + ui.fmt.date(t.targetDate) +
        ' — tidak otomatis dipakai kembali.'));
    }
    body.appendChild(ui.el('label.field', 'Tanggal target baru (wajib)',
      ui.el('input#rs-date', { type: 'date', value: '' })));
    ui.modal({
      title: 'Pulihkan tugas', body: body,
      actions: [
        { label: 'Batal', ghost: true },
        {
          label: 'Pulihkan', primary: true, onClick: function () {
            var d = document.getElementById('rs-date').value;
            if (!JF.dates.isDayKey(d)) { ui.toast('Tanggal target baru wajib dipilih.', { kind: 'err' }); return false; }
            var r = JF.store.restoreTask(app.rawState(), t.id, d, Date.now());
            if (!r.ok) { ui.toast('Gagal memulihkan.', { kind: 'err' }); return false; }
            app.save(); tab = 'aktif'; render();
            ui.toast('Tugas dipulihkan ke ' + ui.fmt.dateShort(d) + '.', { kind: 'ok' });
            return true;
          }
        }
      ]
    });
  }

  function openBulkModal() {
    var defaultDate = (document.getElementById('ta-date') && document.getElementById('ta-date').value) || app.today();
    var isSubmitting = false;

    var body = ui.el('div.form-grid.bulk-modal-body');

    // Format hint box
    var hint = ui.el('div.bulk-help',
      ui.el('div.bulk-help-title', 'Format pengisian (satu tugas per baris):'),
      ui.el('div.bulk-help-code', 'nama tugas_waktu_prioritas_deskripsi'),
      ui.el('ul.bulk-help-list',
        ui.el('li', ui.el('strong', 'nama tugas: '), 'Wajib diisi (hindari tanda underscore _ dalam nama)'),
        ui.el('li', ui.el('strong', 'waktu: '), 'Wajib, durasi dalam menit (contoh: ', ui.el('code', '25'), ', ', ui.el('code', '60'), ')'),
        ui.el('li', ui.el('strong', 'prioritas: '), 'Wajib: ', ui.el('code', 'rendah'), ', ', ui.el('code', 'normal'), ', atau ', ui.el('code', 'tinggi')),
        ui.el('li', ui.el('strong', 'deskripsi: '), 'Opsional, boleh dikosongkan (contoh: ', ui.el('code', 'Apply lowongan kerja_45_tinggi'), ' atau ', ui.el('code', 'Baca materi audit internal_30_normal_'), ')')
      )
    );
    body.appendChild(hint);

    // Target date field
    var dateInput = ui.el('input#bulk-date', { type: 'date', value: defaultDate, style: { width: '160px' } });
    var dateWrap = ui.el('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', margin: '4px 0 10px' } },
      ui.el('label.field', { style: { margin: '0' } }, 'Tanggal target untuk semua tugas', dateInput)
    );
    body.appendChild(dateWrap);

    // Multiline textarea
    var textarea = ui.el('textarea#bulk-input', {
      placeholder: 'Tempel tugas di sini…\nContoh:\nBelajar PSAK 216_60_normal_Mempelajari pengakuan dan pengukuran aset tetap\nLatihan Excel SUMIFS_20_tinggi_Latihan rekap transaksi\nBaca materi audit internal_30_normal_\nApply lowongan kerja_45_tinggi\nOlahraga_15_rendah_Peregangan ringan',
      rows: 6,
      style: { width: '100%', fontFamily: 'monospace', fontSize: '13px', resize: 'vertical' }
    });
    body.appendChild(ui.el('label.field', 'Daftar tugas', textarea));

    // Summary bar & warning alert
    var summaryWrap = ui.el('div.bulk-summary-bar');
    var statBadge = ui.el('span.chip', { id: 'bulk-stat-badge' }, '0 baris');
    var warnNotice = ui.el('div.bulk-warn-notice', { style: { display: 'none' } });
    summaryWrap.appendChild(statBadge);
    summaryWrap.appendChild(warnNotice);
    body.appendChild(summaryWrap);

    // Preview table — urutan kolom mengikuti urutan format:
    // nama_durasi_prioritas[_deskripsi], lalu tanggal target & status.
    var tableWrap = ui.el('div.bulk-table-wrap');
    var table = ui.el('table.bulk-table', { style: { display: 'none' } });
    var thead = ui.el('thead',
      ui.el('tr',
        ui.el('th', 'Nama Tugas'),
        ui.el('th.num', 'Durasi'),
        ui.el('th', 'Prioritas'),
        ui.el('th', 'Deskripsi'),
        ui.el('th', 'Tanggal'),
        ui.el('th', 'Status')
      )
    );
    var tbody = ui.el('tbody#bulk-tbody');
    table.appendChild(thead);
    table.appendChild(tbody);
    tableWrap.appendChild(table);

    var emptyNotice = ui.el('div.bulk-empty', 'Belum ada data. Masukkan atau tempel definisi tugas di atas untuk melihat pratinjau.');
    tableWrap.appendChild(emptyNotice);
    body.appendChild(tableWrap);

    var currentParseResult = null;
    var modalApi = null;

    function getParser() {
      if (JF.bulkTasks) return JF.bulkTasks;
      if (typeof require === 'function') {
        try { return require('../../shared/bulkTasks.js'); } catch (e) { return null; }
      }
      return null;
    }

    function primaryBtn() {
      return modalApi && modalApi.box ? modalApi.box.querySelector('.m-foot button.primary') : null;
    }

    function updatePreview() {
      var text = textarea.value;
      var parser = getParser();
      if (!parser) {
        // Jangan diam saja: tanpa parser tombol simpan harus terkunci.
        warnNotice.textContent = 'Pratinjau tidak tersedia: modul parser belum dimuat. Muat ulang aplikasi.';
        warnNotice.style.display = 'block';
        var lockedBtn = primaryBtn();
        if (lockedBtn) lockedBtn.disabled = true;
        return;
      }

      var res = parser.parseBulkInput(text);
      currentParseResult = res;

      ui.clear(tbody);
      var saveBtn = primaryBtn();
      var targetDate = dateInput.value;
      var dateLabel = JF.dates.isDayKey(targetDate) ? ui.fmt.dateShort(targetDate) : '—';

      if (!res.totalLines) {
        table.style.display = 'none';
        emptyNotice.style.display = 'block';
        statBadge.textContent = '0 baris';
        statBadge.className = 'chip';
        warnNotice.style.display = 'none';
        if (saveBtn) saveBtn.disabled = true;
        return;
      }

      table.style.display = 'table';
      emptyNotice.style.display = 'none';

      var summaryText = res.totalLines + ' baris: ' + res.totalValid + ' valid';
      if (res.totalInvalid > 0) summaryText += ', ' + res.totalInvalid + ' tidak valid';
      statBadge.textContent = summaryText;
      statBadge.className = 'chip' + (res.totalInvalid > 0 ? ' danger' : ' ok');

      if (res.totalInvalid > 0) {
        warnNotice.textContent = res.totalInvalid + ' baris tidak valid akan dilewati. Hanya ' + res.totalValid + ' tugas valid yang akan disimpan.';
        warnNotice.style.display = 'block';
      } else {
        warnNotice.style.display = 'none';
      }

      res.rows.forEach(function (r) {
        var tr = ui.el('tr' + (r.valid ? '' : '.row-invalid'));
        tr.appendChild(ui.el('td', r.valid ? r.taskName : (r.taskName || ui.el('span.muted', '(Baris ' + r.lineNumber + ')'))));
        tr.appendChild(ui.el('td.num', r.durationMin ? r.durationMin + ' menit' : '—'));
        tr.appendChild(ui.el('td', r.valid
          ? ui.el('span.chip' + (r.priority === 'high' ? '.danger' : (r.priority === 'low' ? '.outline' : '')), r.priorityLabel)
          : (r.priorityLabel || '—')));
        tr.appendChild(ui.el('td', r.description ? r.description : '—'));
        tr.appendChild(ui.el('td', dateLabel));
        tr.appendChild(ui.el('td', r.valid
          ? ui.el('span.chip.ok', 'Valid')
          : ui.el('span.chip.danger', { title: r.error }, r.error)));
        tbody.appendChild(tr);
      });

      if (saveBtn) {
        saveBtn.disabled = res.totalValid === 0;
      }
    }

    textarea.addEventListener('input', updatePreview);
    dateInput.addEventListener('change', updatePreview);

    modalApi = ui.modal({
      title: 'Tambah Banyak Tugas',
      body: body,
      wide: true,
      actions: [
        { label: 'Batal', ghost: true },
        {
          label: 'Pratinjau Tugas',
          ghost: true,
          onClick: function () {
            updatePreview();
            return false;
          }
        },
        {
          label: 'Tambah Semua Tugas',
          primary: true,
          onClick: function () {
            if (isSubmitting) return false;
            updatePreview();
            var parser = getParser();
            if (!parser) {
              ui.toast('Modul parser belum dimuat. Muat ulang aplikasi lalu coba lagi.', { kind: 'err' });
              return false;
            }
            if (!currentParseResult || currentParseResult.totalValid === 0) {
              ui.toast('Tidak ada tugas valid untuk ditambahkan.', { kind: 'err' });
              return false;
            }
            var targetDate = dateInput.value;
            if (!JF.dates.isDayKey(targetDate)) {
              ui.toast('Tanggal target wajib dipilih.', { kind: 'err' });
              return false;
            }

            var saveBtn = primaryBtn();
            if (saveBtn) {
              saveBtn.disabled = true;
              saveBtn.textContent = 'Menyimpan…';
            }
            isSubmitting = true;

            // Baca state terbaru (bukan snapshot saat modal dibuka) agar
            // perubahan lain yang terjadi di latar belakang tidak tertimpa.
            var state = app.rawState();
            var created = [];
            try {
              created = parser.addBulkTasks(state, currentParseResult.validRows, targetDate, Date.now());
            } catch (e) {
              console.error('[bulk-add]', e);
              parser.removeCreated(state, created);
              isSubmitting = false;
              if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Tambah Semua Tugas'; }
              ui.toast('Gagal menambahkan tugas: ' + (e && e.message ? e.message : e), { kind: 'err' });
              return false;
            }

            if (!app.save()) {
              // Penyimpanan gagal: batalkan tugas yang baru dibuat di memori
              // supaya percobaan ulang tidak membuat duplikat, dan modal
              // tetap terbuka dengan pesan error yang jelas.
              parser.removeCreated(state, created);
              isSubmitting = false;
              if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Tambah Semua Tugas'; }
              ui.toast('Gagal menyimpan ' + created.length + ' tugas ke penyimpanan lokal. Ruang penyimpanan mungkin penuh — periksa Pengaturan › Data & cadangan.', { kind: 'err', timeout: 9000 });
              return false;
            }

            render();
            ui.toast(created.length + ' tugas berhasil ditambahkan.', { kind: 'ok' });
            return true;
          }
        }
      ]
    });

    if (modalApi && modalApi.box) {
      modalApi.box.classList.add('modal-bulk');
    }
    updatePreview();
  }


  /* ── pilih banyak (select all) + aksi massal ───────────────────── */
  function selectionGroup(items) {
    var g = { items: items, boxes: [], onSync: null };
    g.box = function (t) {
      var cb = ui.el('input.sel-box', { type: 'checkbox', 'aria-label': 'Pilih ' + t.title });
      cb.checked = !!sel[t.id];
      cb.addEventListener('change', function () {
        if (cb.checked) sel[t.id] = true; else delete sel[t.id];
        g.sync();
      });
      g.boxes.push({ t: t, cb: cb });
      return cb;
    };
    g.selected = function () { return items.filter(function (t) { return sel[t.id]; }); };
    g.setAll = function (v) {
      items.forEach(function (t) { if (v) sel[t.id] = true; else delete sel[t.id]; });
      g.boxes.forEach(function (b) { b.cb.checked = !!sel[b.t.id]; });
      g.sync();
    };
    g.sync = function () { if (g.onSync) g.onSync(g.selected().length, items.length); };
    return g;
  }

  /* specs: [{ label: string | fn(n), onClick: fn(selectedTasks) }]
     Tampilan ramping: hanya "Pilih semua"; menu aksi baru muncul bila ada yang dipilih. */
  function bulkBar(g, specs) {
    var all = ui.el('input.sel-box', { type: 'checkbox', 'aria-label': 'Pilih semua tugas di daftar ini' });
    var info = ui.el('span.sel-info');
    var act = ui.el('select.sel-act', { 'aria-label': 'Aksi untuk tugas terpilih' });
    act.appendChild(ui.el('option', { value: '' }, 'Aksi…'));
    var opts = specs.map(function (sp, i) {
      var o = ui.el('option', { value: String(i) }, '');
      act.appendChild(o);
      return { node: o, spec: sp };
    });
    act.addEventListener('change', function () {
      var i = act.value; act.value = '';
      if (i === '') return;
      var chosen = g.selected();
      if (chosen.length) specs[+i].onClick(chosen);
    });
    all.addEventListener('change', function () { g.setAll(all.checked); });
    g.onSync = function (n, total) {
      all.checked = total > 0 && n === total;
      all.indeterminate = n > 0 && n < total;
      info.textContent = n + ' dipilih';
      info.hidden = act.hidden = n === 0;
      opts.forEach(function (o) { var lb = o.spec.label; o.node.textContent = typeof lb === 'function' ? lb(n) : lb; });
    };
    g.sync();
    return ui.el('div.sel-bar', ui.el('label.sel-all', all, 'Pilih semua'), info, act);
  }

  function pickDateModal(title, hint, okLabel, onPick) {
    var inp = ui.el('input#bp-date', { type: 'date', value: '' });
    var body = ui.el('div.form-grid',
      ui.el('p.hint', hint),
      ui.el('label.field', 'Tanggal target baru (wajib)', inp));
    ui.modal({
      title: title, body: body,
      actions: [
        { label: 'Batal', ghost: true },
        {
          label: okLabel, primary: true, onClick: function () {
            var v = inp.value;
            if (!JF.dates.isDayKey(v)) { ui.toast('Tanggal target baru wajib dipilih.', { kind: 'err' }); return false; }
            return onPick(v) !== false;
          }
        }
      ]
    });
  }

  function bulkReschedule(tasks, date, label) {
    var st = app.rawState(), prev = [];
    tasks.forEach(function (t) {
      var from = t.targetDate;
      var r = JF.store.rescheduleTask(st, t.id, date, Date.now());
      if (r.ok && r.changed) prev.push({ id: t.id, from: from });
    });
    sel = {};
    app.save(); render();
    ui.toast(prev.length + ' tugas dipindah ke ' + label + '.', {
      kind: 'ok', timeout: 7000,
      action: {
        label: 'Batal', onClick: function () {
          prev.forEach(function (p) { JF.store.rescheduleTask(app.rawState(), p.id, p.from, Date.now()); });
          app.save(); render();
        }
      }
    });
  }

  function bulkArchive(tasks) {
    var st = app.rawState();
    var prev = tasks.map(function (t) { return { id: t.id, date: t.targetDate }; });
    tasks.forEach(function (t) { JF.store.archiveTask(st, t.id, Date.now()); });
    sel = {};
    app.save(); render();
    ui.toast(prev.length + ' tugas diarsipkan.', {
      kind: 'ok', timeout: 7000,
      action: {
        label: 'Batal', onClick: function () {
          prev.forEach(function (p) { JF.store.restoreTask(app.rawState(), p.id, p.date, Date.now()); });
          app.save(); render();
        }
      }
    });
  }

  function bulkRestore(tasks) {
    pickDateModal('Pulihkan ' + tasks.length + ' tugas',
      'Semua tugas yang dipilih akan diaktifkan lagi dengan tanggal target yang sama.', 'Pulihkan',
      function (date) {
        var st = app.rawState(), n = 0;
        tasks.forEach(function (t) { if (JF.store.restoreTask(st, t.id, date, Date.now()).ok) n++; });
        sel = {}; tab = 'aktif';
        app.save(); render();
        ui.toast(n + ' tugas dipulihkan ke ' + ui.fmt.dateShort(date) + '.', { kind: 'ok' });
      });
  }

  function bulkDelete(tasks) {
    var ids = tasks.map(function (t) { return t.id; });
    ui.confirm({
      title: 'Hapus permanen ' + ids.length + ' tugas?',
      body: 'Tugas yang dihapus TIDAK bisa dipulihkan. Riwayat sesi fokus dan laporan harian tetap tersimpan; hanya tautan tugas ke Goal/Library yang dilepas.',
      okLabel: 'Hapus permanen', danger: true
    }).then(function (ok) {
      if (!ok) return;
      var r = JF.store.deleteArchivedTasks(app.rawState(), ids, Date.now());
      sel = {};
      var saved = app.save();
      render();
      if (!saved) ui.toast('Tugas terhapus di layar, tapi gagal menyimpan ke penyimpanan lokal. Periksa Pengaturan › Data & cadangan.', { kind: 'err', timeout: 9000 });
      else ui.toast(r.removed.length + ' tugas dihapus permanen.' + (r.skipped.length ? ' ' + r.skipped.length + ' dilewati (sedang dipakai timer).' : ''), { kind: 'ok' });
    });
  }

  /* ── filter tanggal (satu dropdown ringkas) ───────────────────── */
  function matchFilter(t, d) {
    if (dateFilter === 'late') return JF.model.isOverdue(t, d);
    if (dateFilter === 'today') return t.targetDate === d;
    if (dateFilter === 'tomorrow') return t.targetDate === JF.dates.addDays(d, 1);
    if (dateFilter === 'date') return !pickedDate || t.targetDate === pickedDate;
    return true;
  }

  function renderFilter() {
    var box = ui.$('ta-filter');
    if (!box) return;
    ui.clear(box);
    if (tab === 'arsip') { box.hidden = true; return; }
    box.hidden = false;
    var d = app.today();
    var live = app.rawState().tasks.filter(function (t) { return !t.archived && !t.done; });
    function count(f) {
      var keep = dateFilter; dateFilter = f;
      var n = live.filter(function (t) { return matchFilter(t, d); }).length;
      dateFilter = keep; return n;
    }
    var fs = ui.el('select#ta-fsel', { 'aria-label': 'Filter tanggal tugas' });
    fs.className = 'fsel';
    [['all', 'Semua'], ['late', 'Terlambat'], ['today', 'Hari ini'], ['tomorrow', 'Besok']].forEach(function (o) {
      var op = ui.el('option', { value: o[0] }, o[1] + ' (' + count(o[0]) + ')');
      if (dateFilter === o[0]) op.selected = true;
      fs.appendChild(op);
    });
    var od = ui.el('option', { value: 'date' }, 'Pilih tanggal…');
    if (dateFilter === 'date') od.selected = true;
    fs.appendChild(od);
    fs.addEventListener('change', function () {
      dateFilter = fs.value; if (dateFilter !== 'date') pickedDate = '';
      sel = {}; render();
      if (dateFilter === 'date') { var di = ui.$('ta-fdate'); if (di) di.focus(); }
    });
    box.appendChild(fs);
    if (dateFilter === 'date') {
      var inp = ui.el('input#ta-fdate', { type: 'date', 'aria-label': 'Pilih tanggal tertentu', value: pickedDate });
      inp.className = 'fdate';
      inp.addEventListener('change', function () { pickedDate = JF.dates.isDayKey(inp.value) ? inp.value : ''; sel = {}; render(); });
      box.appendChild(inp);
    }
  }

  function lateSection(late, d) {
    var frag = ui.el('div');
    frag.appendChild(ui.el('div.section-label', 'Terlambat (' + late.length + ')'));
    var g = selectionGroup(late);
    if (late.length > 1) {
      frag.appendChild(bulkBar(g, [
        { label: 'Pindah ke hari ini', onClick: function (c) { bulkReschedule(c, d, 'hari ini'); } },
        { label: 'Pindah ke besok', onClick: function (c) { bulkReschedule(c, JF.dates.addDays(d, 1), 'besok'); } },
        {
          label: 'Pilih tanggal…', onClick: function (c) {
            pickDateModal('Jadwalkan ulang ' + c.length + ' tugas', 'Tanggal baru berlaku untuk semua tugas yang dipilih. Laporan hari sebelumnya tidak diubah.', 'Jadwalkan',
              function (date) { bulkReschedule(c, date, ui.fmt.dateShort(date)); });
          }
        },
        { label: function (n) { return 'Arsipkan' + (n ? ' (' + n + ')' : ''); }, onClick: bulkArchive }
      ]));
    }
    var list = ui.el('div.task-list');
    late.forEach(function (t) { list.appendChild(row(t, d, late.length > 1 ? { sel: g } : null)); });
    frag.appendChild(list);
    return frag;
  }

  function section(label, tasks, d, opts) {
    if (!tasks.length) return null;
    var frag = ui.el('div');
    frag.appendChild(ui.el('div.section-label', label + ' (' + tasks.length + ')'));
    var list = ui.el('div.task-list');
    tasks.forEach(function (t) { list.appendChild(row(t, d)); });
    frag.appendChild(list);
    return frag;
  }

  function sortFn(a, b) {
    var w = { high: 0, normal: 1, low: 2 };
    if (w[a.priority] !== w[b.priority]) return w[a.priority] - w[b.priority];
    return (a.createdAt || 0) - (b.createdAt || 0);
  }

  function render() {
    if (!host) return;
    var list = ui.$('ta-list');
    if (!list) return;
    ui.clear(list);
    renderFilter();
    document.getElementById('tab-aktif').className = tab === 'aktif' ? 'on' : '';
    document.getElementById('tab-arsip').className = tab === 'arsip' ? 'on' : '';
    var state = app.rawState(), d = app.today();

    if (tab === 'arsip') {
      var arch = JF.store.archivedTasks(state).sort(function (a, b) { return (b.archivedAt || 0) - (a.archivedAt || 0); });
      if (!arch.length) {
        list.appendChild(ui.el('div.empty', ui.el('span.big', 'Arsip kosong'), 'Tugas yang diarsipkan tetap tersimpan di sini beserta riwayatnya.'));
        return;
      }
      list.appendChild(ui.el('div.section-label', 'Diarsipkan (' + arch.length + ')'));
      var ag = selectionGroup(arch);
      list.appendChild(bulkBar(ag, [
        { label: function (n) { return 'Pulihkan' + (n ? ' (' + n + ')' : ''); }, onClick: bulkRestore },
        { label: function (n) { return 'Hapus permanen' + (n ? ' (' + n + ')' : ''); }, onClick: bulkDelete, danger: true }
      ]));
      var ul = ui.el('div.task-list');
      arch.forEach(function (t) {
        var r = ui.el('div.task-row');
        r.appendChild(ag.box(t));
        var body = ui.el('div.body');
        body.appendChild(ui.el('div.tt', t.title));
        if (t.description) body.appendChild(ui.el('div.desc', t.description));
        var meta = ui.el('div.meta');
        meta.appendChild(ui.el('span.chip.outline', 'Diarsipkan ' + ui.fmt.dateShort(JF.dates.dayKey(t.archivedAt || t.createdAt))));
        meta.appendChild(ui.el('span.chip.outline', 'Jadwal lama: ' + ui.fmt.dateShort(t.targetDate)));
        if (t.done) meta.appendChild(ui.el('span.chip.ok', 'Pernah selesai'));
        body.appendChild(meta);
        r.appendChild(body);
        var acts = ui.el('div.acts');
        acts.appendChild(ui.btn('Pulihkan', function () { openRestore(t); }, { sm: true, primary: true }));
        r.appendChild(acts);
        ul.appendChild(r);
      });
      list.appendChild(ul);
      return;
    }

    var active = state.tasks.filter(function (t) { return !t.archived && !t.done && matchFilter(t, d); }).sort(sortFn);
    var done = state.tasks.filter(function (t) { return !t.archived && t.done && dateFilter !== 'late' && matchFilter(t, d); })
      .sort(function (a, b) { return (b.completedAt || b.firstCompletedAt || 0) - (a.completedAt || a.firstCompletedAt || 0); });
    var late = active.filter(function (t) { return JF.model.isOverdue(t, d); });
    var today = active.filter(function (t) { return !JF.model.isOverdue(t, d) && t.targetDate === d; });
    var soon = active.filter(function (t) { return t.targetDate > d; });

    var any = false;
    [[late.length ? lateSection(late, d) : null, late.length],
    [section('Hari ini', today, d), today.length],
    [section('Mendatang', soon, d), soon.length]].forEach(function (pair) {
      var node = pair[0]; if (node) { list.appendChild(node); any = true; }
    });

    if (!active.length && !done.length && dateFilter !== 'all') {
      var em = ui.el('div.empty', ui.el('span.big', 'Tidak ada tugas untuk filter ini'),
        'Coba pilih tanggal lain atau tampilkan semua tugas.');
      em.appendChild(ui.btn('Tampilkan semua', function () { dateFilter = 'all'; pickedDate = ''; sel = {}; render(); }, { sm: true, ghost: true }));
      list.appendChild(em);
    } else if (!active.length && !done.length) {
      list.appendChild(ui.el('div.empty', ui.el('span.big', 'Belum ada tugas'),
        'Tulis judul di atas, pilih tanggal, tekan Tambah.'));
    } else if (!active.length) {
      list.appendChild(ui.el('div.empty', ui.el('span.big', 'Semua tugas aktif selesai'),
        'Tugas selesai tetap tersimpan di bawah.'));
    }

    if (done.length) {
      var head = ui.el('div.section-label', 'Selesai (' + done.length + ')');
      var toggle = ui.btn(expandDone ? 'Sembunyikan' : 'Tampilkan semua', function () { expandDone = !expandDone; render(); }, { ghost: true, sm: true });
      toggle.style.marginLeft = '10px';
      head.appendChild(toggle);
      list.appendChild(head);
      var dl = ui.el('div.task-list');
      (expandDone ? done : done.slice(0, 3)).forEach(function (t) { dl.appendChild(row(t, d)); });
      list.appendChild(dl);
      if (!expandDone && done.length > 3) {
        list.appendChild(ui.el('div.hint', { style: { marginTop: '8px' } }, '+ ' + (done.length - 3) + ' lainnya'));
      }
      if (done.length) {
        var bulk = ui.btn('Arsipkan semua yang selesai', function () {
          ui.confirm({
            title: 'Arsipkan ' + done.length + ' tugas selesai?',
            body: 'Semua tugas selesai akan dipindahkan ke arsip. Tidak ada data yang dihapus — semua bisa dipulihkan kapan saja.',
            okLabel: 'Arsipkan'
          }).then(function (ok) {
            if (!ok) return;
            done.forEach(function (t) { JF.store.archiveTask(app.rawState(), t.id, Date.now()); });
            app.save(); render();
            ui.toast(done.length + ' tugas diarsipkan.', { kind: 'ok' });
          });
        }, { ghost: true, sm: true });
        bulk.style.marginTop = '14px';
        list.appendChild(bulk);
      }
    }
  }

  JF.pages.register({
    id: 'tugas',
    title: 'Tugas',
    sub: function () {
      var st = app ? app.todayStats() : null;
      return st ? st.active + ' aktif · ' + st.upcoming + ' mendatang · ' + st.overdue + ' terlambat' : '';
    },
    mount: mount,
    render: render
  });

  // Shared entry points for other pages (Kalender date panel, toasts).
  JF.taskUI = {
    openEdit: openEdit,
    openRestore: openRestore,
    prefillAdd: function (date) {
      if (JF.dates.isDayKey(date)) formState.date = date;
      if (location.hash !== '#tugas') location.hash = '#tugas';
      else render();
      setTimeout(function () { var i = document.getElementById('ta-title'); i && i.focus(); }, 120);
    }
  };
})(typeof self !== 'undefined' ? self : this);