const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.APP_SOURCE || path.join(__dirname, '../src/index.template.html'), 'utf8');
const start = source.indexOf("$('help').onclick=");
const end = source.indexOf("window.addEventListener('resize'", start);
assert.ok(start >= 0 && end > start, 'production Help bindings exist');
const bindings = source.slice(start, end);
const css = source.match(/<style>([\s\S]*?)<\/style>/)[1];
function rulesFor(selector) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(match => match[1].split(',').some(value => value.trim() === selector))
    .map(match => match[2]).join(';');
}
test('Help shell fits the dynamic viewport without displaying closed dialogs', () => {
  assert.match(rulesFor('dialog'), /max-height:[^;]*100dvh/);
  assert.match(rulesFor('dialog'), /overflow:hidden/);
  assert.doesNotMatch(rulesFor('dialog'), /display:flex/);
  assert.match(rulesFor('dialog[open]'), /display:flex/);
  assert.match(rulesFor('dialog[open]'), /flex-direction:column/);
});
test('Help body scrolls while its header and close control keep their size', () => {
  assert.match(rulesFor('.dialog-header'), /flex:0 0 auto/);
  assert.match(rulesFor('.dialog-header .icon-button'), /flex:0 0 auto/);
  assert.match(rulesFor('.dialog-body'), /flex:1 1 auto/);
  assert.match(rulesFor('.dialog-body'), /min-height:0/);
  assert.match(rulesFor('.dialog-body'), /overflow:auto/);
  assert.match(rulesFor('.dialog-body'), /overscroll-behavior:contain/);
});
test('Background scrolling is locked only while a native modal is open', () => {
  for (const selector of ['html:has(dialog:modal)', 'body:has(dialog:modal)'])
    assert.match(rulesFor(selector), /overflow:hidden/, selector);
});
function harness() {
  const elements = {};
  for (const id of ['help', 'helpClose', 'helpDialog']) {
    const listeners = {};
    elements[id] = { focused: false, focus() { this.focused = true; },
      addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
      dispatch(type, event = {}) { this['on' + type]?.(event); for (const fn of listeners[type] || []) fn(event); } };
  }
  const dialog = elements.helpDialog;
  Object.assign(dialog, { open: false, closeCount: 0,
    getBoundingClientRect: () => ({ left: 272.5, top: 83.61, right: 892.5, bottom: 673.38 }),
    showModal() { this.open = true; }, close() { this.open = false; this.closeCount++; this.dispatch('close'); } });
  vm.runInNewContext(bindings, { $: id => elements[id] });
  return { opener: elements.help, closer: elements.helpClose, dialog };
}
test('actual Help backdrop clicks close and return focus to the opener', () => {
  for (const [clientX, clientY] of [[90, 100], [920, 100], [500, 70], [500, 700]]) {
    const { opener, dialog } = harness(); opener.dispatch('click');
    dialog.dispatch('click', { target: dialog, clientX, clientY });
    assert.equal(dialog.open, false, `${clientX},${clientY}`);
    assert.equal(dialog.closeCount, 1); assert.equal(opener.focused, true);
  }
});
test('Help content, padding, boundary and coordinate-less clicks stay open', () => {
  const { opener, dialog } = harness(); opener.dispatch('click');
  for (const [clientX, clientY] of [[500, 100], [280, 90], [272.5, 83.61], [892.5, 673.38]])
    dialog.dispatch('click', { target: dialog, clientX, clientY });
  dialog.dispatch('click', { target: {}, clientX: 90, clientY: 100 });
  dialog.dispatch('click', { target: dialog });
  assert.equal(dialog.open, true); assert.equal(dialog.closeCount, 0); assert.equal(opener.focused, false);
});
test('closed Help ignores outside clicks without taking focus', () => {
  const { opener, dialog } = harness(); dialog.dispatch('click', { target: dialog, clientX: 90, clientY: 100 });
  assert.equal(dialog.closeCount, 0); assert.equal(opener.focused, false);
});
test('Close and native close (including Escape) restore Help focus repeatedly', () => {
  const { opener, closer, dialog } = harness();
  for (const close of [() => closer.dispatch('click'), () => dialog.close()]) {
    opener.focused = false; opener.dispatch('click'); close();
    assert.equal(dialog.open, false); assert.equal(opener.focused, true);
  }
});
