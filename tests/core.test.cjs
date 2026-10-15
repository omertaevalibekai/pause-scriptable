const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');
const now = new Date('2026-10-15T12:00:00.000Z');
const earlier = minutes => new Date(now.getTime() - minutes * 60000);
function append(ops, kind, payload, date = now) { const op = C.command(ops, kind, payload, date); ops.push(op); return op; }

test('empty days are unknown, not zero-use achievements', () => {
  const state = C.reduce([]), summary = C.summary(state, now);
  assert.equal(summary.today.complete, false); assert.equal(summary.average, null);
  assert.equal(summary.days.length, 7); assert.ok(summary.days.every(d => !d.complete));
});
test('separate products, chronological history, and undo of a backdated entry', () => {
  const ops = [];
  const a = append(ops, 'log', { product: 'stick' }, earlier(10));
  append(ops, 'log', { product: 'cigarette' }, earlier(5));
  const backdated = append(ops, 'log', { product: 'stick', occurredAt: earlier(30).toISOString() });
  let state = C.reduce(ops);
  assert.equal(state.logs[0].product, 'cigarette'); assert.equal(state.undoId, backdated.id);
  assert.equal(C.counts(state, C.dayKey(now)).stick, 2);
  append(ops, 'remove', { logId: backdated.id }, new Date(now.getTime() + 1));
  state = C.reduce(ops); assert.equal(state.logs.length, 2); assert.ok(state.logs.some(l => l.id === a.id));
  assert.equal(state.undoId, null);
});
test('stale widget undo targets only the encoded entry', () => {
  const ops = []; const old = append(ops, 'log', { product: 'stick' }, earlier(5));
  const recent = append(ops, 'log', { product: 'cigarette' }, earlier(1));
  append(ops, 'remove', { logId: old.id });
  assert.deepEqual(C.reduce(ops).logs.map(l => l.id), [recent.id]);
  assert.throws(() => append(ops, 'remove', { logId: old.id }), /already removed/);
});
test('confirming zero explicitly is allowed; adding or deleting reopens the day', () => {
  const ops = [], day = C.dayKey(now);
  append(ops, 'confirm', { day, value: true }, earlier(10));
  assert.equal(C.counts(C.reduce(ops), day).complete, true);
  const log = append(ops, 'log', { product: 'stick' }, earlier(5));
  assert.equal(C.counts(C.reduce(ops), day).complete, false);
  append(ops, 'confirm', { day, value: true }, earlier(1));
  append(ops, 'remove', { logId: log.id });
  assert.equal(C.counts(C.reduce(ops), day).complete, false);
});
test('average uses confirmed past days, not missing dates or today', () => {
  const ops = []; const yesterday = earlier(1440);
  append(ops, 'log', { product: 'stick' }, yesterday);
  append(ops, 'confirm', { day: C.dayKey(yesterday), value: true }, earlier(50));
  append(ops, 'confirm', { day: C.dayKey(now), value: true }, earlier(10));
  const summary = C.summary(C.reduce(ops), now);
  assert.equal(summary.average, 1); assert.equal(summary.confirmedDays, 1);
});
test('settings persist and disabling a product preserves its past records', () => {
  const ops = []; append(ops, 'log', { product: 'cigarette' }, earlier(10));
  append(ops, 'settings', { products: ['stick'], goals: { stick: 0, cigarette: null }, step: 'stress', onboarded: true });
  const state = C.reduce(ops); assert.equal(state.logs.length, 1); assert.equal(state.settings.goals.stick, 0);
  assert.throws(() => append(ops, 'log', { product: 'cigarette' }), /Enable/);
  for (const goals of [{ stick: -1 }, { stick: 1.5 }, { stick: 201 }]) assert.throws(() => append(ops, 'settings', { goals }));
  assert.throws(() => append(ops, 'settings', { products: [] }), /at least one/);
});
test('future entries and malformed days are rejected', () => {
  assert.throws(() => C.command([], 'log', { product: 'stick', occurredAt: new Date(now.getTime() + 1000).toISOString() }, now), /past/);
  assert.throws(() => C.command([], 'confirm', { day: '2026-02-31', value: true }, now));
  assert.throws(() => C.command([], 'confirm', { day: '2027-01-01', value: true }, now));
});
test('pause persists across reopen and elapsed time does not become negative', () => {
  const ops = []; append(ops, 'pauseStart', { trigger: 'stress' }, now);
  const restored = C.reduce(JSON.parse(C.backup(ops)).operations);
  assert.equal(C.remaining(restored.activePause, now.getTime()), 180);
  assert.equal(C.remaining(restored.activePause, now.getTime() + 31000), 149);
  assert.equal(C.remaining(restored.activePause, now.getTime() + 600000), 0);
  assert.throws(() => append(ops, 'pauseStart', { trigger: 'work' }), /already open/);
});
test('smoked pause creates one tagged use atomically; duplicate outcome is rejected', () => {
  const ops = [], start = append(ops, 'pauseStart', { trigger: 'work' }, earlier(4));
  const finish = append(ops, 'pauseFinish', { pauseId: start.id, outcome: 'smoked', product: 'cigarette' });
  const state = C.reduce([...ops, finish]);
  assert.equal(state.logs.length, 1); assert.equal(state.logs[0].trigger, 'work'); assert.equal(state.activePause, null);
  assert.throws(() => append(ops, 'pauseFinish', { pauseId: start.id, outcome: 'passed' }), /already saved/);
});
test('passed and cancelled pauses are distinct outcomes', () => {
  const ops = [], first = append(ops, 'pauseStart', { trigger: 'coffee' }, earlier(10));
  append(ops, 'pauseFinish', { pauseId: first.id, outcome: 'passed' }, earlier(8));
  const second = append(ops, 'pauseStart', { trigger: 'stress' }, earlier(6));
  append(ops, 'pauseFinish', { pauseId: second.id, outcome: 'cancelled' }, earlier(3));
  const state = C.reduce(ops); assert.equal(C.summary(state, now).passed, 1); assert.equal(state.logs.length, 0);
});
test('backup merge is idempotent, rejects conflict and validates before writing', () => {
  const ops = []; append(ops, 'log', { product: 'stick' });
  assert.equal(C.parseBackup(C.backup(ops), ops).length, 0);
  const copy = JSON.parse(C.backup(ops)); copy.operations[0].payload.product = 'cigarette';
  assert.throws(() => C.parseBackup(JSON.stringify(copy), ops), /conflict/);
  copy.operations[0].kind = 'unknown';
  assert.throws(() => C.parseBackup(JSON.stringify(copy), []), /newer version/);
  assert.throws(() => C.parseBackup('not JSON', []));
});
test('two writers are merged without losing an entry', () => {
  const first = C.command([], 'log', { product: 'stick' }, earlier(1));
  const second = C.command([], 'log', { product: 'cigarette' }, now);
  assert.equal(C.reduce([second, first]).logs.length, 2);
});
test('week crosses year boundaries and local-day midnight correctly', () => {
  const dates = C.week(C.reduce([]), new Date(2027, 0, 2, 12));
  assert.equal(dates[0].day, '2026-12-27'); assert.equal(dates[6].day, '2027-01-02');
  const day = C.dayKey(new Date(2026, 9, 15, 0, 0));
  const state = C.reduce([
    C.command([], 'log', { product: 'stick' }, new Date(2026, 9, 14, 23, 59)),
    C.command([], 'log', { product: 'cigarette' }, new Date(2026, 9, 15, 0, 0))
  ]);
  assert.equal(C.counts(state, day).total, 1);
});
test('causal updates survive identical timestamps and a clock moving backwards', () => {
  const ops = [];
  const start = append(ops, 'pauseStart', { trigger: 'stress' }, now);
  append(ops, 'pauseFinish', { pauseId: start.id, outcome: 'passed' }, now);
  assert.equal(C.reduce([...ops].reverse()).activePause, null);
  assert.equal(C.reduce(ops).pauses[0].outcome, 'passed');
  const log = append(ops, 'log', { product: 'stick' }, now);
  append(ops, 'remove', { logId: log.id }, earlier(1));
  assert.equal(C.reduce([...ops].reverse()).logs.length, 0);
});
