const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const template = fs.readFileSync(path.join(__dirname, '../src/autoupdate.js'), 'utf8');
const fixture = (version, body = '') => '// Variables used by Scriptable.\n// Pause 0.1.0-alpha.' + version + ' — test\nexecution.push(' + version + ');' + body + '\nScript.complete();\n';
function host({ files = new Map(), source = fixture(4), status = 200, offline = false, widget = true, query = {} } = {}) {
  const requests = [], execution = [];
  let id = 0;
  const context = {
    console: { log() {} }, execution, Date, args: { queryParameters: query }, config: { runsInWidget: widget },
    UUID: { string: () => 'uuid' + (++id) }, Script: { complete() {} },
    FileManager: { local: () => ({
      documentsDirectory: () => '/docs', joinPath: (a, b) => a + '/' + b,
      fileExists: p => files.has(p), createDirectory: p => files.set(p, null),
      listContents: p => [...files.keys()].filter(k => k.startsWith(p + '/')).map(k => k.slice(p.length + 1)),
      readString: p => { if (!files.has(p)) throw new Error('Missing'); return files.get(p); },
      writeString: (p, text) => files.set(p, text), move: (a, b) => { files.set(b, files.get(a)); files.delete(a); }
    }) },
    Request: class {
      constructor(url) { this.url = url; requests.push(this); }
      async loadString() { if (offline) throw new Error('Offline'); this.response = { statusCode: status }; return source; }
    }
  };
  return { files, requests, execution, async run() {
    const code = template.replace('/*__BUNDLED__*/', JSON.stringify(fixture(3)));
    await vm.runInNewContext('(async()=>{' + code + '\n})()', context);
  } };
}
test('new release is downloaded, saved and executed once; a recent widget run uses cache', async () => {
  const h = host(); await h.run(); assert.deepEqual(h.execution, [4]);
  assert.equal(h.requests[0].timeoutInterval, 3);
  assert.ok(h.requests[0].url.endsWith('/pause-scriptable/main/Pause.js'));
  const next = host({ files: h.files }); await next.run();
  assert.deepEqual(next.execution, [4]); assert.equal(next.requests.length, 0);
});
test('first launch works offline using the bundled version', async () => {
  const h = host({ offline: true }); await h.run(); assert.deepEqual(h.execution, [3]);
});
test('HTTP errors, truncated files and syntax errors retain available code', async () => {
  for (const options of [{ status: 404 }, { source: '<html>error</html>' }, { source: fixture(4, 'invalid ???') }]) {
    const h = host(options); await h.run(); assert.deepEqual(h.execution, [3]);
    assert.equal([...h.files.keys()].filter(p => p.endsWith('.js')).length, 0);
  }
});
test('cached newer versions are not downgraded and corrupt cache files are ignored', async () => {
  const files = new Map([
    ['/docs/PauseUpdates-v1/release-1-good.js', fixture(5)],
    ['/docs/PauseUpdates-v1/release-2-bad.js', 'broken'],
    ['/docs/PauseUpdates-v1/pending-incomplete.tmp', fixture(6)]
  ]);
  const h = host({ files }); await h.run(); assert.deepEqual(h.execution, [5]);
});
test('logging and undo bypass network; journal contents remain untouched by updater', async () => {
  for (const action of ['log', 'undo']) {
    const files = new Map([['/docs/PauseData-v1/journal/user.json', 'private history']]);
    const h = host({ files, widget: false, query: { action, product: 'stick' } }); await h.run();
    assert.equal(h.requests.length, 0); assert.deepEqual(h.execution, [3]);
    assert.equal(files.get('/docs/PauseData-v1/journal/user.json'), 'private history');
  }
});
test('foreground open checks for new versions even within the widget polling interval', async () => {
  const files = new Map([['/docs/PauseUpdates-v1/checked.json', JSON.stringify({ at: Date.now() })]]);
  const h = host({ files, widget: false }); await h.run(); assert.deepEqual(h.execution, [4]);
});
test('execution errors never trigger a second execution of an entry action', async () => {
  const h = host({ source: fixture(4, 'throw new Error("runtime failure");') });
  await assert.rejects(h.run(), /runtime failure/); assert.deepEqual(h.execution, [4]);
});
