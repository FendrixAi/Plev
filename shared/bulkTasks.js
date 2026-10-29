/* Jam Fokus — bulk task parser, validation, and batch creation.
   Pure logic with no DOM dependencies.
   Format: nama tugas_waktu_prioritas_deskripsi
   UMD: browser -> window.JF.bulkTasks, Node -> require() */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./model.js'), require('./store.js'), require('./dates.js'));
  } else {
    root.JF = root.JF || {};
    root.JF.bulkTasks = factory(root.JF.model, root.JF.store, root.JF.dates);
  }
})(typeof self !== 'undefined' ? self : this, function (model, store, dates) {
  'use strict';

  var PRIO_MAP = {
    'rendah': { key: 'low', label: 'Rendah' },
    'low': { key: 'low', label: 'Rendah' },
    'normal': { key: 'normal', label: 'Normal' },
    'tinggi': { key: 'high', label: 'Tinggi' },
    'high': { key: 'high', label: 'Tinggi' }
  };

  /**
   * Parse a single line with format:
   * nama tugas_waktu_prioritas_deskripsi
   *
   * Fields:
   * - nama tugas: Required (string)
   * - waktu: Required, positive integer minutes
   * - prioritas: Required ('rendah', 'normal', 'tinggi')
   * - deskripsi: Optional (omitted in 3-part format, or empty string if trailing underscore)
   */
  function parseLine(line, lineNumber) {
    var raw = String(line == null ? '' : line);
    if (!raw.trim()) {
      return {
        valid: false,
        isEmpty: true,
        lineNumber: lineNumber || null,
        raw: raw,
        taskName: '',
        durationMin: null,
        durationSec: null,
        description: '',
        priority: null,
        priorityLabel: '',
        error: 'Baris kosong'
      };
    }

    var parts = raw.split('_');

    // 1. Incomplete lines: must have at least 3 parts (nama_waktu_prioritas)
    if (parts.length < 3) {
      return {
        valid: false,
        isEmpty: false,
        lineNumber: lineNumber || null,
        raw: raw,
        taskName: parts[0] ? parts[0].trim() : '',
        durationMin: null,
        durationSec: null,
        description: '',
        priority: null,
        priorityLabel: '',
        error: 'Format tidak lengkap: butuh minimal nama, waktu, dan prioritas yang dipisahkan garis bawah (_) (contoh: nama_waktu_prioritas)'
      };
    }

    // 2. Ambiguity check: more than 4 parts (more than 3 underscores)
    if (parts.length > 4) {
      return {
        valid: false,
        isEmpty: false,
        lineNumber: lineNumber || null,
        raw: raw,
        taskName: parts[0].trim(),
        durationMin: null,
        durationSec: null,
        description: '',
        priority: null,
        priorityLabel: '',
        error: 'Pemisah kolom ambigu: terdapat lebih dari 3 tanda pemisah underscore (_). Nama tugas atau deskripsi tidak boleh mengandung underscore (_). Gunakan tanda hubung (-) atau spasi'
      };
    }

    var name = parts[0].trim();
    var durStr = parts[1].trim();
    var prioStr = parts[2].trim().toLowerCase();
    var desc = parts.length === 4 ? parts[3].trim() : '';

    // 3. Shifted column detection (e.g. if name had an underscore like Tugas_A_30_normal)
    // where part 1 is not a number, but part 2 is a number and part 3 is a valid priority
    if (parts.length === 4 && !/^\d+$/.test(durStr) && /^\d+$/.test(prioStr) && PRIO_MAP[desc.toLowerCase()]) {
      return {
        valid: false,
        isEmpty: false,
        lineNumber: lineNumber || null,
        raw: raw,
        taskName: name,
        durationMin: null,
        durationSec: null,
        description: '',
        priority: null,
        priorityLabel: '',
        error: 'Pemisah tergeser: nama tugas kemungkinan mengandung underscore (_). Waktu ditemukan \'' + durStr + '\' dan prioritas \'' + prioStr + '\'. Hindari underscore pada nama tugas'
      };
    }

    // 4. Validate task name
    if (!name) {
      return {
        valid: false,
        isEmpty: false,
        lineNumber: lineNumber || null,
        raw: raw,
        taskName: '',
        durationMin: null,
        durationSec: null,
        description: desc,
        priority: null,
        priorityLabel: '',
        error: 'Nama tugas wajib diisi'
      };
    }

    // 5. Validate duration (waktu)
    if (!durStr) {
      return {
        valid: false,
        isEmpty: false,
        lineNumber: lineNumber || null,
        raw: raw,
        taskName: name,
        durationMin: null,
        durationSec: null,
        description: desc,
        priority: null,
        priorityLabel: '',
        error: 'Waktu (durasi) wajib diisi'
      };
    }

    if (!/^\d+$/.test(durStr) || parseInt(durStr, 10) <= 0) {
      return {
        valid: false,
        isEmpty: false,
        lineNumber: lineNumber || null,
        raw: raw,
        taskName: name,
        durationMin: null,
        durationSec: null,
        description: desc,
        priority: null,
        priorityLabel: '',
        error: 'Waktu harus berupa angka menit positif (contoh: 25)'
      };
    }

    var durMin = parseInt(durStr, 10);
    if (durMin > 1440) {
      return {
        valid: false,
        isEmpty: false,
        lineNumber: lineNumber || null,
        raw: raw,
        taskName: name,
        durationMin: durMin,
        durationSec: durMin * 60,
        description: desc,
        priority: null,
        priorityLabel: '',
        error: 'Waktu maksimal 1440 menit (24 jam)'
      };
    }

    // 6. Validate priority
    if (!prioStr) {
      return {
        valid: false,
        isEmpty: false,
        lineNumber: lineNumber || null,
        raw: raw,
        taskName: name,
        durationMin: durMin,
        durationSec: durMin * 60,
        description: desc,
        priority: null,
        priorityLabel: '',
        error: 'Prioritas wajib diisi'
      };
    }

    var mapped = PRIO_MAP[prioStr];
    if (!mapped) {
      return {
        valid: false,
        isEmpty: false,
        lineNumber: lineNumber || null,
        raw: raw,
        taskName: name,
        durationMin: durMin,
        durationSec: durMin * 60,
        description: desc,
        priority: null,
        priorityLabel: prioStr,
        error: 'Nilai prioritas tidak didukung: gunakan rendah, normal, atau tinggi'
      };
    }

    return {
      valid: true,
      isEmpty: false,
      lineNumber: lineNumber || null,
      raw: raw,
      taskName: name,
      durationMin: durMin,
      durationSec: durMin * 60,
      description: desc,
      priority: mapped.key,
      priorityLabel: mapped.label,
      error: null
    };
  }

  /**
   * Parse a multiline bulk input string into structured task rows.
   */
  function parseBulkInput(text, opts) {
    opts = opts || {};
    if (!text || typeof text !== 'string') {
      return {
        rows: [],
        validRows: [],
        invalidRows: [],
        totalValid: 0,
        totalInvalid: 0,
        totalLines: 0
      };
    }

    var lines = text.split(/\r?\n/);
    var rows = [];
    var validRows = [];
    var invalidRows = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim()) {
        if (opts.includeEmpty) {
          var emptyItem = parseLine(line, i + 1);
          rows.push(emptyItem);
          invalidRows.push(emptyItem);
        }
        continue;
      }

      var item = parseLine(line, i + 1);
      rows.push(item);
      if (item.valid) {
        validRows.push(item);
      } else {
        invalidRows.push(item);
      }
    }

    return {
      rows: rows,
      validRows: validRows,
      invalidRows: invalidRows,
      totalValid: validRows.length,
      totalInvalid: invalidRows.length,
      totalLines: rows.length
    };
  }

  /**
   * Create tasks in bulk from valid parsed rows.
   * Reuses store.addTask and model.newTask, preserving all metadata,
   * audit events, and persistence integrity.
   */
  function addBulkTasks(state, validRows, targetDate, now) {
    now = now == null ? Date.now() : now;
    if (!dates.isDayKey(targetDate)) {
      throw new Error('Target tanggal wajib berformat YYYY-MM-DD');
    }

    var items = (validRows || []).filter(function (r) { return r && r.valid; });
    var created = [];

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var t = store.addTask(state, {
        title: item.taskName,
        targetDate: targetDate,
        description: item.description || '',
        priority: item.priority,
        durationSec: item.durationSec
      }, now + i);
      created.push(t);
    }

    return created;
  }

  /**
   * Roll back newly created tasks and their events if persistence fails.
   */
  function removeCreated(state, createdList) {
    if (!state || !Array.isArray(state.tasks) || !Array.isArray(createdList) || !createdList.length) return;
    var idsToRemove = {};
    for (var i = 0; i < createdList.length; i++) {
      if (createdList[i] && createdList[i].id) {
        idsToRemove[createdList[i].id] = true;
      }
    }
    state.tasks = state.tasks.filter(function (t) { return !idsToRemove[t.id]; });
    if (Array.isArray(state.events)) {
      state.events = state.events.filter(function (e) { return !idsToRemove[e.taskId]; });
    }
  }

  return {
    parseLine: parseLine,
    parseBulkInput: parseBulkInput,
    addBulkTasks: addBulkTasks,
    removeCreated: removeCreated,
    PRIO_MAP: PRIO_MAP
  };
});
