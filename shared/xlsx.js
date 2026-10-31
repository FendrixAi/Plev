/* Jam Fokus — minimal .xlsx writer (no dependencies).
   Produces a real Office Open XML workbook: styled cells (fonts, fills,
   borders, number formats), merged cells, column widths, frozen header,
   auto-filter, data bars and formulas with cached values.
   Workbook model:
     { title, creator, sheets: [{ name, tabColor, cols:[width], rows:[[cell]],
       merges:['A1:F1'], freeze:{row,col}, autoFilter:'A5:J20', heights:{rowNumber:pt},
       dataBars:[{ref,color}], landscape:true }] }
   cell = null | string | number | { v, f?, s? }   (s = style object, see styleKey)
   Strings are always stored as text (never evaluated), so user content can
   not become a formula.
   UMD: browser -> window.JF.xlsx, Node -> require() */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JF = root.JF || {}, root.JF.xlsx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── zip (store, no compression) ───────────────────────────────── */
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  var enc = new TextEncoder();
  function u16(a, v) { a.push(v & 255, (v >>> 8) & 255); }
  function u32(a, v) { a.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); }

  function zip(files, when) {
    var d = when || new Date();
    var dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var dosDate = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    var parts = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      var crc = crc32(data), h = [];
      u32(h, 0x04034b50); u16(h, 20); u16(h, 0x0800); u16(h, 0); u16(h, dosTime); u16(h, dosDate);
      u32(h, crc); u32(h, data.length); u32(h, data.length); u16(h, name.length); u16(h, 0);
      parts.push(Uint8Array.from(h), name, data);
      var c = [];
      u32(c, 0x02014b50); u16(c, 20); u16(c, 20); u16(c, 0x0800); u16(c, 0); u16(c, dosTime); u16(c, dosDate);
      u32(c, crc); u32(c, data.length); u32(c, data.length); u16(c, name.length); u16(c, 0); u16(c, 0); u16(c, 0); u16(c, 0); u32(c, 0); u32(c, offset);
      central.push(Uint8Array.from(c), name);
      offset += h.length + name.length + data.length;
    });
    var cdSize = 0; central.forEach(function (p) { cdSize += p.length; });
    var end = []; u32(end, 0x06054b50); u16(end, 0); u16(end, 0); u16(end, files.length); u16(end, files.length); u32(end, cdSize); u32(end, offset); u16(end, 0);
    var all = parts.concat(central, [Uint8Array.from(end)]);
    var total = 0; all.forEach(function (p) { total += p.length; });
    var out = new Uint8Array(total), pos = 0;
    all.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }

  /* ── helpers ───────────────────────────────────────────────────── */
  function esc(s) {
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function rgb(c) { c = String(c || '').replace('#', '').toUpperCase(); return /^[0-9A-F]{6}$/.test(c) ? 'FF' + c : null; }
  function sheetName(n, used) {
    var s = String(n || 'Sheet').replace(/[\[\]:*?\/\\]/g, ' ').trim().slice(0, 31) || 'Sheet';
    var base = s, i = 2;
    while (used[s.toLowerCase()]) s = base.slice(0, 28) + ' ' + (i++);
    used[s.toLowerCase()] = true;
    return s;
  }

  /* ── style registry ────────────────────────────────────────────── */
  var BUILTIN_FMT = { '0': 1, '0.00': 2, '#,##0': 3, '0%': 9, '0.00%': 10 };
  function Styles() {
    var fonts = ['<font><sz val="11"/><color rgb="FF17322F"/><name val="Calibri"/><family val="2"/></font>'];
    var fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    var borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    var fmts = [], xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    var cache = {}, fontIx = {}, fillIx = {}, borderIx = {}, fmtIx = {};
    function idx(list, map, xml) { if (map[xml] == null) { map[xml] = list.length; list.push(xml); } return map[xml]; }

    function get(st) {
      if (!st) return 0;
      var key = JSON.stringify(st);
      if (cache[key] != null) return cache[key];
      var font = '<font>' + (st.bold ? '<b/>' : '') + (st.italic ? '<i/>' : '') + '<sz val="' + (st.size || 11) + '"/>' +
        '<color rgb="' + (rgb(st.color) || 'FF17322F') + '"/><name val="Calibri"/><family val="2"/></font>';
      var fontId = idx(fonts, fontIx, font);
      var fillId = 0;
      if (st.bg && rgb(st.bg)) fillId = idx(fills, fillIx, '<fill><patternFill patternType="solid"><fgColor rgb="' + rgb(st.bg) + '"/><bgColor indexed="64"/></patternFill></fill>');
      var borderId = 0;
      if (st.border) {
        var bc = '<color rgb="' + (rgb(st.borderColor) || 'FFC9D6D2') + '"/>';
        var side = function (n, style) { return '<' + n + ' style="' + style + '">' + bc + '</' + n + '>'; };
        var top = st.topBorder || 'thin';
        borderId = idx(borders, borderIx, '<border>' + side('left', 'thin') + side('right', 'thin') + side('top', top) + side('bottom', 'thin') + '<diagonal/></border>');
      }
      var numFmtId = 0;
      if (st.numFmt) {
        if (BUILTIN_FMT[st.numFmt] != null) numFmtId = BUILTIN_FMT[st.numFmt];
        else { if (fmtIx[st.numFmt] == null) { fmtIx[st.numFmt] = 164 + fmts.length; fmts.push('<numFmt numFmtId="' + fmtIx[st.numFmt] + '" formatCode="' + esc(st.numFmt) + '"/>'); } numFmtId = fmtIx[st.numFmt]; }
      }
      var align = '<alignment horizontal="' + (st.align || 'general') + '" vertical="' + (st.valign || 'center') + '"' + (st.wrap ? ' wrapText="1"' : '') + (st.indent ? ' indent="' + st.indent + '"' : '') + '/>';
      var xf = '<xf numFmtId="' + numFmtId + '" fontId="' + fontId + '" fillId="' + fillId + '" borderId="' + borderId + '" xfId="0"' +
        (numFmtId ? ' applyNumberFormat="1"' : '') + ' applyFont="1"' + (fillId ? ' applyFill="1"' : '') + (borderId ? ' applyBorder="1"' : '') + ' applyAlignment="1">' + align + '</xf>';
      xfs.push(xf);
      cache[key] = xfs.length - 1;
      return cache[key];
    }
    function xml() {
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        (fmts.length ? '<numFmts count="' + fmts.length + '">' + fmts.join('') + '</numFmts>' : '') +
        '<fonts count="' + fonts.length + '">' + fonts.join('') + '</fonts><fills count="' + fills.length + '">' + fills.join('') + '</fills>' +
        '<borders count="' + borders.length + '">' + borders.join('') + '</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="' + xfs.length + '">' + xfs.join('') + '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    }
    return { get: get, xml: xml };
  }

  /* ── sheets ────────────────────────────────────────────────────── */
  function build(wb) {
    var styles = Styles(), sst = [], sstIx = {}, used = {}, files = [], now = new Date();
    function str(s) { s = String(s); if (sstIx[s] == null) { sstIx[s] = sst.length; sst.push(s); } return sstIx[s]; }

    var sheets = (wb.sheets || []).map(function (sh) {
      var name = sheetName(sh.name, used), prio = 1;
      var maxCol = 0, rowsXml = [];
      (sh.rows || []).forEach(function (row, r) {
        var rn = r + 1, cells = [];
        (row || []).forEach(function (cell, c) {
          if (cell == null) return;
          var o = (typeof cell === 'object') ? cell : { v: cell };
          var s = styles.get(o.s), ref = colName(c) + rn;
          if (c + 1 > maxCol) maxCol = c + 1;
          if (o.f != null) {
            cells.push('<c r="' + ref + '" s="' + s + '"><f>' + esc(o.f) + '</f>' + (typeof o.v === 'number' ? '<v>' + o.v + '</v>' : '') + '</c>');
          } else if (o.v == null || o.v === '') {
            cells.push('<c r="' + ref + '" s="' + s + '"/>');
          } else if (typeof o.v === 'number' && isFinite(o.v)) {
            cells.push('<c r="' + ref + '" s="' + s + '"><v>' + o.v + '</v></c>');
          } else {
            cells.push('<c r="' + ref + '" s="' + s + '" t="s"><v>' + str(o.v) + '</v></c>');
          }
        });
        var h = sh.heights && sh.heights[rn];
        rowsXml.push('<row r="' + rn + '"' + (h ? ' ht="' + h + '" customHeight="1"' : '') + '>' + cells.join('') + '</row>');
      });
      var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
      x += '<sheetPr>' + (rgb(sh.tabColor) ? '<tabColor rgb="' + rgb(sh.tabColor) + '"/>' : '') + '<pageSetUpPr fitToPage="1"/></sheetPr>';
      x += '<sheetViews><sheetView showGridLines="0" workbookViewId="0"' + (wb.sheets[0] === sh ? ' tabSelected="1"' : '') + '>';
      if (sh.freeze && (sh.freeze.row || sh.freeze.col)) {
        var fr = sh.freeze.row || 0, fc = sh.freeze.col || 0;
        x += '<pane' + (fc ? ' xSplit="' + fc + '"' : '') + (fr ? ' ySplit="' + fr + '"' : '') + ' topLeftCell="' + colName(fc) + (fr + 1) + '" activePane="' + (fr && fc ? 'bottomRight' : fr ? 'bottomLeft' : 'topRight') + '" state="frozen"/>';
      }
      x += '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18" customHeight="1"/>';
      if (sh.cols && sh.cols.length) x += '<cols>' + sh.cols.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols>';
      x += '<sheetData>' + rowsXml.join('') + '</sheetData>';
      if (sh.autoFilter) x += '<autoFilter ref="' + sh.autoFilter + '"/>';
      if (sh.merges && sh.merges.length) x += '<mergeCells count="' + sh.merges.length + '">' + sh.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>';
      (sh.dataBars || []).forEach(function (d) {
        x += '<conditionalFormatting sqref="' + d.ref + '"><cfRule type="dataBar" priority="' + (prio++) + '"><dataBar><cfvo type="num" val="0"/><cfvo type="max"/><color rgb="' + (rgb(d.color) || 'FF63BE7B') + '"/></dataBar></cfRule></conditionalFormatting>';
      });
      x += '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>';
      x += '<pageSetup paperSize="9" orientation="' + (sh.landscape === false ? 'portrait' : 'landscape') + '" fitToWidth="1" fitToHeight="0"/>';
      x += '</worksheet>';
      return { name: name, xml: x };
    });

    var n = sheets.length;
    files.push({ name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>' });
    files.push({ name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>' });
    files.push({ name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>' +
      sheets.map(function (s, i) { return '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' });
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
      '<Relationship Id="rId' + (n + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId' + (n + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>' });
    sheets.forEach(function (s, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: s.xml }); });
    files.push({ name: 'xl/styles.xml', data: styles.xml() });
    files.push({ name: 'xl/sharedStrings.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + sst.length + '" uniqueCount="' + sst.length + '">' +
      sst.map(function (s) { return '<si><t xml:space="preserve">' + esc(s) + '</t></si>'; }).join('') + '</sst>' });
    var iso = now.toISOString().replace(/\.\d+Z$/, 'Z');
    files.push({ name: 'docProps/core.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + esc(wb.title || 'Laporan') + '</dc:title><dc:creator>' + esc(wb.creator || 'Jam Fokus') + '</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + iso + '</dcterms:created></cp:coreProperties>' });
    files.push({ name: 'docProps/app.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Jam Fokus</Application></Properties>' });
    return zip(files, now);
  }

  return { build: build, colName: colName, crc32: crc32 };
});
