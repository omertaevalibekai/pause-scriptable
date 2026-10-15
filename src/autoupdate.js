// Pause automatic-update launcher. Only downloads code; never uploads the journal.
const BUNDLED_SOURCE = /*__BUNDLED__*/;
const UPDATE_URL = 'https://raw.githubusercontent.com/omertaevalibekai/pause-scriptable/main/Pause.js';
const UPDATE_INTERVAL = 6 * 60 * 60 * 1000;
const fm = FileManager.local();
const directory = fm.joinPath(fm.documentsDirectory(), 'PauseUpdates-v1');
if (!fm.fileExists(directory)) fm.createDirectory(directory, true);
const checkPath = fm.joinPath(directory, 'checked.json');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function prepare(source) {
  if (typeof source !== 'string' || source.length > 2000000 ||
      !source.startsWith('// Variables used by Scriptable.\n') ||
      !source.trimEnd().endsWith('Script.complete();')) throw new Error('Incomplete Pause download.');
  const match = source.match(/^\/\/ Pause (\d+)\.(\d+)\.(\d+)-alpha\.(\d+) /m);
  if (!match) throw new Error('Unsupported Pause version.');
  // Compile without executing: a truncated or syntactically invalid download cannot replace the cache.
  return { source, version: match.slice(1).map(Number), run: new AsyncFunction(source) };
}
function newer(a, b) {
  for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return false;
}
let selected = prepare(BUNDLED_SOURCE);
// Immutable complete files allow concurrent app/widget readers and keep earlier versions intact.
for (const name of fm.listContents(directory).filter(n => /^release-[\w-]+\.js$/.test(n)).sort().reverse()) {
  try {
    const candidate = prepare(fm.readString(fm.joinPath(directory, name)));
    if (newer(candidate.version, selected.version)) selected = candidate;
  } catch (_) { /* Ignore incomplete/corrupt code caches, not user data. */ }
}
let checked = 0;
try { checked = JSON.parse(fm.readString(checkPath)).at; } catch (_) { /* First run. */ }
const now = Date.now();
const query = args.queryParameters || {};
// Logging and undo launch the available version immediately; never wait for a download before saving.
const mutating = query.action === 'log' || query.action === 'undo';
const due = !Number.isFinite(checked) || checked <= 0 || checked > now || now - checked >= UPDATE_INTERVAL;
if (!mutating && (!config.runsInWidget || due)) {
  try {
    const request = new Request(UPDATE_URL);
    request.timeoutInterval = 3;
    request.headers = { 'Cache-Control': 'no-cache' };
    const source = await request.loadString();
    if (!request.response || request.response.statusCode !== 200) throw new Error('Update server unavailable.');
    const candidate = prepare(source);
    if (newer(candidate.version, selected.version)) {
      const temporary = fm.joinPath(directory, 'pending-' + UUID.string() + '.tmp');
      const final = fm.joinPath(directory, 'release-' + now + '-' + UUID.string() + '.js');
      fm.writeString(temporary, candidate.source);
      fm.move(temporary, final);
      selected = candidate;
    }
  } catch (error) {
    console.log('Pause update skipped; using saved version. ' + error.message);
  }
  try { fm.writeString(checkPath, JSON.stringify({ at: now })); } catch (_) { /* Updating is optional. */ }
}
// Invoke exactly once. Retrying after a runtime error could duplicate a smoking entry.
await selected.run();
