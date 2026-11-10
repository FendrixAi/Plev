/* Jam Fokus — renderer UI primitives: DOM helpers, formatters, modal, toast.
   No dependencies. Exposed as window.JF.ui */
(function (root) {
  'use strict';
  var JF = root.JF = root.JF || {};

  function $(id) { return document.getElementById(id); }

  /** el('div.class1.class2', {attrs}, child, child…) — also supports 'input#myid.class' */
  function el(spec, attrs) {
    var parts = String(spec).split('.');
    var head = parts[0].split('#');
    var node = document.createElement(head[0] || 'div');
    if (head[1]) node.id = head.slice(1).join('#');
    if (parts.length > 1) node.className = parts.slice(1).join(' ');
    var start = 1;
    if (attrs && typeof attrs === 'object' && !(attrs instanceof Node)) {
      start = 2;
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') node.className += (node.className ? ' ' : '') + v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { node.dataset[d] = v[d]; });
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = start; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }
  function append(node, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { append(node, k); }); return; }
    node.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }

  function btn(label, onClick, opts) {
    opts = opts || {};
    return el('button.btn' + (opts.primary ? '.primary' : '') + (opts.ghost ? '.ghost' : '') +
      (opts.danger ? '.danger' : '') + (opts.sm ? '.sm' : '') + (opts.block ? '.block' : ''), {
        type: 'button', onclick: onClick, disabled: !!opts.disabled, title: opts.title || null,
        'aria-label': opts.ariaLabel || null
      }, label);
  }

  function svg(paths, size, stroke) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    n.setAttribute('viewBox', '0 0 24 24');
    n.setAttribute('width', size || 16); n.setAttribute('height', size || 16);
    n.setAttribute('fill', 'none'); n.setAttribute('stroke', 'currentColor');
    n.setAttribute('stroke-width', stroke || 1.8);
    n.setAttribute('stroke-linecap', 'round'); n.setAttribute('stroke-linejoin', 'round');
    n.innerHTML = paths;
    return n;
  }

  /* ── Formatters (Indonesian) ─────────────────────────────────────── */
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  var fmt = {
    /** 00:00 countdown style (minutes can exceed 60). */
    mmss: function (sec) {
      sec = Math.max(0, Math.round(sec || 0));
      var m = Math.floor(sec / 60), s = sec % 60;
      return pad(m) + ':' + pad(s);
    },
    /** Human duration: "1 jam 5 menit" / "18 menit" / "45 detik". */
    dur: function (sec) {
      sec = Math.max(0, Math.round(sec || 0));
      if (sec < 60) return sec + ' detik';
      var m = Math.floor(sec / 60), h = Math.floor(m / 60);
      if (h > 0) return h + ' jam ' + (m % 60) + ' menit';
      return m + ' menit';
    },
    /** Compact: "1j 05m" / "18m". */
    durShort: function (sec) {
      sec = Math.max(0, Math.round(sec || 0));
      var m = Math.floor(sec / 60), h = Math.floor(m / 60);
      if (h > 0) return h + 'j ' + pad(m % 60) + 'm';
      return m + 'm';
    },
    min: function (m) {
      m = Math.max(0, Math.round(m || 0));
      if (m >= 60) { var h = Math.floor(m / 60); return h + ' jam' + (m % 60 ? ' ' + (m % 60) + ' menit' : ''); }
      return m + ' menit';
    },
    date: function (day) { return parseDayLabel(day); },
    dateShort: function (day) {
      var p = JF.dates && JF.dates.parseDay(day);
      if (!p) return day || '';
      return p.d + ' ' + MON_SHORT[p.m - 1];
    },
    dateLong: function (ts) {
      return new Date(ts).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    },
    time: function (ts) {
      return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');
    },
    dateTime: function (ts) { return fmt.dateShort(JF.dates.dayKey(ts)) + ', ' + fmt.time(ts); }
  };

  var DOW = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  var DOW_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  var MON = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function dowIndex(day) { // 0=Senin … 6=Minggu
    var p = JF.dates.parseDay(day);
    if (!p) return 0;
    var js = new Date(p.y, p.m - 1, p.d).getDay(); // 0=Minggu
    return (js + 6) % 7;
  }
  function parseDayLabel(day) {
    var p = JF.dates.parseDay(day);
    if (!p) return day || '';
    return DOW[dowIndex(day)] + ', ' + p.d + ' ' + MON[p.m - 1] + ' ' + p.y;
  }
  function monthLabel(day) {
    var p = JF.dates.parseDay(day);
    if (!p) return '';
    return MON[p.m - 1] + ' ' + p.y;
  }

  /** "Hari ini" / "Kemarin" / "Besok" / weekday for a nearby day. */
  function dayRel(day) {
    var today = JF.dates.todayKey();
    var d = JF.dates.diffDays(day, today); // today - day
    if (d === 0) return 'Hari ini';
    if (d === 1) return 'Kemarin';
    if (d === -1) return 'Besok';
    return DOW[dowIndex(day)];
  }

  /* ── Modal ───────────────────────────────────────────────────────── */
  var modalStack = [];
  function modal(opts) {
    opts = opts || {};
    var root = $('modalRoot');
    var trigger = document.activeElement;
    var dismissible = opts.dismiss !== false;
    /* X dan Escape tetap boleh menutup; backdrop bisa dimatikan terpisah agar
       klik tidak sengaja di latar tidak membuang pilihan yang wajib diambil. */
    var backdropDismiss = dismissible && opts.backdropDismiss !== false;
    var veil = el('div.modal-veil');
    var box = el('div.modal' + (opts.wide ? '.wide' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || 'Dialog' });
    var head = el('div.m-head', el('h2', opts.title || ''));
    if (dismissible) {
      var closeBtn = el('button.icb', {
        type: 'button', title: 'Tutup', 'aria-label': 'Tutup',
        onclick: function () { close(false); }
      }, svg('<path d="M6 6l12 12M18 6L6 18"/>', 16));
      head.appendChild(closeBtn);
    }
    var body = el('div.m-body');
    append(body, opts.body || '');
    var foot = el('div.m-foot');
    (opts.actions || []).forEach(function (a) {
      foot.appendChild(btn(a.label, function () {
        var r = a.onClick ? a.onClick() : undefined;
        if (r !== false) close(true, a.value);
      }, { primary: !!a.primary, danger: !!a.danger, ghost: !!a.ghost, disabled: !!a.disabled }));
    });
    box.appendChild(head); box.appendChild(body);
    if (foot.childNodes.length) box.appendChild(foot);
    veil.appendChild(box);
    root.appendChild(veil);

    function focusables() {
      var list = box.querySelectorAll(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])'
      );
      return Array.prototype.filter.call(list, function (n) {
        return n.offsetParent !== null || n === document.activeElement;
      });
    }
    function onKey(e) {
      // Only the top-most dialog reacts, so nested dialogs do not all close.
      if (modalStack[modalStack.length - 1] !== api) return;
      if (e.key === 'Escape') {
        if (dismissible) { e.preventDefault(); close(false); }
        return;
      }
      if (e.key === 'Tab') {
        var list = focusables();
        if (!list.length) { e.preventDefault(); return; }
        var first = list[0], last = list[list.length - 1], active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !box.contains(active)) { e.preventDefault(); last.focus(); }
        } else if (active === last || !box.contains(active)) {
          e.preventDefault(); first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);

    var closed = false;
    function close(confirmed, value) {
      if (closed) return; closed = true;
      document.removeEventListener('keydown', onKey);
      veil.remove();
      modalStack = modalStack.filter(function (m) { return m !== api; });
      if (trigger && trigger.focus && document.contains(trigger)) {
        try { trigger.focus(); } catch (e) {}
      }
      if (opts.onClose) opts.onClose(!!confirmed, value);
    }
    veil.addEventListener('mousedown', function (e) { if (e.target === veil && backdropDismiss) close(false); });

    var api = {
      close: close, body: body, box: box,
      focus: function () {
        var f = body.querySelector('input,select,textarea,button') || box.querySelector('button');
        if (f) f.focus();
      }
    };
    modalStack.push(api);
    setTimeout(function () {
      if (!closed) api.focus();
    }, 30);
    return api;
  }

  /** Promise-based confirm. Returns true only when the primary action ran. */
  function confirm(opts) {
    return new Promise(function (resolve) {
      modal({
        title: opts.title || 'Konfirmasi',
        body: opts.body || opts.message || '',
        dismiss: opts.dismiss !== false,
        actions: [
          { label: opts.cancelLabel || 'Batal', ghost: true, onClick: function () { resolve(false); } },
          { label: opts.okLabel || 'Ya', primary: !opts.danger, danger: !!opts.danger, onClick: function () { resolve(true); } }
        ],
        onClose: function (confirmed) { if (!confirmed) resolve(false); }
      });
    });
  }

  /* ── Toast ───────────────────────────────────────────────────────── */
  function toast(msg, opts) {
    opts = opts || {};
    var root = $('toastRoot');
    var t = el('div.toast' + (opts.kind ? '.' + opts.kind : ''));
    t.appendChild(el('span', msg));
    if (opts.action) {
      t.appendChild(btn(opts.action.label, function () {
        t.remove();
        if (opts.action.onClick) opts.action.onClick();
      }, { sm: true, ghost: !opts.action.primary, primary: !!opts.action.primary }));
    }
    root.appendChild(t);
    var ms = opts.timeout != null ? opts.timeout : (opts.action ? 7000 : 3600);
    setTimeout(function () { t.remove(); }, ms);
    return t;
  }

  /* ── page registry (populated by renderer/pages/*.js, wired by boot.js) ── */
  JF.pages = {
    byId: {},
    list: [],
    current: null,
    register: function (p) {
      if (!p || !p.id) throw new Error('page tanpa id');
      JF.pages.byId[p.id] = p;
      if (JF.pages.list.indexOf(p) < 0) JF.pages.list.push(p);
      return p;
    },
    get: function (id) { return JF.pages.byId[id]; }
  };

  JF.ui = {
    $: $, el: el, btn: btn, clear: clear, append: append, svg: svg,
    fmt: fmt, DOW: DOW, DOW_SHORT: DOW_SHORT, MON: MON, MON_SHORT: MON_SHORT,
    dowIndex: dowIndex, monthLabel: monthLabel, dayRel: dayRel,
    modal: modal, confirm: confirm, toast: toast,
    ICON: {
      plus: '<path d="M12 5v14M5 12h14"/>',
      check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
      play: '<path d="M7 5l12 7-12 7z"/>',
      pause: '<path d="M8 5v14M16 5v14"/>',
      stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
      x: '<path d="M6 6l12 12M18 6L6 18"/>',
      chevL: '<path d="M15 6l-6 6 6 6"/>',
      chevR: '<path d="M9 6l6 6-6 6"/>',
      edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
      archive: '<rect x="3.5" y="4.5" width="17" height="5" rx="1.5"/><path d="M5 9.5v9a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-9M10 13.5h4"/>',
      restore: '<path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4"/>',
      clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
      cal: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/>',
      trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>',
      undo: '<path d="M9 5L4 10l5 5M4 10h9a6 6 0 1 1 0 12h-3"/>',
      info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
      down: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>'
    }
  };
})(typeof self !== 'undefined' ? self : this);
