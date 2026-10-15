const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../src/core.js');
const script = fs.readFileSync(path.join(__dirname, '../Pause.js'), 'utf8');

// Behavioral host double, not a real iOS runtime. This verifies persistence and routing.
function host(files = new Map(), query = {}, family = null, parameter = '', bridgeRequests = []) {
  const nodes = [], replies = [], html = [], alerts = [], widgets = [];
  class Node {
    constructor() { this.children = []; nodes.push(this); }
    addText(value) { const n = new Node(); n.text = value; this.children.push(n); return n; }
    addStack() { const n = new Node(); this.children.push(n); return n; }
    addImage() { return new Node(); } addDate() { return new Node(); }
    applyRelativeStyle() {} setPadding() {} addSpacer() {} centerAlignContent() {}
    async presentMedium() {}
  }
  const fm = {
    documentsDirectory: () => '/docs', temporaryDirectory: () => '/tmp', joinPath: (a, b) => a + '/' + b,
    fileExists: p => files.has(p), createDirectory: p => files.set(p, null),
    listContents: p => [...files.keys()].filter(k => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/')).map(k => k.slice(p.length + 1)),
    readString: p => { if (!files.has(p)) throw new Error('Missing file'); return files.get(p); },
    writeString: (p, v) => files.set(p, v), move: (a, b) => { files.set(b, files.get(a)); files.delete(a); }
  };
  let finishPresentation;
  class WebView {
    async loadHTML(h) { html.push(h); }
    async evaluateJavaScript(js, callback) {
      if (callback) {
        if (bridgeRequests.length) return bridgeRequests.shift();
        if (finishPresentation) finishPresentation();
        return { type: 'close' };
      }
      replies.push(js);
    }
    async present() { if (bridgeRequests.length || replies.length === 0) await new Promise(resolve => { finishPresentation = resolve; setImmediate(() => { if (!bridgeRequests.length && replies.length === 0) resolve(); }); }); }
  }
  const sandbox = {
    console, Date, Math, JSON, Map, Set, encodeURIComponent,
    FileManager: { local: () => fm }, UUID: { string: () => C.id() },
    Color: class {}, Size: class {}, Font: { semiboldSystemFont() {}, systemFont() {} },
    ListWidget: Node, SFSymbol: { named: () => ({ image: {} }) },
    URLScheme: { forRunningScript: () => 'scriptable:///run?scriptName=Pause' },
    Script: { setWidget: w => widgets.push(w), complete() {} },
    config: { runsInWidget: family !== null, widgetFamily: family },
    args: { queryParameters: query, widgetParameter: parameter }, WebView,
    ShareSheet: { async present() {} },
    Alert: class { addAction() {} async presentAlert() { alerts.push(this.message); } }
  };
  return { async run() { await vm.runInNewContext('(async()=>{' + script + '\n})()', sandbox); }, files, nodes, html, alerts, widgets, replies };
}
const readLogs = files => C.reduce([...files].filter(([p]) => p.endsWith('.json')).map(([, v]) => JSON.parse(v))).logs;

test('generated single-file script parses and renders empty medium widget without records', async () => {
  const h = host(new Map(), {}, 'medium'); await h.run();
  assert.equal(h.alerts.length, 0); assert.equal(h.widgets.length, 1); assert.equal(readLogs(h.files).length, 0);
  assert.ok(h.nodes.some(n => n.text === '+ Stick')); assert.ok(h.nodes.some(n => n.text === '+ Cigarette'));
});
test('widget links launch correct action; app run saves before opening dashboard', async () => {
  const files = new Map(), h = host(files, { action: 'log', product: 'stick' }); await h.run();
  assert.equal(h.alerts.length, 0); assert.equal(readLogs(files).length, 1);
  assert.equal(h.html.length, 1); assert.ok(h.html[0].includes('Stick logged'));
  assert.ok(h.nodes.some(n => n.url && n.url.includes('action=log&product=cigarette')));
  const reopen = host(files); await reopen.run(); assert.equal(readLogs(files).length, 1);
});
test('two quick launches keep both records and stale undo removes the addressed one', async () => {
  const files = new Map();
  await host(files, { action: 'log', product: 'stick' }).run(); const first = readLogs(files)[0].id;
  await host(files, { action: 'log', product: 'cigarette' }).run();
  assert.equal(readLogs(files).length, 2);
  await host(files, { action: 'undo', logId: first }).run();
  assert.deepEqual(readLogs(files).map(l => l.product), ['cigarette']);
  await host(files, { action: 'undo', logId: first }).run(); assert.equal(readLogs(files).length, 1);
});
test('small widget opens dashboard, pause parameter opens craving route', async () => {
  const small = host(new Map(), {}, 'small'); await small.run();
  assert.ok(small.nodes.some(n => n.text === 'Tap to open your day')); assert.ok(!small.nodes.some(n => n.text === '+ Stick'));
  const pause = host(new Map(), {}, 'small', 'pause'); await pause.run();
  assert.ok(pause.widgets[0].url.includes('action=craving'));
});
test('invalid query and corrupt journal fail without resetting data', async () => {
  const files = new Map(); await host(files, { action: 'log', product: 'stick' }).run();
  const invalid = host(files, { action: 'log', product: 'unknown' }); await invalid.run();
  assert.equal(invalid.alerts.length, 1); assert.equal(readLogs(files).length, 1);
  files.set('/docs/PauseData-v1/journal/corrupt.json', '{broken');
  const broken = host(files); await broken.run(); assert.equal(broken.alerts.length, 1);
  assert.equal(files.get('/docs/PauseData-v1/journal/corrupt.json'), '{broken');
});
test('incomplete temporary files are ignored and widget reads do not write events', async () => {
  const files = new Map([['/docs/PauseData-v1/journal/interrupted.tmp', '{']]);
  const h = host(files, {}, 'large'); await h.run();
  assert.equal(readLogs(files).length, 0); assert.ok(h.nodes.some(n => n.text === 'Coffee without tobacco'));
});
test('dashboard bridge saves multiple actions and acknowledges latest persisted data', async () => {
  const h = host(new Map(), {}, null, '', [
    { id: 'setup', type: 'command', payload: { kind: 'settings', payload: { onboarded: true, products: ['stick', 'cigarette'] } } },
    { id: 'log1', type: 'command', payload: { kind: 'log', payload: { product: 'stick' } } },
    { id: 'log2', type: 'command', payload: { kind: 'log', payload: { product: 'cigarette' } } }
  ]);
  await h.run(); assert.equal(readLogs(h.files).length, 2);
  assert.ok(h.replies.some(js => js.startsWith('window.__pauseReply("log2",') && js.includes('cigarette')));
});
test('dashboard bridge returns validation errors without a false success record', async () => {
  const h = host(new Map(), {}, null, '', [
    { id: 'invalid', type: 'command', payload: { kind: 'settings', payload: { products: [] } } }
  ]);
  await h.run(); assert.equal(readLogs(h.files).length, 0);
  assert.ok(h.replies.some(js => js.includes('"error":"Choose at least one product.')));
});
