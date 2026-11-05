/* Jam Fokus - Goals: long-term goals, milestones, linked existing tasks and
   transparent progress. Routes: #goals (overview) and #goals?id=<goalId>
   (detail). All data goes through JF.goals and is persisted with app.save(). */
(function (root) {
  'use strict';
  var JF = root.JF;
  var ui, app, host;
  var tab = 'aktif';

  var ICON = {
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
    unlink: '<path d="M6 6l12 12"/><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    clip: '<path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.5 17.2a1.7 1.7 0 0 1-2.4-2.4L14.5 7.5"/>',
    journal: '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8 3.5v17M11.5 8.5h4M11.5 12h4"/>'
  };

  /* ── routing ─────────────────────────────────────────────────────── */
  function goalIdFromHash() {
    var hash = location.hash || '';
    if (hash.replace(/^#/, '').split('?')[0] !== 'goals') return null;
    var q = hash.indexOf('?') >= 0 ? hash.slice(hash.indexOf('?') + 1) : '';
    var m = /(?:^|&)id=([^&]+)/.exec(q);
    if (!m) return null;
    try { return decodeURIComponent(m[1]) || null; } catch (e) { return null; }
  }
  function openGoal(id) { location.hash = '#goals?id=' + encodeURIComponent(id); }
  function openOverview() { location.hash = '#goals'; }

  /* ── helpers ─────────────────────────────────────────────────────── */
  function st() { return app.rawState(); }
  function G() { return JF.goals; }

  function persist(okMsg) {
    var ok = app.save();
    if (!ok) ui.toast('Perubahan belum tersimpan permanen. Periksa ruang penyimpanan lalu coba lagi.', { kind: 'err', timeout: 9000 });
    else if (okMsg) ui.toast(okMsg, { kind: 'ok' });
    return ok;
  }

  function failMsg(r) {
    var map = {
      'not-found': 'Goal tidak ditemukan.', archived: 'Goal diarsipkan. Pulihkan dulu untuk mengubahnya.',
      'milestone-not-found': 'Milestone tidak ditemukan.', 'task-not-found': 'Tugas tidak ditemukan.',
      'task-archived': 'Tugas yang diarsipkan tidak bisa ditautkan.'
    };
    return map[r && r.reason] || 'Perubahan tidak bisa disimpan.';
  }

  function iconBtn(icon, label, onClick, opts) {
    opts = opts || {};
    var b = ui.el('button.icb' + (opts.cls ? '.' + opts.cls : ''), {
      type: 'button', title: label, 'aria-label': label, onclick: onClick, disabled: !!opts.disabled,
      dataset: opts.fk ? { fk: opts.fk } : null
    }, ui.svg(icon, 16));
    return b;
  }
  function fkBtn(label, onClick, opts, fk) {
    var b = ui.btn(label, onClick, opts);
    if (fk) b.dataset.fk = fk;
    return b;
  }

  function statusChip(goal) {
    var cls = { not_started: '.outline', in_progress: '.accent', on_hold: '.warn', completed: '.ok' }[goal.status] || '.outline';
    var label = G().STATUS_LABEL[goal.status] || goal.status;
    return ui.el('span.chip' + cls, { title: goal.status === 'completed' ? 'Ditandai selesai secara manual' : null }, label);
  }

  function deadlineText(info) {
    if (!info) return '';
    if (info.overdue) return 'Terlambat ' + Math.abs(info.days) + ' hari';
    if (info.days === 0) return 'Tenggat hari ini';
    if (info.days === 1) return 'Tenggat besok';
    return info.days + ' hari lagi';
  }

  function deadlineChip(deadline, done) {
    if (!deadline) return null;
    var info = G().deadlineInfo(deadline, app.today());
    var cls = done ? '.outline' : info.overdue ? '.danger' : info.soon ? '.warn' : '.outline';
    var txt = 'Tenggat ' + ui.fmt.dateShort(deadline);
    if (!done && info) txt += ' · ' + deadlineText(info).replace(/^Tenggat /, '');
    return ui.el('span.chip' + cls, txt);
  }

  function fmtNum(n) {
    return (Math.round(n * 100) / 100).toLocaleString('id-ID');
  }

  function progressBar(p, label) {
    var pct = p.pct == null ? 0 : p.pct;
    var bar = ui.el('div.gl-bar' + (pct >= 100 ? '.ok' : ''), {
      role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100',
      'aria-valuenow': p.pct == null ? null : String(pct),
      'aria-valuetext': p.pct == null ? 'Belum bisa dihitung' : pct + '%',
      'aria-label': label || 'Progres goal'
    }, ui.el('i', { style: { width: pct + '%' } }));
    return bar;
  }

  /** Short human explanation of the numbers behind a progress value. */
  function progressDetail(p) {
    if (p.method === 'milestones') {
      return p.total ? p.done + ' dari ' + p.total + ' milestone selesai' : 'Belum ada milestone';
    }
    if (p.method === 'tasks') {
      var s = p.total ? p.done + ' dari ' + p.total + ' tugas terkait selesai' : 'Belum ada tugas terkait';
      var extra = [];
      if (p.archived) extra.push(p.archived + ' diarsipkan');
      if (p.missing) extra.push(p.missing + ' tidak ditemukan');
      return s + (extra.length ? ' (' + extra.join(', ') + ', tidak dihitung)' : '');
    }
    if (!(p.total > 0)) return 'Target angka belum diatur';
    var u = p.unit ? ' ' + p.unit : '';
    return fmtNum(p.done) + ' dari ' + fmtNum(p.total) + u + (p.overTarget ? ' (melampaui target)' : '');
  }

  function formulaText(method) {
    if (method === 'milestones') return 'Progres = milestone selesai ÷ semua milestone.';
    if (method === 'tasks') return 'Progres = tugas terkait yang selesai ÷ tugas terkait yang aktif. Tugas diarsipkan atau terhapus tidak dihitung, dan setiap tugas hanya dihitung sekali.';
    return 'Progres = nilai saat ini ÷ nilai target, maksimal 100%.';
  }

  /* ── focus restore across full re-renders ────────────────────────── */
  function rememberFocus() {
    var a = document.activeElement;
    return a && host && host.contains(a) && a.dataset ? a.dataset.fk || null : null;
  }
  function restoreFocus(fk) {
    if (!fk) return;
    var n = host.querySelector('[data-fk="' + (root.CSS && CSS.escape ? CSS.escape(fk) : fk) + '"]');
    if (n && !n.disabled) { try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } }
  }

  /* ── forms ───────────────────────────────────────────────────────── */
  function field(label, input, errKey, hint) {
    var wrap = ui.el('label.field', label, input);
    if (hint) wrap.appendChild(ui.el('span.gl-field-hint', hint));
    var err = ui.el('span.gl-err', { id: 'gl-err-' + errKey, role: 'alert' });
    err.hidden = true;
    wrap.appendChild(err);
    input.setAttribute('aria-describedby', 'gl-err-' + errKey);
    return wrap;
  }

  function showErrors(box, errors, inputs) {
    var first = null;
    Object.keys(inputs).forEach(function (k) {
      var e = box.querySelector('#gl-err-' + k);
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

  function openGoalForm(goal) {
    var editing = !!goal;
    var g = goal || { title: '', description: '', category: '', startDate: app.today(), deadline: null, status: 'not_started', progressMethod: 'milestones', target: null };
    var body = ui.el('div.form-grid.gl-form');
    var inTitle = ui.el('input', { id: 'gl-title', maxlength: G().LIMITS.title, value: g.title, autocomplete: 'off', placeholder: 'Contoh: Lulus sertifikasi data analyst' });
    var inDesc = ui.el('textarea', { id: 'gl-desc', maxlength: G().LIMITS.description, rows: 3, placeholder: 'Mengapa goal ini penting? (opsional)' }, g.description || '');
    var inCat = ui.el('input', { id: 'gl-cat', maxlength: G().LIMITS.category, value: g.category || '', list: 'gl-cat-list', autocomplete: 'off', placeholder: 'Contoh: Karier' });
    var dl = ui.el('datalist', { id: 'gl-cat-list' });
    G().categories(st()).forEach(function (c) { dl.appendChild(ui.el('option', { value: c })); });
    var inStart = ui.el('input', { id: 'gl-start', type: 'date', value: g.startDate || app.today() });
    var inDeadline = ui.el('input', { id: 'gl-deadline', type: 'date', value: g.deadline || '' });
    var inStatus = ui.el('select', { id: 'gl-status' });
    G().STATUSES.forEach(function (s) {
      var o = ui.el('option', { value: s }, G().STATUS_LABEL[s]);
      if (s === g.status) o.selected = true;
      inStatus.appendChild(o);
    });
    var inMethod = ui.el('select', { id: 'gl-method' });
    G().METHODS.forEach(function (m) {
      var o = ui.el('option', { value: m }, G().METHOD_LABEL[m]);
      if (m === g.progressMethod) o.selected = true;
      inMethod.appendChild(o);
    });
    var methodHint = ui.el('div.hint.gl-method-hint', { 'aria-live': 'polite' });
    var t = g.target || {};
    var inTv = ui.el('input', { id: 'gl-tv', type: 'number', min: '0', step: 'any', value: t.value != null ? t.value : '', placeholder: '20' });
    var inTc = ui.el('input', { id: 'gl-tc', type: 'number', min: '0', step: 'any', value: t.current != null ? t.current : 0 });
    var inTu = ui.el('input', { id: 'gl-tu', maxlength: G().LIMITS.unit, value: t.unit || '', placeholder: 'latihan' });
    var targetRow = ui.el('div.gl-form-row.gl-target-row',
      field('Nilai target', inTv, 'targetValue'),
      field('Nilai saat ini', inTc, 'targetCurrent'),
      field('Satuan (opsional)', inTu, 'targetUnit'));

    function paintMethod() {
      methodHint.textContent = formulaText(inMethod.value);
      targetRow.hidden = inMethod.value !== 'target';
    }
    inMethod.addEventListener('change', paintMethod);

    body.appendChild(field('Judul goal', inTitle, 'title'));
    body.appendChild(field('Deskripsi (opsional)', inDesc, 'description'));
    body.appendChild(ui.el('div.gl-form-row', field('Kategori (opsional)', inCat, 'category'), dl,
      field('Status', inStatus, 'status')));
    body.appendChild(ui.el('div.gl-form-row', field('Tanggal mulai', inStart, 'startDate'),
      field('Tenggat (opsional)', inDeadline, 'deadline')));
    body.appendChild(field('Cara menghitung progres', inMethod, 'progressMethod'));
    body.appendChild(methodHint);
    body.appendChild(targetRow);
    paintMethod();

    var inputs = { title: inTitle, startDate: inStart, deadline: inDeadline, status: inStatus, progressMethod: inMethod, targetValue: inTv, targetCurrent: inTc };

    var dlg = ui.modal({
      title: editing ? 'Ubah goal' : 'Goal baru', wide: true, body: body,
      actions: [
        { label: 'Batal', ghost: true },
        {
          label: editing ? 'Simpan' : 'Buat goal', primary: true, onClick: function () {
            var input = {
              title: inTitle.value, description: inDesc.value, category: inCat.value,
              startDate: inStart.value, deadline: inDeadline.value || null,
              status: inStatus.value, progressMethod: inMethod.value,
              target: inMethod.value === 'target'
                ? { value: inTv.value, current: inTc.value, unit: inTu.value }
                : (g.target || undefined)
            };
            var r = editing ? G().updateGoal(st(), g.id, input, Date.now()) : G().createGoal(st(), input, Date.now());
            if (!r.ok) {
              if (r.errors) showErrors(dlg.box, r.errors, inputs);
              else ui.toast(failMsg(r), { kind: 'err' });
              return false;
            }
            persist(editing ? (r.changed ? 'Goal diperbarui.' : null) : 'Goal dibuat: ' + r.goal.title);
            if (!editing) openGoal(r.goal.id);
            return true;
          }
        }
      ]
    });
  }

  function openMilestoneForm(goal, ms) {
    var editing = !!ms;
    var m = ms || { title: '', description: '', criteria: '', deadline: null };
    var body = ui.el('div.form-grid.gl-form');
    var inTitle = ui.el('input', { id: 'ms-title', maxlength: G().LIMITS.title, value: m.title, autocomplete: 'off', placeholder: 'Contoh: Selesaikan modul statistik' });
    var inDesc = ui.el('textarea', { id: 'ms-desc', maxlength: G().LIMITS.description, rows: 2, placeholder: 'Catatan singkat (opsional)' }, m.description || '');
    var inCrit = ui.el('textarea', { id: 'ms-crit', maxlength: G().LIMITS.criteria, rows: 2, placeholder: 'Kapan milestone ini dianggap selesai? (opsional)' }, m.criteria || '');
    var inDeadline = ui.el('input', { id: 'ms-deadline', type: 'date', value: m.deadline || '' });
    body.appendChild(field('Judul milestone', inTitle, 'msTitle'));
    body.appendChild(field('Deskripsi (opsional)', inDesc, 'msDesc'));
    body.appendChild(field('Kriteria selesai (opsional)', inCrit, 'msCriteria'));
    var hint = goal.deadline ? 'Tenggat goal: ' + ui.fmt.dateShort(goal.deadline) + '.' : null;
    body.appendChild(field('Tenggat (opsional)', inDeadline, 'msDeadline', hint));
    var dlg = ui.modal({
      title: editing ? 'Ubah milestone' : 'Milestone baru', body: body,
      actions: [
        { label: 'Batal', ghost: true },
        {
          label: editing ? 'Simpan' : 'Tambah', primary: true, onClick: function () {
            var input = { title: inTitle.value, description: inDesc.value, criteria: inCrit.value, deadline: inDeadline.value || null };
            var r = editing ? G().updateMilestone(st(), goal.id, m.id, input, Date.now()) : G().addMilestone(st(), goal.id, input, Date.now());
            if (!r.ok) {
              if (r.errors) showErrors(dlg.box, { msTitle: r.errors.title, msDeadline: r.errors.deadline }, { msTitle: inTitle, msDeadline: inDeadline });
              else ui.toast(failMsg(r), { kind: 'err' });
              return false;
            }
            persist(editing ? null : 'Milestone ditambahkan.');
            return true;
          }
        }
      ]
    });
  }

  /** Pick existing tasks for a goal location (goal level or one milestone). */
  function openLinkTasks(goal, milestoneId) {
    var state = st();
    var dest = milestoneId ? G().findMilestone(goal, milestoneId) : null;
    var tasks = state.tasks.filter(function (t) { return !t.archived; }).sort(function (a, b) {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      return String(a.targetDate).localeCompare(String(b.targetDate));
    });
    var body = ui.el('div.form-grid');
    body.appendChild(ui.el('p.hint', dest
      ? 'Pilih tugas yang mendukung milestone "' + dest.title + '". Tugas tetap dikelola di halaman Tugas.'
      : 'Pilih tugas yang mendukung goal ini secara langsung. Tugas tetap dikelola di halaman Tugas.'));
    if (!tasks.length) {
      body.appendChild(ui.el('div.empty', ui.el('span.big', 'Belum ada tugas aktif'), 'Buat tugas di halaman Tugas, lalu tautkan di sini.'));
      ui.modal({
        title: 'Tautkan tugas', body: body,
        actions: [
          { label: 'Tutup', ghost: true },
          { label: 'Buka Tugas', primary: true, onClick: function () { location.hash = '#tugas'; } }
        ]
      });
      return;
    }
    var search = ui.el('input', { type: 'search', placeholder: 'Cari tugas…', 'aria-label': 'Cari tugas', autocomplete: 'off' });
    body.appendChild(search);
    var listBox = ui.el('div.gl-pick', { role: 'group', 'aria-label': 'Daftar tugas' });
    var checks = [];
    var here = dest ? dest.id : null;
    tasks.forEach(function (t) {
      var loc = G().locationOf(goal, t.id);
      var cb = ui.el('input', { type: 'checkbox', value: t.id });
      cb.checked = loc === here;
      var meta = [ui.fmt.dateShort(t.targetDate)];
      if (t.done) meta.push('selesai');
      if (loc !== undefined && loc !== here) {
        var other = loc ? G().findMilestone(goal, loc) : null;
        meta.push('sekarang di ' + (other ? 'milestone "' + other.title + '"' : 'goal ini langsung') + ', akan dipindah');
      }
      var row = ui.el('label.gl-pick-row', cb,
        ui.el('span.gl-pick-body', ui.el('span.gl-pick-title', t.title), ui.el('span.gl-pick-meta', meta.join(' · '))));
      row.dataset.q = t.title.toLowerCase();
      checks.push({ cb: cb, task: t, loc: loc, row: row });
      listBox.appendChild(row);
    });
    body.appendChild(listBox);
    body.appendChild(ui.el('div.hint', 'Satu tugas hanya dihitung sekali dalam satu goal. Menautkan ke lokasi lain akan memindahkannya.'));
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      checks.forEach(function (c) { c.row.hidden = !!q && c.row.dataset.q.indexOf(q) < 0; });
    });
    ui.modal({
      title: 'Tautkan tugas', body: body, wide: true,
      actions: [
        { label: 'Batal', ghost: true },
        {
          label: 'Simpan tautan', primary: true, onClick: function () {
            var now = Date.now(), changed = 0, failed = 0;
            checks.forEach(function (c) {
              var r = null;
              if (c.cb.checked && c.loc !== here) r = G().linkTask(st(), goal.id, c.task.id, here, now);
              else if (!c.cb.checked && c.loc === here) r = G().unlinkTask(st(), goal.id, c.task.id, now);
              if (r && r.ok && r.changed) changed++;
              else if (r && !r.ok) failed++;
            });
            if (changed) persist('Tautan tugas diperbarui.');
            if (failed) ui.toast(failed + ' tugas tidak bisa ditautkan.', { kind: 'err' });
            return true;
          }
        }
      ]
    });
  }

  /* ── actions ─────────────────────────────────────────────────────── */
  function doComplete(goal) {
    var p = G().progress(st(), goal);
    var note = p.pct != null && p.pct < 100
      ? 'Progres terhitung saat ini ' + p.pct + '%. Goal tetap bisa ditandai selesai secara manual; '
      : '';
    ui.confirm({
      title: 'Tandai goal selesai?',
      body: note + 'Tugas dan milestone yang terkait tidak ikut ditandai selesai.',
      okLabel: 'Tandai selesai'
    }).then(function (ok) {
      if (!ok) return;
      var r = G().completeGoal(st(), goal.id, Date.now());
      if (!r.ok) { ui.toast(failMsg(r), { kind: 'err' }); return; }
      persist('Goal ditandai selesai.');
    });
  }

  function doReopen(goal) {
    var r = G().reopenGoal(st(), goal.id, Date.now());
    if (!r.ok) { ui.toast(failMsg(r), { kind: 'err' }); return; }
    persist('Goal dibuka kembali.');
  }

  function doArchive(goal) {
    ui.confirm({
      title: 'Arsipkan goal ini?',
      body: 'Goal "' + goal.title + '" dipindahkan ke arsip beserta milestone dan tautan tugasnya. Tidak ada tugas yang dihapus, dan goal bisa dipulihkan kapan saja.',
      okLabel: 'Arsipkan'
    }).then(function (ok) {
      if (!ok) return;
      var r = G().archiveGoal(st(), goal.id, Date.now());
      if (!r.ok) { ui.toast(failMsg(r), { kind: 'err' }); return; }
      persist();
      ui.toast('Goal diarsipkan.', {
        action: { label: 'Urungkan', onClick: function () { G().restoreGoal(st(), goal.id, Date.now()); persist(); } }, timeout: 7000
      });
    });
  }

  function doRestore(goal) {
    var r = G().restoreGoal(st(), goal.id, Date.now());
    if (!r.ok) { ui.toast(failMsg(r), { kind: 'err' }); return; }
    persist('Goal dipulihkan.');
  }

  function toggleMilestone(goal, m) {
    if (m.done) {
      var r0 = G().reopenMilestone(st(), goal.id, m.id, Date.now());
      if (!r0.ok) ui.toast(failMsg(r0), { kind: 'err' }); else persist('Milestone dibuka kembali.');
      return;
    }
    function apply() {
      var r = G().completeMilestone(st(), goal.id, m.id, Date.now());
      if (!r.ok) ui.toast(failMsg(r), { kind: 'err' }); else persist('Milestone selesai: ' + m.title);
    }
    var mp = G().milestoneProgress(st(), goal, m);
    if (mp.total > mp.done) {
      ui.confirm({
        title: 'Tandai milestone selesai?',
        body: 'Masih ada ' + (mp.total - mp.done) + ' tugas terkait yang belum selesai. Tugas tersebut tidak akan ikut ditandai selesai.',
        okLabel: 'Tandai selesai'
      }).then(function (ok) { if (ok) apply(); });
    } else apply();
  }

  function moveMs(goal, m, delta) {
    var r = G().moveMilestone(st(), goal.id, m.id, delta, Date.now());
    if (!r.ok) { ui.toast(failMsg(r), { kind: 'err' }); return; }
    if (r.changed) persist();
  }

  function removeMs(goal, m) {
    var linked = m.taskIds.length;
    ui.confirm({
      title: 'Hapus milestone?',
      body: 'Milestone "' + m.title + '" akan dihapus dari goal ini.' + (linked ? ' ' + linked + ' tautan tugas ikut dilepas, tetapi tugasnya tetap ada di halaman Tugas.' : ''),
      okLabel: 'Hapus', danger: true
    }).then(function (ok) {
      if (!ok) return;
      var r = G().removeMilestone(st(), goal.id, m.id, Date.now());
      if (!r.ok) { ui.toast(failMsg(r), { kind: 'err' }); return; }
      persist('Milestone dihapus.');
    });
  }

  function unlink(goal, taskId) {
    var r = G().unlinkTask(st(), goal.id, taskId, Date.now());
    if (!r.ok) { ui.toast(failMsg(r), { kind: 'err' }); return; }
    if (r.changed) persist('Tautan tugas dilepas.');
  }

  /* ── overview ────────────────────────────────────────────────────── */
  function stat(label, value, unit) {
    return ui.el('div.stat.gl-stat', ui.el('div.k', label), ui.el('div.v', value), ui.el('div.u', unit));
  }

  function renderMetrics(parent) {
    var o = G().overview(st(), app.today());
    var strip = ui.el('section.gl-metrics', { 'aria-label': 'Ringkasan goal' });
    strip.appendChild(stat('Goal aktif', String(o.active), o.active ? 'belum selesai' : 'Belum ada goal aktif'));
    strip.appendChild(stat('Goal selesai', String(o.completed), o.completed ? 'ditandai selesai' : 'Belum ada yang selesai'));
    strip.appendChild(stat('Milestone selesai', o.milestonesTotal ? o.milestonesDone + '/' + o.milestonesTotal : '—',
      o.milestonesTotal ? 'dari semua goal' : 'Belum ada milestone'));
    strip.appendChild(stat('Tenggat dekat', String(o.dueSoon + o.overdue),
      (o.overdue ? o.overdue + ' terlambat · ' : '') + 'dalam ' + G().SOON_DAYS + ' hari'));
    parent.appendChild(strip);
  }

  function goalCard(goal) {
    var state = st(), p = G().progress(state, goal), next = G().nextMilestone(goal);
    var card = ui.el('article.gl-card' + (goal.status === 'completed' ? '.done' : ''), { 'aria-labelledby': 'gl-c-' + goal.id });
    var head = ui.el('div.gl-card-head');
    var titles = ui.el('div.gl-card-titles');
    if (goal.category) titles.appendChild(ui.el('div.gl-cat', goal.category));
    titles.appendChild(ui.el('h3.gl-card-title', { id: 'gl-c-' + goal.id }, goal.title));
    head.appendChild(titles);
    head.appendChild(statusChip(goal));
    card.appendChild(head);
    if (goal.description) card.appendChild(ui.el('p.gl-card-desc', goal.description));

    var prog = ui.el('div.gl-card-progress');
    var row = ui.el('div.gl-prog-row');
    row.appendChild(ui.el('span.gl-pct', p.pct == null ? '—' : p.pct + '%'));
    row.appendChild(ui.el('span.gl-prog-detail', progressDetail(p)));
    prog.appendChild(row);
    prog.appendChild(progressBar(p, 'Progres ' + goal.title));
    prog.appendChild(ui.el('div.gl-method', G().METHOD_LABEL[p.method]));
    card.appendChild(prog);

    var meta = ui.el('div.gl-meta');
    meta.appendChild(ui.el('span.chip.outline', 'Mulai ' + ui.fmt.dateShort(goal.startDate)));
    var dc = deadlineChip(goal.deadline, goal.status === 'completed');
    if (dc) meta.appendChild(dc);
    meta.appendChild(ui.el('span.chip.outline', goal.milestones.filter(function (m) { return m.done; }).length + '/' + goal.milestones.length + ' milestone'));
    if (goal.archived) meta.appendChild(ui.el('span.chip.outline', 'Diarsipkan'));
    card.appendChild(meta);

    var foot = ui.el('div.gl-card-foot');
    var nextBox = ui.el('div.gl-next-mini');
    if (next) {
      nextBox.appendChild(ui.el('span.gl-next-k', 'Berikutnya'));
      nextBox.appendChild(ui.el('span.gl-next-t', next.title));
    } else {
      nextBox.appendChild(ui.el('span.gl-next-k', goal.milestones.length ? 'Semua milestone selesai' : 'Belum ada milestone'));
    }
    foot.appendChild(nextBox);
    var open = fkBtn('Lihat detail', function () { openGoal(goal.id); }, { sm: true, ghost: true }, 'open-' + goal.id);
    open.setAttribute('aria-label', 'Lihat detail goal ' + goal.title);
    foot.appendChild(open);
    card.appendChild(foot);
    return card;
  }

  function renderOverview() {
    var state = st();
    var all = G().list(state);
    renderMetrics(host);

    var active = all.filter(function (g) { return !g.archived && g.status !== 'completed'; });
    var done = all.filter(function (g) { return !g.archived && g.status === 'completed'; });
    var arch = all.filter(function (g) { return g.archived; });

    var bar = ui.el('div.gl-toolbar');
    var tabs = ui.el('div.tabs', { role: 'tablist', 'aria-label': 'Filter goal' });
    [['aktif', 'Aktif', active.length], ['selesai', 'Selesai', done.length], ['arsip', 'Arsip', arch.length]].forEach(function (d) {
      var b = ui.el('button', {
        type: 'button', role: 'tab', 'aria-selected': String(tab === d[0]), class: tab === d[0] ? 'on' : null,
        dataset: { fk: 'tab-' + d[0] }, onclick: function () { tab = d[0]; render(); }
      }, d[1] + ' (' + d[2] + ')');
      tabs.appendChild(b);
    });
    bar.appendChild(tabs);
    host.appendChild(bar);

    if (!all.length) {
      var empty = ui.el('div.empty.gl-empty');
      empty.appendChild(ui.el('span.gl-empty-ic', { 'aria-hidden': 'true' }, ui.svg(ICON.target, 28, 1.6)));
      empty.appendChild(ui.el('span.big', 'Belum ada goal'));
      empty.appendChild(ui.el('p', 'Tetapkan tujuan jangka panjang, pecah menjadi milestone, lalu tautkan tugas yang sudah ada untuk melacak progres nyata.'));
      empty.appendChild(fkBtn('Buat goal pertama', function () { openGoalForm(null); }, { primary: true }, 'empty-new'));
      host.appendChild(empty);
      return;
    }

    if (tab === 'aktif') {
      if (!active.length) {
        host.appendChild(ui.el('div.empty', ui.el('span.big', 'Tidak ada goal aktif'), 'Goal selesai dan arsip ada di tab lainnya.'));
        return;
      }
      [['in_progress', 'Berjalan'], ['not_started', 'Belum dimulai'], ['on_hold', 'Ditunda']].forEach(function (grp) {
        var items = active.filter(function (g) { return g.status === grp[0]; });
        if (!items.length) return;
        host.appendChild(ui.el('div.section-label', grp[1] + ' (' + items.length + ')'));
        var grid = ui.el('div.gl-grid');
        items.forEach(function (g) { grid.appendChild(goalCard(g)); });
        host.appendChild(grid);
      });
      return;
    }
    var items = tab === 'selesai' ? done : arch;
    if (!items.length) {
      host.appendChild(ui.el('div.empty', ui.el('span.big', tab === 'selesai' ? 'Belum ada goal selesai' : 'Arsip kosong'),
        tab === 'selesai' ? 'Goal yang ditandai selesai akan tampil di sini.' : 'Goal yang diarsipkan tetap tersimpan di sini beserta milestone-nya.'));
      return;
    }
    var grid2 = ui.el('div.gl-grid');
    items.slice().sort(function (a, b) { return (b.completedAt || b.archivedAt || 0) - (a.completedAt || a.archivedAt || 0); })
      .forEach(function (g) { grid2.appendChild(goalCard(g)); });
    host.appendChild(grid2);
  }

  /* ── detail ──────────────────────────────────────────────────────── */
  function renderMissing() {
    var box = ui.el('div.empty');
    box.appendChild(ui.el('span.big', 'Goal tidak ditemukan'));
    box.appendChild(ui.el('p', 'Goal ini mungkin sudah tidak ada setelah data dipulihkan dari cadangan.'));
    box.appendChild(fkBtn('Kembali ke semua goal', openOverview, { ghost: true }, 'back'));
    host.appendChild(box);
  }

  function detailHeader(goal) {
    var locked = goal.archived;
    var head = ui.el('section.card.gl-hero');
    var top = ui.el('div.gl-hero-top');
    var back = fkBtn('', openOverview, { ghost: true, sm: true }, 'back');
    back.appendChild(ui.svg(ui.ICON.chevL, 14));
    back.appendChild(document.createTextNode('Semua goal'));
    top.appendChild(back);
    var acts = ui.el('div.gl-hero-acts');
    if (locked) {
      acts.appendChild(fkBtn('Pulihkan', function () { doRestore(goal); }, { primary: true, sm: true }, 'restore'));
    } else {
      acts.appendChild(fkBtn('Ubah', function () { openGoalForm(goal); }, { ghost: true, sm: true }, 'edit'));
      if (goal.status === 'completed') acts.appendChild(fkBtn('Buka kembali', function () { doReopen(goal); }, { ghost: true, sm: true }, 'reopen'));
      else acts.appendChild(fkBtn('Tandai selesai', function () { doComplete(goal); }, { primary: true, sm: true }, 'complete'));
      acts.appendChild(fkBtn('Arsipkan', function () { doArchive(goal); }, { ghost: true, sm: true }, 'archive'));
    }
    top.appendChild(acts);
    head.appendChild(top);

    if (goal.category) head.appendChild(ui.el('div.gl-cat', goal.category));
    head.appendChild(ui.el('h2.gl-hero-title', goal.title));
    if (goal.description) head.appendChild(ui.el('p.gl-hero-desc', goal.description));
    var meta = ui.el('div.gl-meta');
    meta.appendChild(statusChip(goal));
    meta.appendChild(ui.el('span.chip.outline', 'Mulai ' + ui.fmt.dateShort(goal.startDate)));
    var dc = deadlineChip(goal.deadline, goal.status === 'completed');
    meta.appendChild(dc || ui.el('span.chip.outline', 'Tanpa tenggat'));
    if (goal.status === 'completed' && goal.completedAt) meta.appendChild(ui.el('span.chip.ok', 'Selesai ' + ui.fmt.dateShort(JF.dates.dayKey(goal.completedAt))));
    if (locked) meta.appendChild(ui.el('span.chip.warn', 'Diarsipkan'));
    head.appendChild(meta);

    if (!locked) {
      var sw = ui.el('label.gl-status-switch', ui.el('span', 'Status'));
      var sel = ui.el('select', { 'aria-label': 'Ubah status goal', dataset: { fk: 'status' } });
      G().STATUSES.forEach(function (s) {
        var o = ui.el('option', { value: s }, G().STATUS_LABEL[s]);
        if (s === goal.status) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () {
        if (sel.value === 'completed') { sel.value = goal.status; doComplete(goal); return; }
        var r = G().setStatus(st(), goal.id, sel.value, Date.now());
        if (!r.ok) { ui.toast(failMsg(r), { kind: 'err' }); sel.value = goal.status; return; }
        if (r.changed) persist('Status diubah ke ' + G().STATUS_LABEL[sel.value] + '.');
      });
      sw.appendChild(sel);
      head.appendChild(sw);
    } else {
      head.appendChild(ui.el('div.hint.gl-locked', 'Goal ini diarsipkan. Pulihkan untuk mengubah milestone, status, atau tautan tugas.'));
    }
    return head;
  }

  function progressCard(goal) {
    var p = G().progress(st(), goal);
    var card = ui.el('section.card.gl-progress-card', { 'aria-labelledby': 'gl-prog-h' });
    var head = ui.el('div.gl-sec-head');
    head.appendChild(ui.el('h2', { id: 'gl-prog-h' }, 'Progres'));
    head.appendChild(ui.el('span.chip.outline', G().METHOD_LABEL[p.method]));
    card.appendChild(head);
    var big = ui.el('div.gl-prog-big');
    big.appendChild(ui.el('span.gl-pct-big', p.pct == null ? '—' : p.pct + '%'));
    big.appendChild(ui.el('span.gl-prog-detail', progressDetail(p)));
    card.appendChild(big);
    card.appendChild(progressBar(p, 'Progres ' + goal.title));
    card.appendChild(ui.el('p.hint.gl-formula', formulaText(p.method)));
    if (p.manualComplete) {
      card.appendChild(ui.el('div.gl-note.ok', 'Goal ditandai selesai secara manual. Angka di atas tetap dihitung dari data milestone, tugas, atau target.'));
    } else if (p.pct === 100 && !goal.archived) {
      var n = ui.el('div.gl-note', ui.el('span', 'Progres sudah 100%. Tandai goal ini selesai bila memang sudah tercapai.'));
      n.appendChild(fkBtn('Tandai selesai', function () { doComplete(goal); }, { sm: true, primary: true }, 'complete-note'));
      card.appendChild(n);
    }
    if (p.method === 'target' && !goal.archived) {
      var form = ui.el('form.gl-target-form', { onsubmit: function (e) {
        e.preventDefault();
        var r = G().updateGoal(st(), goal.id, { target: { value: (goal.target || {}).value, current: inCur.value, unit: (goal.target || {}).unit } }, Date.now());
        if (!r.ok) { ui.toast((r.errors && (r.errors.targetCurrent || r.errors.targetValue)) || failMsg(r), { kind: 'err' }); return false; }
        if (r.changed) persist('Nilai progres diperbarui.');
        return false;
      } });
      var inCur = ui.el('input', { type: 'number', min: '0', step: 'any', value: goal.target && goal.target.current != null ? goal.target.current : 0, 'aria-label': 'Nilai saat ini', dataset: { fk: 'target-current' } });
      form.appendChild(ui.el('label.gl-inline', ui.el('span', 'Nilai saat ini'), inCur,
        ui.el('span.hint', goal.target && goal.target.value ? 'dari ' + fmtNum(goal.target.value) + (goal.target.unit ? ' ' + goal.target.unit : '') : '')));
      var save = ui.btn('Perbarui', null, { sm: true, ghost: true });
      save.type = 'submit';
      save.dataset.fk = 'target-save';
      form.appendChild(save);
      card.appendChild(form);
    }
    return card;
  }


  /* ── task output (deliverables) ───────────────────────────────────── */
  function outputInfo(t) {
    var docs = JF.library.attachmentsForTask(st(), t.id);
    var D = JF.documents;
    var avail = docs.filter(function (d) { return D.availability(d) === 'ok'; }).length;
    var missing = docs.filter(function (d) { return D.availability(d) === 'missing'; }).length;
    var hadOutput = !!(t.requiresOutput || (t.deliverables && t.deliverables.length));
    /* Only warn once availability has actually been checked (never on 'unknown'). */
    var checked = Object.keys(D.statusMap()).length > 0 || !docs.length;
    return { docs: docs, avail: avail, missing: missing, lost: !!t.done && hadOutput && avail === 0 && checked };
  }
  function outputChips(t, meta) {
    if (!JF.documents) return;
    var o = outputInfo(t);
    if (o.docs.length) meta.appendChild(ui.el('span.chip.outline', o.docs.length + ' file'));
    if (t.requiresOutput && !t.done && !o.docs.length) meta.appendChild(ui.el('span.chip.warn', 'Butuh output'));
    if (o.lost) meta.appendChild(ui.el('span.chip.danger', 'Output hilang'));
    else if (o.missing) meta.appendChild(ui.el('span.chip.warn', o.missing + ' file hilang'));
  }
  function contextLine(goal, t) {
    var loc = G().locationOf ? G().locationOf(goal, t.id) : undefined;
    var ms = loc ? G().findMilestone(goal, loc) : null;
    return goal.title + (ms ? ' → ' + ms.title : '') + ' → ' + t.title;
  }
  function reportImport(out) {
    var n = out.added.length + out.linked.length;
    if (n) ui.toast(n === 1 ? 'File dilampirkan dan masuk ke Library.' : n + ' file dilampirkan dan masuk ke Library.', { kind: 'ok' });
    if (out.failed.length) ui.toast(out.failed.map(function (f) { return (f.name ? f.name + ': ' : '') + JF.documents.message(f.reason); }).join(' '), { kind: 'err', timeout: 8000 });
  }
  function openOutput(goal, t) {
    var D = JF.documents, locked = goal.archived;
    var listBox = ui.el('div.gl-out-list');
    var reqBox = ui.el('div');
    var body = ui.el('div.gl-out');
    body.appendChild(ui.el('div.hint', contextLine(goal, t)));
    if (t.description) body.appendChild(ui.el('div.hint', t.description));
    body.appendChild(reqBox); body.appendChild(listBox);
    var busy = false;

    function paint() {
      ui.clear(reqBox); ui.clear(listBox);
      var cb = ui.el('input', { type: 'checkbox', checked: !!t.requiresOutput, disabled: locked || t.done,
        onchange: function (e) {
          var r = JF.store.setRequiresOutput(st(), t.id, e.target.checked, Date.now());
          if (r.ok) persist(); paint();
        } });
      reqBox.appendChild(ui.el('label.gl-out-req', cb, ui.el('span', ' Wajib ada file output sebelum tugas bisa diselesaikan')));
      var o = outputInfo(t);
      if (o.lost) listBox.appendChild(ui.el('div.gl-out-warn', 'Tugas ini sudah selesai, tetapi file outputnya tidak ditemukan lagi. Status selesai tetap tersimpan; lampirkan ulang file jika perlu.'));
      else if (t.done && t.deliverables && t.deliverables.length && !o.docs.length) listBox.appendChild(ui.el('div.gl-out-warn', 'Output yang dulu dilampirkan sudah dihapus dari Library. Status selesai tidak berubah.'));
      if (!o.docs.length) listBox.appendChild(ui.el('div.empty', 'Belum ada file output.'));
      o.docs.forEach(function (d) {
        var av = D.availability(d);
        var row = ui.el('div.gl-out-row');
        var info = ui.el('div.gl-out-info');
        info.appendChild(ui.el('div.gl-out-name', d.title));
        var sub = ui.el('div.gl-out-sub', [D.fmtSize(d.size), ui.fmt.dateTime(d.createdAt)].filter(Boolean).join(' · '));
        info.appendChild(sub);
        row.appendChild(info);
        row.appendChild(ui.el('span.chip' + (av === 'ok' ? '.ok' : av === 'missing' ? '.danger' : '.outline'), D.availLabel(d)));
        var acts = ui.el('div.gl-out-acts');
        acts.appendChild(ui.btn('Buka', function () {
          D.open(d).then(function (r) { if (!r.ok) ui.toast('Tidak bisa membuka file: ' + D.message(r.reason), { kind: 'err' }); paint(); });
        }, { sm: true, ghost: true, disabled: av === 'missing' }));
        if (!locked) {
          acts.appendChild(ui.btn('Ganti', function () { replace(d); }, { sm: true, ghost: true, disabled: busy }));
          acts.appendChild(ui.btn('Hapus', function () { remove(d); }, { sm: true, danger: true, disabled: busy }));
        }
        row.appendChild(acts);
        listBox.appendChild(row);
      });
    }
    function done(out) { busy = false; reportImport(out); D.refreshStatus().then(function () { paint(); render(); }); }
    function attach() {
      if (busy) return; busy = true;
      D.attachToTask(t.id).then(function (out) { if (out.canceled) { busy = false; return; } done(out); }, function () { busy = false; ui.toast('Gagal melampirkan file.', { kind: 'err' }); });
    }
    function replace(d) {
      if (busy) return; busy = true;
      /* Attach first, remove the old one only after the new one is safely registered. */
      D.attachToTask(t.id).then(function (out) {
        if (out.canceled) { busy = false; return; }
        var ok = out.added.length + out.linked.length;
        if (!ok) { done(out); return; }
        var keep = out.added.concat(out.linked).some(function (x) { return x.id === d.id; });
        (keep ? Promise.resolve() : D.removeFromTask(d, t.id)).then(function () { done(out); });
      }, function () { busy = false; });
    }
    function remove(d) {
      ui.confirm({
        title: 'Hapus output?',
        body: 'File "' + d.title + '" akan dilepas dari tugas ini. Jika tidak dipakai di tempat lain, file juga dihapus dari Library. Status selesai tugas tidak berubah.',
        okLabel: 'Hapus', danger: true
      }).then(function (yes) {
        if (!yes) return;
        D.removeFromTask(d, t.id).then(function () { D.refreshStatus().then(function () { paint(); render(); }); });
      });
    }
    paint();
    var m = ui.modal({
      title: 'Output tugas', body: body, wide: true,
      actions: [
        { label: 'Tutup', ghost: true },
        { label: 'Lampirkan file', primary: true, disabled: locked, onClick: function () { attach(); return false; } }
      ]
    });
    D.refreshStatus().then(paint);
    return m;
  }

  function taskRow(goal, ref) {
    var t = ref.task, locked = goal.archived;
    var r = ui.el('div.gl-task' + (ref.status === 'done' ? '.done' : '') + (ref.status === 'missing' || ref.status === 'archived' ? '.muted' : ''));
    if (t && ref.status !== 'archived') {
      r.appendChild(ui.el('button.tick', {
        type: 'button', dataset: { fk: 'tick-' + t.id },
        title: t.done ? 'Urungkan penyelesaian' : 'Selesai + ringkasan',
        'aria-label': (t.done ? 'Urungkan penyelesaian ' : 'Selesai dengan ringkasan ') + t.title,
        onclick: function () { t.done ? app.reopenTask(t.id) : JF.completion.start(t.id); }
      }, ui.svg(ui.ICON.check, 12, 3)));
    } else {
      r.appendChild(ui.el('span.gl-task-dot', { 'aria-hidden': 'true' }));
    }
    var body = ui.el('div.gl-task-body');
    body.appendChild(ui.el('div.gl-task-title', t ? t.title : 'Tugas tidak ditemukan'));
    var meta = ui.el('div.gl-task-meta');
    if (ref.status === 'missing') meta.appendChild(ui.el('span.chip.warn', 'Terhapus · tidak dihitung'));
    else if (ref.status === 'archived') meta.appendChild(ui.el('span.chip.outline', 'Diarsipkan · tidak dihitung'));
    else {
      meta.appendChild(ui.el('span.chip' + (JF.model.isOverdue(t, app.today()) ? '.danger' : '.outline'), ui.fmt.dateShort(t.targetDate)));
      if (t.done) meta.appendChild(ui.el('span.chip.ok', 'Selesai'));
      outputChips(t, meta);
    }
    body.appendChild(meta);
    r.appendChild(body);
    if (t && ref.status !== 'archived' && ref.status !== 'missing' && JF.documents) {
      r.appendChild(iconBtn(ICON.clip, 'Output untuk ' + t.title, function () { openOutput(goal, t); }, { fk: 'out-' + t.id }));
    }
    if (!locked) r.appendChild(iconBtn(ICON.unlink, 'Lepas tautan ' + (t ? t.title : 'tugas'), function () { unlink(goal, ref.taskId); }, { fk: 'unlink-' + ref.taskId }));
    return r;
  }

  function milestoneRow(goal, m, idx, next) {
    var locked = goal.archived, state = st();
    var mp = G().milestoneProgress(state, goal, m);
    var li = ui.el('li.gl-ms' + (m.done ? '.done' : '') + (next && next.id === m.id ? '.next' : ''));
    li.appendChild(ui.el('button.tick', {
      type: 'button', disabled: locked, dataset: { fk: 'ms-tick-' + m.id },
      title: m.done ? 'Buka kembali milestone' : 'Tandai milestone selesai',
      'aria-label': (m.done ? 'Buka kembali milestone ' : 'Tandai milestone selesai ') + m.title,
      onclick: function () { toggleMilestone(goal, m); }
    }, ui.svg(ui.ICON.check, 12, 3)));
    var body = ui.el('div.gl-ms-body');
    var tl = ui.el('div.gl-ms-title', ui.el('span.gl-ms-num', { 'aria-hidden': 'true' }, String(idx + 1).padStart(2, '0')), ui.el('span', m.title));
    if (next && next.id === m.id) tl.appendChild(ui.el('span.chip.accent', 'Berikutnya'));
    body.appendChild(tl);
    if (m.description) body.appendChild(ui.el('div.gl-ms-desc', m.description));
    if (m.criteria) body.appendChild(ui.el('div.gl-ms-crit', ui.el('strong', 'Kriteria selesai: '), m.criteria));
    var meta = ui.el('div.gl-meta');
    var dc = deadlineChip(m.deadline, m.done);
    if (dc) meta.appendChild(dc);
    if (mp.total) meta.appendChild(ui.el('span.chip' + (mp.done === mp.total ? '.ok' : '.outline'), mp.done + '/' + mp.total + ' tugas selesai'));
    if (m.done && m.completedAt) meta.appendChild(ui.el('span.chip.ok', 'Selesai ' + ui.fmt.dateShort(JF.dates.dayKey(m.completedAt))));
    if (meta.childNodes.length) body.appendChild(meta);
    li.appendChild(body);
    if (!locked) {
      var acts = ui.el('div.gl-ms-acts');
      acts.appendChild(iconBtn(ICON.up, 'Pindahkan ' + m.title + ' ke atas', function () { moveMs(goal, m, -1); }, { disabled: idx === 0, fk: 'up-' + m.id }));
      acts.appendChild(iconBtn(ICON.down, 'Pindahkan ' + m.title + ' ke bawah', function () { moveMs(goal, m, 1); }, { disabled: idx === goal.milestones.length - 1, fk: 'down-' + m.id }));
      acts.appendChild(iconBtn(ICON.link, 'Tautkan tugas ke ' + m.title, function () { openLinkTasks(goal, m.id); }, { fk: 'link-' + m.id }));
      acts.appendChild(iconBtn(ui.ICON.edit, 'Ubah ' + m.title, function () { openMilestoneForm(goal, m); }, { fk: 'edit-' + m.id }));
      acts.appendChild(iconBtn(ui.ICON.trash, 'Hapus ' + m.title, function () { removeMs(goal, m); }, { fk: 'del-' + m.id, cls: 'gl-danger' }));
      li.appendChild(acts);
    }
    return li;
  }

  function milestonesCard(goal) {
    var card = ui.el('section.card.gl-ms-card', { 'aria-labelledby': 'gl-ms-h' });
    var head = ui.el('div.gl-sec-head');
    var done = goal.milestones.filter(function (m) { return m.done; }).length;
    head.appendChild(ui.el('h2', { id: 'gl-ms-h' }, 'Milestone'));
    head.appendChild(ui.el('span.hint', goal.milestones.length ? done + ' dari ' + goal.milestones.length + ' selesai' : ''));
    if (!goal.archived) {
      var add = fkBtn('', function () { openMilestoneForm(goal, null); }, { sm: true, primary: true }, 'ms-add');
      add.appendChild(ui.svg(ui.ICON.plus, 14));
      add.appendChild(document.createTextNode('Milestone'));
      add.setAttribute('aria-label', 'Tambah milestone');
      head.appendChild(add);
    }
    card.appendChild(head);
    if (!goal.milestones.length) {
      card.appendChild(ui.el('div.empty.gl-empty-sm', ui.el('span.big', 'Belum ada milestone'),
        'Pecah goal menjadi beberapa langkah besar yang bisa dicentang satu per satu.'));
      return card;
    }
    var next = G().nextMilestone(goal);
    var ol = ui.el('ol.gl-ms-list');
    goal.milestones.forEach(function (m, i) { ol.appendChild(milestoneRow(goal, m, i, next)); });
    card.appendChild(ol);
    return card;
  }

  function nextCard(goal) {
    var next = G().nextMilestone(goal);
    var card = ui.el('section.card.gl-next-card', { 'aria-labelledby': 'gl-next-h' });
    card.appendChild(ui.el('div.section-label', { id: 'gl-next-h' }, 'Langkah berikutnya'));
    if (next) {
      card.appendChild(ui.el('div.gl-next-title', next.title));
      if (next.criteria) card.appendChild(ui.el('div.hint', 'Selesai bila: ' + next.criteria));
      var dc = deadlineChip(next.deadline, false);
      if (dc) card.appendChild(ui.el('div.gl-meta', dc));
    } else {
      card.appendChild(ui.el('div.hint', goal.milestones.length ? 'Semua milestone sudah selesai.' : 'Tambahkan milestone untuk melihat langkah berikutnya.'));
    }
    return card;
  }

  function deadlinesCard(goal) {
    var list = G().upcomingDeadlines(st(), app.today(), goal);
    var card = ui.el('section.card', { 'aria-labelledby': 'gl-dl-h' });
    card.appendChild(ui.el('div.gl-sec-head', ui.el('h2', { id: 'gl-dl-h' }, 'Tenggat mendatang')));
    if (!list.length) {
      card.appendChild(ui.el('div.hint', goal.status === 'completed' ? 'Goal sudah selesai.' : 'Tidak ada tenggat terbuka.'));
      return card;
    }
    var ul = ui.el('ul.gl-dl-list');
    list.slice(0, 6).forEach(function (d) {
      ul.appendChild(ui.el('li.gl-dl' + (d.overdue ? '.overdue' : d.soon ? '.soon' : ''),
        ui.el('span.gl-dl-ic', { 'aria-hidden': 'true' }, ui.svg(d.kind === 'goal' ? ICON.target : ICON.flag, 14)),
        ui.el('span.gl-dl-t', d.kind === 'goal' ? 'Goal: ' + d.title : d.title),
        ui.el('span.gl-dl-d', ui.fmt.dateShort(d.deadline) + ' · ' + deadlineText(d).replace(/^Tenggat /, ''))));
    });
    card.appendChild(ul);
    return card;
  }

  function tasksCard(goal) {
    var refs = G().taskRefs(st(), goal);
    var card = ui.el('section.card.gl-tasks-card', { 'aria-labelledby': 'gl-tk-h' });
    var head = ui.el('div.gl-sec-head');
    head.appendChild(ui.el('h2', { id: 'gl-tk-h' }, 'Tugas terkait'));
    if (!goal.archived) {
      var b = fkBtn('', function () { openLinkTasks(goal, null); }, { sm: true, ghost: true }, 'link-goal');
      b.appendChild(ui.svg(ICON.link, 14));
      b.appendChild(document.createTextNode('Tautkan'));
      b.setAttribute('aria-label', 'Tautkan tugas ke goal');
      head.appendChild(b);
    }
    card.appendChild(head);
    if (!refs.length) {
      card.appendChild(ui.el('div.hint', 'Belum ada tugas yang ditautkan. Tautkan tugas yang sudah ada langsung ke goal atau ke milestone tertentu.'));
      return card;
    }
    var groups = [{ id: null, label: 'Langsung ke goal' }].concat(goal.milestones.map(function (m) { return { id: m.id, label: m.title }; }));
    groups.forEach(function (gr) {
      var items = refs.filter(function (r) { return r.milestoneId === gr.id; });
      if (!items.length) return;
      card.appendChild(ui.el('div.gl-task-group', gr.id ? 'Milestone · ' + gr.label : gr.label));
      var box = ui.el('div.gl-task-list');
      items.forEach(function (r) { box.appendChild(taskRow(goal, r)); });
      card.appendChild(box);
    });
    return card;
  }

  function journalCard(goal) {
    var days = G().journalDays(st(), goal.id);
    var card = ui.el('section.card', { 'aria-labelledby': 'gl-jr-h' });
    card.appendChild(ui.el('div.gl-sec-head', ui.el('h2', { id: 'gl-jr-h' }, 'Catatan jurnal terkait')));
    if (!days.length) {
      card.appendChild(ui.el('div.hint', 'Belum ada. Tautkan catatan harian ke goal ini dari halaman Journaling. Catatan hanya konteks dan tidak memengaruhi progres.'));
      return card;
    }
    var ul = ui.el('ul.gl-dl-list');
    days.slice(0, 8).forEach(function (d) {
      var m = d.milestoneId ? G().findMilestone(goal, d.milestoneId) : null;
      var b = ui.el('button.gl-jr-link', {
        type: 'button', dataset: { fk: 'jr-' + d.day },
        onclick: function () { location.hash = '#jurnal?date=' + d.day; }
      }, ui.el('span.gl-dl-ic', { 'aria-hidden': 'true' }, ui.svg(ICON.journal, 14)),
        ui.el('span.gl-dl-t', ui.fmt.date(d.day)),
        ui.el('span.gl-dl-d', m ? m.title : ''));
      ul.appendChild(ui.el('li', b));
    });
    card.appendChild(ul);
    return card;
  }

  function renderDetail(goal) {
    host.appendChild(detailHeader(goal));
    var grid = ui.el('div.gl-detail');
    var main = ui.el('div.gl-detail-main');
    var side = ui.el('div.gl-detail-side');
    main.appendChild(progressCard(goal));
    main.appendChild(milestonesCard(goal));
    main.appendChild(tasksCard(goal));
    side.appendChild(nextCard(goal));
    side.appendChild(deadlinesCard(goal));
    side.appendChild(journalCard(goal));
    grid.appendChild(main);
    grid.appendChild(side);
    host.appendChild(grid);
  }

  /* ── page ────────────────────────────────────────────────────────── */
  var lastView = null;
  function render() {
    if (!host) return;
    var fk = rememberFocus();
    var id = goalIdFromHash();
    var view = id ? 'detail:' + id : 'overview';
    var y = document.getElementById('content') ? document.getElementById('content').scrollTop : 0;
    ui.clear(host);
    host.classList.toggle('gl-page-detail', !!id);
    if (id) {
      var goal = G().find(st(), id);
      if (goal) renderDetail(goal); else renderMissing();
    } else {
      renderOverview();
    }
    if (view === lastView && document.getElementById('content')) document.getElementById('content').scrollTop = y;
    lastView = view;
    restoreFocus(fk);
    if (id && JF.documents) JF.documents.ensureFresh(function () { render(); });
  }

  function mount(container) {
    ui = JF.ui; app = JF.app; host = container;
    host.classList.add('gl-page');
    if (JF.documents) JF.documents.refreshStatus().then(function () { if (host) render(); });
  }

  JF.pages.register({
    id: 'goals',
    title: 'Goals',
    sub: function () {
      var id = goalIdFromHash();
      var goal = id && app ? G().find(st(), id) : null;
      if (goal) return 'Detail goal · ' + G().METHOD_LABEL[goal.progressMethod].toLowerCase();
      return 'Tetapkan tujuan jangka panjang, pecah menjadi milestone, dan lacak progres dari data nyata.';
    },
    actions: function (box) {
      if (goalIdFromHash()) return;
      var b = ui.btn('', function () { openGoalForm(null); }, { primary: true, sm: true });
      b.appendChild(ui.svg(ui.ICON.plus, 14));
      b.appendChild(document.createTextNode('Goal baru'));
      b.id = 'gl-new';
      box.appendChild(b);
    },
    mount: mount,
    render: render
  });

  JF.goalsUI = { openGoal: openGoal, openGoalForm: openGoalForm };
})(typeof self !== 'undefined' ? self : this);
