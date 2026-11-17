/* Jam Fokus — Manajemen Lamaran Kerja (UI, Original experience).
   Tampil sebagai tab terpisah di halaman Goals. Semua data lewat JF.jobApps,
   disimpan dengan app.save(). Tautan eksternal dibuka lewat window.open yang
   diarahkan main process ke shell.openExternal (http/https saja). */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app;
  var filters = { search: '', status: 'all', sort: 'date' };

  function JA() { return JF.jobApps; }
  function st() { return app.rawState(); }
  function init() { ui = JF.ui; app = JF.app; }

  var ICON = {
    ext: '<path d="M14 4h6v6"/><path d="M20 4L10 14"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'
  };

  /* ── routing (#goals?view=lamaran[&app=<id>]) ────────────────────── */
  function viewFromHash() {
    var hash = location.hash || '';
    if (hash.replace(/^#/, '').split('?')[0] !== 'goals') return null;
    var q = hash.indexOf('?') >= 0 ? hash.slice(hash.indexOf('?') + 1) : '';
    if (!/(?:^|&)view=lamaran(?:&|$)/.test(q)) return null;
    var m = /(?:^|&)app=([^&]+)/.exec(q);
    var appId = null;
    if (m) { try { appId = decodeURIComponent(m[1]) || null; } catch (e) { appId = null; } }
    return { appId: appId };
  }
  function openList() { location.hash = '#goals?view=lamaran'; }
  function openApp(id) { location.hash = '#goals?view=lamaran&app=' + encodeURIComponent(id); }

  /* ── helpers ─────────────────────────────────────────────────────── */
  function persist(okMsg) {
    var ok = app.save();
    if (!ok) ui.toast('Perubahan belum tersimpan permanen. Periksa ruang penyimpanan lalu coba lagi.', { kind: 'err', timeout: 9000 });
    else if (okMsg) ui.toast(okMsg, { kind: 'ok' });
    return ok;
  }
  function failMsg(r) {
    var map = {
      'not-found': 'Lamaran tidak ditemukan.',
      'link-not-found': 'Tautan tidak ditemukan.'
    };
    return map[r && r.reason] || 'Perubahan tidak bisa disimpan.';
  }
  function fmtDay(day) {
    var p = JF.dates.parseDay(day);
    if (!p) return day || '';
    return p.d + ' ' + ui.MON_SHORT[p.m - 1] + ' ' + p.y;
  }
  function relText(info) {
    if (info.overdue) return 'Terlambat ' + Math.abs(info.days) + ' hari';
    if (info.days === 0) return 'Hari ini';
    if (info.days === 1) return 'Besok';
    return info.days + ' hari lagi';
  }
  function statusChip(a) {
    return ui.el('span.chip.' + (JA().STATUS_TONE[a.status] || 'outline'), JA().STATUS_LABEL[a.status] || a.status);
  }
  function iconBtn(icon, label, onClick, fk) {
    return ui.el('button.icb', { type: 'button', title: label, 'aria-label': label, onclick: onClick, dataset: fk ? { fk: fk } : null }, ui.svg(icon, 16));
  }
  function openExternal(url) { if (url) root.open(url); }

  /* ── form validation display ─────────────────────────────────────── */
  function field(label, input, errKey, hint) {
    var wrap = ui.el('label.field', label, input);
    if (hint) wrap.appendChild(ui.el('span.gl-field-hint', hint));
    var err = ui.el('span.gl-err', { id: 'lm-err-' + errKey, role: 'alert' });
    err.hidden = true;
    wrap.appendChild(err);
    input.setAttribute('aria-describedby', 'lm-err-' + errKey);
    return wrap;
  }
  function showErrors(box, errors, inputs) {
    var first = null;
    Object.keys(inputs).forEach(function (k) {
      var e = box.querySelector('#lm-err-' + k);
      var msg = errors[k];
      if (e) { e.textContent = msg || ''; e.hidden = !msg; }
      if (inputs[k]) {
        if (msg) inputs[k].setAttribute('aria-invalid', 'true');
        else inputs[k].removeAttribute('aria-invalid');
      }
      if (msg && !first) first = inputs[k];
    });
    if (first) first.focus();
  }

  /* ── add / edit form ─────────────────────────────────────────────── */
  function openForm(a) {
    var editing = !!a;
    var g = a || { position: '', company: '', status: 'applied', applicationDate: app.today(), jobUrl: '', gmailUrl: '', recruiterEmail: '', source: '', nextSchedule: null, followUpDate: null, notes: '' };
    var body = ui.el('div.form-grid.gl-form');
    var inPos = ui.el('input', { id: 'lm-pos', maxlength: JA().LIMITS.position, value: g.position, autocomplete: 'off', placeholder: 'Contoh: Frontend Engineer' });
    var inComp = ui.el('input', { id: 'lm-comp', maxlength: JA().LIMITS.company, value: g.company, autocomplete: 'off', placeholder: 'Contoh: PT Maju Jaya' });
    var inStatus = ui.el('select', { id: 'lm-status' });
    JA().STATUSES.forEach(function (s) {
      var o = ui.el('option', { value: s }, JA().STATUS_LABEL[s]);
      if (s === g.status) o.selected = true;
      inStatus.appendChild(o);
    });
    var inDate = ui.el('input', { id: 'lm-date', type: 'date', value: g.applicationDate || app.today() });
    var inJob = ui.el('input', { id: 'lm-job', type: 'url', maxlength: JA().LIMITS.url, value: g.jobUrl || '', placeholder: 'https://… (opsional)' });
    var inGmail = ui.el('input', { id: 'lm-gmail', type: 'url', maxlength: JA().LIMITS.url, value: g.gmailUrl || '', placeholder: 'https://mail.google.com/… (opsional)' });
    var inEmail = ui.el('input', { id: 'lm-email', type: 'email', maxlength: JA().LIMITS.email, value: g.recruiterEmail || '', placeholder: 'hr@perusahaan.co.id (opsional)' });
    var inSource = ui.el('select', { id: 'lm-source' });
    inSource.appendChild(ui.el('option', { value: '' }, '— Tidak disebutkan —'));
    JA().SOURCES.forEach(function (s) {
      var o = ui.el('option', { value: s }, JA().SOURCE_LABEL[s]);
      if (s === g.source) o.selected = true;
      inSource.appendChild(o);
    });
    var inSched = ui.el('input', { id: 'lm-sched', type: 'date', value: g.nextSchedule || '' });
    var inFollow = ui.el('input', { id: 'lm-follow', type: 'date', value: g.followUpDate || '' });
    var inNotes = ui.el('textarea', { id: 'lm-notes', maxlength: JA().LIMITS.notes, rows: 3, placeholder: 'Catatan tentang lamaran ini (opsional)' }, g.notes || '');

    body.appendChild(ui.el('div.gl-form-row', field('Posisi', inPos, 'position'), field('Nama perusahaan', inComp, 'company')));
    body.appendChild(ui.el('div.gl-form-row', field('Status', inStatus, 'status'), field('Tanggal melamar', inDate, 'applicationDate')));
    body.appendChild(field('Link lowongan (opsional)', inJob, 'jobUrl', 'Hanya URL http/https. Jangan sertakan password atau token di URL.'));
    body.appendChild(field('Link Gmail (opsional)', inGmail, 'gmailUrl'));
    body.appendChild(ui.el('div.gl-form-row', field('Email recruiter (opsional)', inEmail, 'recruiterEmail'), field('Sumber lamaran (opsional)', inSource, 'source')));
    body.appendChild(ui.el('div.gl-form-row',
      field('Jadwal berikutnya (opsional)', inSched, 'nextSchedule', 'Mis. tanggal psikotest / interview.'),
      field('Tanggal follow-up (opsional)', inFollow, 'followUpDate', 'Akan diingatkan di aplikasi bila terlewat.')));
    body.appendChild(field('Catatan (opsional)', inNotes, 'notes'));

    var inputs = { position: inPos, company: inComp, status: inStatus, applicationDate: inDate, jobUrl: inJob, gmailUrl: inGmail, recruiterEmail: inEmail, source: inSource, nextSchedule: inSched, followUpDate: inFollow };
    var busy = false;
    var dlg = ui.modal({
      title: editing ? 'Ubah lamaran' : 'Tambah lamaran', wide: true, body: body,
      actions: [
        { label: 'Batal', ghost: true },
        {
          label: editing ? 'Simpan' : 'Tambah lamaran', primary: true, onClick: function () {
            if (busy) return false;
            busy = true;
            var input = {
              position: inPos.value, company: inComp.value, status: inStatus.value,
              applicationDate: inDate.value, jobUrl: inJob.value.trim(), gmailUrl: inGmail.value.trim(),
              recruiterEmail: inEmail.value.trim(), source: inSource.value,
              nextSchedule: inSched.value || null, followUpDate: inFollow.value || null, notes: inNotes.value
            };
            var r = editing ? JA().updateApplication(st(), a.id, input, Date.now()) : JA().createApplication(st(), input, Date.now());
            if (!r.ok) {
              busy = false;
              if (r.errors) showErrors(dlg.box, r.errors, inputs);
              else ui.toast(failMsg(r), { kind: 'err' });
              return false;
            }
            persist(editing ? (r.changed ? 'Lamaran diperbarui.' : null) : 'Lamaran ditambahkan: ' + r.app.position + ' — ' + r.app.company);
            if (!editing) openApp(r.app.id);
            return true;
          }
        }
      ]
    });
  }

  /* ── status change (with optional note, recorded in history) ─────── */
  function openStatusForm(a) {
    var body = ui.el('div.form-grid');
    var sel = ui.el('select', { id: 'lm-st-new' });
    JA().STATUSES.forEach(function (s) {
      var o = ui.el('option', { value: s }, JA().STATUS_LABEL[s]);
      if (s === a.status) o.selected = true;
      sel.appendChild(o);
    });
    var note = ui.el('textarea', { id: 'lm-st-note', maxlength: JA().LIMITS.historyNotes, rows: 2, placeholder: 'Contoh: dijadwalkan via telepon (opsional)' });
    body.appendChild(field('Status baru', sel, 'status'));
    body.appendChild(field('Catatan perubahan (opsional)', note, 'statusNote'));
    body.appendChild(ui.el('div.hint', 'Status saat ini: ' + JA().STATUS_LABEL[a.status] + '. Setiap perubahan dicatat di riwayat dan tidak bisa dihapus.'));
    ui.modal({
      title: 'Ubah status lamaran', body: body,
      actions: [
        { label: 'Batal', ghost: true },
        {
          label: 'Simpan status', primary: true, onClick: function () {
            var r = JA().setStatus(st(), a.id, sel.value, note.value, Date.now());
            if (!r.ok) { ui.toast(failMsg(r), { kind: 'err' }); return false; }
            if (!r.changed) { ui.toast('Status tidak berubah.', { kind: 'ok' }); return true; }
            persist('Status diubah ke ' + JA().STATUS_LABEL[sel.value] + '.');
            return true;
          }
        }
      ]
    });
  }

  /* ── links (per application) ─────────────────────────────────────── */
  function openLinkForm(a, link) {
    var editing = !!link;
    var l = link || { label: '', url: '', notes: '' };
    var body = ui.el('div.form-grid');
    var inLabel = ui.el('input', { id: 'lm-lk-label', maxlength: JA().LIMITS.linkLabel, value: l.label, placeholder: 'Contoh: Lowongan LinkedIn', autocomplete: 'off' });
    var inUrl = ui.el('input', { id: 'lm-lk-url', type: 'url', maxlength: JA().LIMITS.url, value: l.url, placeholder: 'https://…' });
    var inNotes = ui.el('textarea', { id: 'lm-lk-notes', maxlength: JA().LIMITS.linkNotes, rows: 2, placeholder: 'Catatan singkat (opsional)' }, l.notes || '');
    body.appendChild(field('Label', inLabel, 'label'));
    body.appendChild(field('URL', inUrl, 'url', 'Hanya http/https, tanpa kredensial. Tautan juga tampil di Library sebagai referensi.'));
    body.appendChild(field('Catatan (opsional)', inNotes, 'notes'));
    var inputs = { label: inLabel, url: inUrl };
    var dlg = ui.modal({
      title: editing ? 'Ubah tautan' : 'Tambah tautan', body: body,
      actions: [
        { label: 'Batal', ghost: true },
        {
          label: editing ? 'Simpan' : 'Tambah', primary: true, onClick: function () {
            var input = { label: inLabel.value, url: inUrl.value.trim(), notes: inNotes.value };
            var r = editing ? JA().updateLink(st(), a.id, link.id, input, Date.now()) : JA().addLink(st(), a.id, input, Date.now());
            if (!r.ok) {
              if (r.errors) showErrors(dlg.box, r.errors, inputs);
              else ui.toast(failMsg(r), { kind: 'err' });
              return false;
            }
            persist(editing ? (r.changed ? 'Tautan diperbarui.' : null) : 'Tautan ditambahkan.');
            return true;
          }
        }
      ]
    });
  }
  function removeLink(a, l) {
    ui.confirm({
      title: 'Hapus tautan?',
      body: 'Tautan "' + l.label + '" akan dihapus dari lamaran ini dan dari tampilan Library. Tidak ada file yang dihapus.',
      okLabel: 'Hapus', danger: true
    }).then(function (ok) {
      if (!ok) return;
      var r = JA().removeLink(st(), a.id, l.id, Date.now());
      if (!r.ok) { ui.toast(failMsg(r), { kind: 'err' }); return; }
      persist('Tautan dihapus.');
    });
  }

  function doDelete(a) {
    ui.confirm({
      title: 'Hapus lamaran ini?',
      body: 'Lamaran "' + a.position + ' — ' + a.company + '" beserta riwayat status dan ' + a.links.length + ' tautannya akan dihapus permanen. File di Library tidak ikut dihapus.',
      okLabel: 'Hapus', danger: true
    }).then(function (ok) {
      if (!ok) return;
      var r = JA().deleteApplication(st(), a.id, Date.now());
      if (!r.ok) { ui.toast(failMsg(r), { kind: 'err' }); return; }
      persist('Lamaran dihapus.');
      openList();
    });
  }

  /* ── reminders (in-app only; no scheduled notifications exist) ───── */
  function renderReminders(host) {
    var list = JA().reminders(st(), app.today());
    if (!list.length) return;
    var card = ui.el('section.card.lm-reminders', { 'aria-label': 'Pengingat lamaran' });
    card.appendChild(ui.el('div.gl-sec-head', ui.el('h2', 'Pengingat'),
      ui.el('span.hint', 'Ditampilkan di aplikasi berdasarkan tanggal yang Anda isi — bukan notifikasi terjadwal.')));
    var ul = ui.el('ul.lm-rem-list');
    list.slice(0, 8).forEach(function (r) {
      var info = { days: r.days, overdue: r.overdue, soon: r.soon };
      var chipCls = r.overdue ? '.danger' : (r.days === 0 || r.soon) ? '.warn' : '.outline';
      var b = ui.el('button.lm-rem-row' + (r.overdue ? '.overdue' : ''), {
        type: 'button', dataset: { fk: 'rem-' + r.appId + '-' + r.kind },
        onclick: function () { openApp(r.appId); },
        title: r.position + ' — ' + r.company
      },
        ui.el('span.chip' + (r.kind === 'followup' ? '.lilac' : '.accent'), r.kind === 'followup' ? 'Follow-up' : 'Jadwal'),
        ui.el('span.lm-rem-t', r.position + ' · ' + r.company),
        ui.el('span.lm-rem-d', fmtDay(r.day)),
        ui.el('span.chip' + chipCls, relText(info)));
      ul.appendChild(ui.el('li', b));
    });
    card.appendChild(ul);
    if (list.length > 8) card.appendChild(ui.el('div.hint', (list.length - 8) + ' pengingat lainnya ada di detail masing-masing lamaran.'));
    host.appendChild(card);
  }

  /* ── list (main table) ───────────────────────────────────────────── */
  function renderList(host) {
    var state = st();
    var all = JA().list(state);
    renderReminders(host);

    var bar = ui.el('div.lm-toolbar');
    var search = ui.el('input', {
      type: 'search', placeholder: 'Cari posisi atau perusahaan…', 'aria-label': 'Cari lamaran',
      value: filters.search, autocomplete: 'off', dataset: { fk: 'lm-search' }
    });
    search.addEventListener('input', function () { filters.search = search.value; JF.pages.get('goals').render(); });
    var selStatus = ui.el('select', { 'aria-label': 'Filter status', dataset: { fk: 'lm-filter-status' } });
    selStatus.appendChild(ui.el('option', { value: 'all' }, 'Semua status'));
    JA().STATUSES.forEach(function (s) {
      var o = ui.el('option', { value: s }, JA().STATUS_LABEL[s]);
      if (filters.status === s) o.selected = true;
      selStatus.appendChild(o);
    });
    selStatus.addEventListener('change', function () { filters.status = selStatus.value; JF.pages.get('goals').render(); setTimeout(() => document.querySelector('select[lm-filter-status]')?.blur(), 0); });
    var selSort = ui.el('select', { 'aria-label': 'Urutkan', dataset: { fk: 'lm-sort' } });
    [['date', 'Tanggal melamar · terbaru'], ['date-asc', 'Tanggal melamar · terlama'], ['updated', 'Terakhir diperbarui']].forEach(function (d) {
      var o = ui.el('option', { value: d[0] }, d[1]);
      if (filters.sort === d[0]) o.selected = true;
      selSort.appendChild(o);
    });
    selSort.addEventListener('change', function () { filters.sort = selSort.value; JF.pages.get('goals').render(); setTimeout(() => document.querySelector('select[lm-sort]')?.blur(), 0); });
    bar.appendChild(search); bar.appendChild(selStatus); bar.appendChild(selSort);
    host.appendChild(bar);

    if (!all.length) {
      var empty = ui.el('div.empty.gl-empty');
      empty.appendChild(ui.el('span.big', 'Belum ada lamaran kerja'));
      empty.appendChild(ui.el('p', 'Catat setiap lamaran: posisi, perusahaan, status, jadwal, dan tautannya. Riwayat status tersimpan otomatis dan analitiknya muncul di halaman Analitik.'));
      var b = ui.btn('+ Tambah Lamaran', function () { openForm(null); }, { primary: true });
      b.dataset.fk = 'lm-empty-new';
      empty.appendChild(b);
      host.appendChild(empty);
      return;
    }

    var rows = JA().query(state, filters);
    host.appendChild(ui.el('div.lm-count', { 'aria-live': 'polite' }, rows.length + ' dari ' + all.length + ' lamaran'));

    if (!rows.length) {
      var noMatch = ui.el('div.empty', ui.el('span.big', 'Tidak ada lamaran yang cocok'), 'Coba ubah kata kunci atau filter status.');
      var reset = ui.btn('Reset filter', function () { filters = { search: '', status: 'all', sort: 'date' }; JF.pages.get('goals').render(); }, { ghost: true, sm: true });
      reset.dataset.fk = 'lm-reset';
      noMatch.appendChild(reset);
      host.appendChild(noMatch);
      return;
    }

    var wrap = ui.el('div.lm-table-wrap');
    var table = ui.el('table.lm-table', { 'aria-label': 'Daftar lamaran kerja' });
    var thead = ui.el('thead');
    var hr = ui.el('tr');
    ['No.', 'Posisi', 'Nama Perusahaan', 'Status', 'Tanggal Melamar', 'Link/Gmail', 'Aksi'].forEach(function (h) {
      hr.appendChild(ui.el('th', { scope: 'col' }, h));
    });
    thead.appendChild(hr); table.appendChild(thead);
    var tbody = ui.el('tbody');
    rows.forEach(function (a, i) {
      var tr = ui.el('tr');
      tr.appendChild(ui.el('td.lm-no', String(i + 1)));
      var pos = ui.el('button.lm-pos', { type: 'button', title: a.position, dataset: { fk: 'pos-' + a.id }, onclick: function () { openApp(a.id); } }, a.position);
      tr.appendChild(ui.el('td', pos));
      tr.appendChild(ui.el('td', ui.el('span.lm-company', { title: a.company }, a.company)));
      tr.appendChild(ui.el('td', statusChip(a)));
      tr.appendChild(ui.el('td.lm-date', { title: ui.fmt.date(a.applicationDate) }, fmtDay(a.applicationDate)));
      var links = ui.el('td');
      var linkBox = ui.el('div.lm-links');
      if (a.jobUrl) linkBox.appendChild(iconBtn(ICON.ext, 'Buka link lowongan', function () { openExternal(a.jobUrl); }, 'job-' + a.id));
      if (a.gmailUrl) linkBox.appendChild(iconBtn(ICON.mail, 'Buka link Gmail', function () { openExternal(a.gmailUrl); }, 'gmail-' + a.id));
      if (!a.jobUrl && !a.gmailUrl) linkBox.appendChild(ui.el('span.lm-none', '—'));
      links.appendChild(linkBox);
      tr.appendChild(links);
      var acts = ui.el('td');
      var actBox = ui.el('div.lm-acts');
      var det = ui.btn('Detail', function () { openApp(a.id); }, { sm: true, ghost: true });
      det.dataset.fk = 'det-' + a.id;
      actBox.appendChild(det);
      actBox.appendChild(iconBtn(ui.ICON.edit, 'Ubah lamaran ' + a.position, function () { openForm(a); }, 'edit-' + a.id));
      actBox.appendChild(iconBtn(ui.ICON.trash, 'Hapus lamaran ' + a.position, function () { doDelete(a); }, 'del-' + a.id));
      acts.appendChild(actBox);
      tr.appendChild(acts);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    host.appendChild(wrap);
  }

  /* ── detail ──────────────────────────────────────────────────────── */
  function infoRow(label, valueNode) {
    return ui.el('div.lm-info-row', ui.el('span.lm-info-k', label), ui.el('span.lm-info-v', valueNode));
  }
  function urlNode(url) {
    if (!url) return ui.el('span.lm-none', '—');
    var box = ui.el('span.lm-url-box');
    box.appendChild(ui.el('span.lm-url', { title: url }, url));
    var b = ui.btn('Buka', function () { openExternal(url); }, { sm: true, ghost: true });
    box.appendChild(b);
    return box;
  }

  function renderDetail(host, id) {
    var a = JA().find(st(), id);
    if (!a) {
      var box = ui.el('div.empty');
      box.appendChild(ui.el('span.big', 'Lamaran tidak ditemukan'));
      box.appendChild(ui.el('p', 'Lamaran ini mungkin sudah dihapus atau tidak ada setelah data dipulihkan dari cadangan.'));
      var back = ui.btn('Kembali ke daftar lamaran', openList, { ghost: true });
      back.dataset.fk = 'lm-back';
      box.appendChild(back);
      host.appendChild(box);
      return;
    }

    var head = ui.el('section.card.lm-hero');
    var top = ui.el('div.gl-hero-top');
    var back = ui.btn('', openList, { ghost: true, sm: true });
    back.dataset.fk = 'lm-back';
    back.appendChild(ui.svg(ui.ICON.chevL, 14));
    back.appendChild(document.createTextNode('Semua lamaran'));
    top.appendChild(back);
    var acts = ui.el('div.gl-hero-acts');
    var edit = ui.btn('Ubah', function () { openForm(a); }, { ghost: true, sm: true }); edit.dataset.fk = 'lm-edit';
    var stBtn = ui.btn('Ubah status', function () { openStatusForm(a); }, { primary: true, sm: true }); stBtn.dataset.fk = 'lm-status';
    var del = ui.btn('Hapus', function () { doDelete(a); }, { danger: true, sm: true }); del.dataset.fk = 'lm-del';
    acts.appendChild(edit); acts.appendChild(stBtn); acts.appendChild(del);
    top.appendChild(acts);
    head.appendChild(top);
    head.appendChild(ui.el('h2.gl-hero-title', a.position));
    head.appendChild(ui.el('div.lm-company-big', a.company));
    var meta = ui.el('div.gl-meta');
    meta.appendChild(statusChip(a));
    meta.appendChild(ui.el('span.chip.outline', 'Melamar ' + fmtDay(a.applicationDate)));
    if (a.source) meta.appendChild(ui.el('span.chip.outline', 'Sumber: ' + JA().SOURCE_LABEL[a.source]));
    head.appendChild(meta);
    head.appendChild(ui.el('div.hint.lm-timestamps', 'Dibuat ' + ui.fmt.dateTime(a.createdAt) + ' · Diperbarui ' + ui.fmt.dateTime(a.updatedAt)));
    host.appendChild(head);

    var grid = ui.el('div.gl-detail');
    var main = ui.el('div.gl-detail-main');
    var side = ui.el('div.gl-detail-side');

    /* info card */
    var info = ui.el('section.card', { 'aria-label': 'Detail lamaran' });
    info.appendChild(ui.el('div.gl-sec-head', ui.el('h2', 'Informasi lamaran')));
    info.appendChild(infoRow('Tanggal melamar', ui.fmt.date(a.applicationDate)));
    info.appendChild(infoRow('Sumber', a.source ? JA().SOURCE_LABEL[a.source] : '—'));
    var emailBox = ui.el('span.lm-url-box');
    if (a.recruiterEmail) {
      emailBox.appendChild(ui.el('span', a.recruiterEmail));
      var cp = ui.btn('Salin', function () {
        ui.copyText(a.recruiterEmail).then(function (ok) { ui.toast(ok ? 'Email disalin.' : 'Tidak bisa menyalin.', { kind: ok ? 'ok' : 'err' }); });
      }, { sm: true, ghost: true });
      emailBox.appendChild(cp);
    } else emailBox.appendChild(ui.el('span.lm-none', '—'));
    info.appendChild(infoRow('Email recruiter', emailBox));
    info.appendChild(infoRow('Link lowongan', urlNode(a.jobUrl)));
    info.appendChild(infoRow('Link Gmail', urlNode(a.gmailUrl)));
    info.appendChild(infoRow('Catatan', a.notes ? ui.el('span.lm-notes', a.notes) : '—'));
    main.appendChild(info);

    /* links card */
    var linksCard = ui.el('section.card', { 'aria-label': 'Tautan lamaran' });
    var lkHead = ui.el('div.gl-sec-head');
    lkHead.appendChild(ui.el('h2', 'Tautan (' + a.links.length + ')'));
    var addLk = ui.btn('+ Tambah tautan', function () { openLinkForm(a, null); }, { sm: true, primary: true });
    addLk.dataset.fk = 'lm-link-add';
    lkHead.appendChild(addLk);
    linksCard.appendChild(lkHead);
    linksCard.appendChild(ui.el('div.hint', 'Hanya tautan (tanpa unggah dokumen). Tautan ini juga tampil di Library pada kategori "Lamaran Kerja" sebagai referensi.'));
    if (!a.links.length) {
      linksCard.appendChild(ui.el('div.empty.gl-empty-sm', ui.el('span.big', 'Belum ada tautan'), 'Tambahkan link lowongan, Gmail, atau dokumen online terkait lamaran ini.'));
    } else {
      var lkList = ui.el('div.lm-link-list');
      a.links.forEach(function (l) {
        var row = ui.el('div.lm-link-row');
        var body = ui.el('div.lm-link-body');
        body.appendChild(ui.el('div.lm-link-label', l.label));
        body.appendChild(ui.el('div.lm-url', { title: l.url }, l.url));
        if (l.notes) body.appendChild(ui.el('div.hint', l.notes));
        row.appendChild(body);
        var la = ui.el('div.lm-acts');
        var open = ui.btn('Buka', function () { openExternal(l.url); }, { sm: true, ghost: true }); open.dataset.fk = 'lk-open-' + l.id;
        var ed = ui.btn('Ubah', function () { openLinkForm(a, l); }, { sm: true, ghost: true }); ed.dataset.fk = 'lk-edit-' + l.id;
        var rm = ui.btn('Hapus', function () { removeLink(a, l); }, { sm: true, danger: true }); rm.dataset.fk = 'lk-del-' + l.id;
        la.appendChild(open); la.appendChild(ed); la.appendChild(rm);
        row.appendChild(la);
        lkList.appendChild(row);
      });
      linksCard.appendChild(lkList);
    }
    main.appendChild(linksCard);

    /* history card (append-only timeline) */
    var histCard = ui.el('section.card', { 'aria-label': 'Riwayat status' });
    histCard.appendChild(ui.el('div.gl-sec-head', ui.el('h2', 'Riwayat status'), ui.el('span.hint', a.history.length + ' catatan · tidak bisa dihapus')));
    var ol = ui.el('ol.lm-history');
    a.history.slice().sort(function (x, y) { return y.changedAt - x.changedAt; }).forEach(function (h) {
      var li = ui.el('li.lm-hist');
      var line = ui.el('div.lm-hist-line');
      if (h.previousStatus == null) {
        line.appendChild(ui.el('span.chip.accent', 'Lamaran dibuat'));
        line.appendChild(ui.el('span.lm-hist-arrow', { 'aria-hidden': 'true' }, '→'));
        line.appendChild(ui.el('span.chip.' + (JA().STATUS_TONE[h.newStatus] || 'outline'), JA().STATUS_LABEL[h.newStatus]));
      } else {
        line.appendChild(ui.el('span.chip.outline', JA().STATUS_LABEL[h.previousStatus] || h.previousStatus));
        line.appendChild(ui.el('span.lm-hist-arrow', { 'aria-hidden': 'true' }, '→'));
        line.appendChild(ui.el('span.chip.' + (JA().STATUS_TONE[h.newStatus] || 'outline'), JA().STATUS_LABEL[h.newStatus]));
      }
      li.appendChild(line);
      li.appendChild(ui.el('div.lm-hist-at', ui.fmt.dateTime(h.changedAt)));
      if (h.notes) li.appendChild(ui.el('div.hint', h.notes));
      ol.appendChild(li);
    });
    histCard.appendChild(ol);
    main.appendChild(histCard);

    /* side: schedule + follow-up */
    var sched = ui.el('section.card', { 'aria-label': 'Jadwal dan follow-up' });
    sched.appendChild(ui.el('div.gl-sec-head', ui.el('h2', 'Jadwal & follow-up')));
    var today = app.today();
    [['Jadwal berikutnya', a.nextSchedule], ['Follow-up', a.followUpDate]].forEach(function (d) {
      var info2 = JA().dateInfo(d[1], today);
      var row = ui.el('div.lm-sched-row');
      row.appendChild(ui.el('span.lm-info-k', d[0]));
      if (!info2) row.appendChild(ui.el('span.lm-none', 'Belum diatur'));
      else {
        var closed = JA().TERMINAL.indexOf(a.status) >= 0;
        var cls = closed ? '.outline' : info2.overdue ? '.danger' : (info2.days === 0 || info2.soon) ? '.warn' : '.outline';
        row.appendChild(ui.el('span.lm-sched-v', fmtDay(d[1]), ' ', ui.el('span.chip' + cls, closed ? JA().STATUS_LABEL[a.status] : relText(info2))));
      }
      sched.appendChild(row);
    });
    sched.appendChild(ui.el('div.hint', 'Pengingat ditampilkan di aplikasi ini, bukan notifikasi terjadwal. Lamaran dengan hasil akhir (Diterima/Ditolak/Withdrawn) tidak diingatkan lagi.'));
    side.appendChild(sched);

    /* side: quick external links */
    var quick = ui.el('section.card', { 'aria-label': 'Tautan cepat' });
    quick.appendChild(ui.el('div.gl-sec-head', ui.el('h2', 'Tautan cepat')));
    if (a.jobUrl) {
      var q1 = ui.btn('Buka link lowongan', function () { openExternal(a.jobUrl); }, { ghost: true, block: true }); q1.dataset.fk = 'lm-q-job';
      quick.appendChild(q1);
    }
    if (a.gmailUrl) {
      var q2 = ui.btn('Buka link Gmail', function () { openExternal(a.gmailUrl); }, { ghost: true, block: true }); q2.dataset.fk = 'lm-q-gmail';
      quick.appendChild(q2);
    }
    if (!a.jobUrl && !a.gmailUrl) quick.appendChild(ui.el('div.hint', 'Belum ada link lowongan atau Gmail. Tambahkan lewat tombol Ubah.'));
    quick.appendChild(ui.el('div.hint', 'Tautan dibuka di browser default aplikasi (http/https saja).'));
    side.appendChild(quick);

    grid.appendChild(main); grid.appendChild(side);
    host.appendChild(grid);
  }

  JF.lamaran = {
    init: init, viewFromHash: viewFromHash, openList: openList, openApp: openApp,
    openForm: openForm, renderList: renderList, renderDetail: renderDetail
  };
})(typeof self !== 'undefined' ? self : this);