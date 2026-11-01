/* Experience-owned UI primitives. These components do not depend on Original page markup. */
(function (root) {
  'use strict';
  var ui = root.JF.ui;

  function el(spec, attrs) {
    var args = [spec];
    for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
    return ui.el.apply(null, args);
  }

  function button(label, onClick, tone) {
    var node = el('button.cw-button' + (tone ? '.cw-' + tone : ''), { type: 'button', onclick: onClick }, label);
    return node;
  }

  function card(className) {
    return el('section.cw-panel' + (className ? '.' + className : ''));
  }

  function heading(title, description, actions) {
    var node = el('div.cw-section-title',
      el('div', el('h2', title), description ? el('p', description) : null));
    if (actions) node.appendChild(actions);
    return node;
  }

  function field(label, control, hint) {
    var node = el('label.cw-field', el('span.cw-field-label', label), control);
    if (hint) node.appendChild(el('small.cw-hint', hint));
    return node;
  }

  function input(type, value, attrs) {
    return el('input.cw-input', Object.assign({ type: type || 'text', value: value == null ? '' : value }, attrs || {}));
  }

  function select(options, selected, attrs) {
    var node = el('select.cw-input', attrs || {});
    options.forEach(function (option) {
      var value = typeof option === 'string' ? option : option.value;
      var label = typeof option === 'string' ? option : option.label;
      var item = el('option', { value: value }, label);
      item.selected = String(value) === String(selected);
      node.appendChild(item);
    });
    return node;
  }

  function stat(label, value, detail) {
    return el('article.cw-stat', el('span', label), el('strong', value), detail ? el('small', detail) : null);
  }

  function empty(title, detail, action) {
    var box = el('div.cw-empty',
      el('span.cw-empty-art', { html: '<svg viewBox="0 0 96 76" aria-hidden="true"><path d="M8 63q19-10 38 0 19-10 42 0v7H8z" fill="#ead1ad"/><path d="M27 58q0-24 21-24t21 24v5H27z" fill="#c77d48"/><ellipse cx="48" cy="51" rx="18" ry="14" fill="#e8b67e"/><circle cx="42" cy="47" r="1.7" fill="#49352d"/><circle cx="54" cy="47" r="1.7" fill="#49352d"/><ellipse cx="48" cy="52" rx="3" ry="2" fill="#49352d"/></svg>' }),
      el('h3', title), el('p', detail));
    if (action) box.appendChild(action);
    return box;
  }

  function badge(text, variant) {
    return el('span.cw-badge' + (variant ? '.cw-badge-' + variant : ''), text);
  }

  function progress(value, label) {
    var percent = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    return el('div.cw-progress', { role: 'progressbar', 'aria-label': label || 'Progres', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(percent) },
      el('span', { style: { width: percent + '%' } }));
  }

  root.JF.capybaraUI = {
    el: el, button: button, card: card, heading: heading, field: field, input: input,
    select: select, stat: stat, empty: empty, badge: badge, progress: progress
  };
})(window);
