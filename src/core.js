/* Shared domain logic. No network, framework, or platform dependencies. */
const PauseCore = (() => {
  const PRODUCTS = ['stick', 'cigarette'];
  const TRIGGERS = ['coffee', 'stress', 'work', 'other'];
  const STEPS = {
    coffee: { title: 'Coffee without tobacco', detail: 'Try one coffee without a stick or cigarette today.', icon: 'coffee' },
    work: { title: 'A different work break', detail: 'Try a short walk on one break today.', icon: 'work' },
    stress: { title: 'Pause when stress hits', detail: 'Try a three-minute pause before deciding.', icon: 'pause' }
  };
  const id = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  const dayKey = value => {
    const d = new Date(value);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  };
  const validDate = s => typeof s === 'string' && Number.isFinite(Date.parse(s));
  const validDay = s => {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    return dayKey(new Date(s + 'T12:00:00')) === s;
  };
  const assert = (test, message) => { if (!test) throw new Error(message); };
  function settingsOK(p) {
    assert(p && typeof p === 'object', 'Invalid settings.');
    const allowed = ['products', 'goals', 'step', 'onboarded'];
    assert(Object.keys(p).every(k => allowed.includes(k)), 'Unknown setting.');
    if ('products' in p) assert(Array.isArray(p.products) && p.products.length > 0 && p.products.length <= 2 && new Set(p.products).size === p.products.length && p.products.every(x => PRODUCTS.includes(x)), 'Choose at least one product.');
    if ('goals' in p) {
      assert(p.goals && typeof p.goals === 'object', 'Invalid goals.');
      for (const k of Object.keys(p.goals)) assert(PRODUCTS.includes(k) && (p.goals[k] === null || (Number.isInteger(p.goals[k]) && p.goals[k] >= 0 && p.goals[k] <= 200)), 'Goals must be whole numbers from 0 to 200.');
    }
    if ('step' in p) assert(Object.keys(STEPS).includes(p.step), 'Choose a valid step.');
    if ('onboarded' in p) assert(typeof p.onboarded === 'boolean', 'Invalid setup state.');
  }
  function validate(op) {
    assert(op && op.v === 1 && Number.isSafeInteger(op.sequence) && op.sequence > 0 && typeof op.id === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(op.id) && validDate(op.at), 'Invalid record. Your data has not been replaced.');
    const p = op.payload;
    assert(p && typeof p === 'object', 'Missing record details.');
    switch (op.kind) {
      case 'log':
        assert(PRODUCTS.includes(p.product) && validDate(p.occurredAt), 'Invalid smoking record.');
        assert(p.trigger === null || TRIGGERS.includes(p.trigger), 'Invalid trigger.');
        break;
      case 'remove': assert(typeof p.logId === 'string' && p.logId.length <= 110, 'Invalid record to remove.'); break;
      case 'settings': settingsOK(p); break;
      case 'confirm': case 'step': assert(validDay(p.day) && typeof p.value === 'boolean', 'Invalid day.'); break;
      case 'pauseStart': assert(TRIGGERS.includes(p.trigger) && validDate(p.endsAt) && Date.parse(p.endsAt) === Date.parse(op.at) + 180000, 'Invalid pause.'); break;
      case 'pauseFinish':
        assert(typeof p.pauseId === 'string' && ['passed', 'smoked', 'cancelled'].includes(p.outcome), 'Invalid pause result.');
        if (p.outcome === 'smoked') assert(PRODUCTS.includes(p.product), 'Choose the product you used.');
        break;
      default: throw new Error('This backup needs a newer version of Pause.');
    }
    return op;
  }
  // Sequence preserves causality even when two writes share a millisecond or the
  // device clock moves backwards. Concurrent independent writes use time / ID.
  const compare = (a, b) => a.sequence - b.sequence || Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id);
  function reduce(operations) {
    const state = { settings: { products: [...PRODUCTS], goals: { stick: null, cigarette: null }, step: 'coffee', onboarded: false }, logs: [], confirmed: {}, steps: {}, pauses: [], activePause: null, undoId: null };
    const logs = new Map(), removed = new Set(), pauses = new Map(), seen = new Set();
    const addLog = (log) => { logs.set(log.id, log); state.confirmed[dayKey(log.occurredAt)] = false; state.undoId = log.id; };
    for (const op of [...operations].sort(compare)) {
      validate(op);
      if (seen.has(op.id)) continue;
      seen.add(op.id);
      const p = op.payload;
      switch (op.kind) {
        case 'log': addLog({ product: p.product, occurredAt: p.occurredAt, trigger: p.trigger, id: op.id, createdAt: op.at }); break;
        case 'remove': {
          removed.add(p.logId);
          const log = logs.get(p.logId);
          if (log) state.confirmed[dayKey(log.occurredAt)] = false;
          break;
        }
        case 'settings': state.settings = { ...state.settings, ...p, goals: { ...state.settings.goals, ...(p.goals || {}) } }; break;
        case 'confirm': state.confirmed[p.day] = p.value; break;
        case 'step': state.steps[p.day] = p.value; break;
        case 'pauseStart': pauses.set(op.id, { id: op.id, startedAt: op.at, ...p, outcome: null }); break;
        case 'pauseFinish': {
          const pause = pauses.get(p.pauseId);
          if (pause && !pause.outcome) {
            pause.outcome = p.outcome; pause.finishedAt = op.at;
            if (p.outcome === 'smoked') addLog({ id: 'log-' + op.id, product: p.product, occurredAt: op.at, createdAt: op.at, trigger: pause.trigger });
          }
          break;
        }
      }
    }
    state.logs = [...logs.values()].filter(l => !removed.has(l.id)).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
    state.pauses = [...pauses.values()];
    state.activePause = state.pauses.filter(p => !p.outcome).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0] || null;
    if (removed.has(state.undoId)) state.undoId = null;
    return state;
  }
  function command(ops, kind, payload, now = new Date()) {
    const state = reduce(ops);
    let p = JSON.parse(JSON.stringify(payload || {}));
    if (kind === 'log') {
      p = { product: p.product, occurredAt: p.occurredAt || now.toISOString(), trigger: p.trigger || null };
      assert(state.settings.products.includes(p.product), 'Enable this product in your plan first.');
      assert(validDate(p.occurredAt) && Date.parse(p.occurredAt) <= now.getTime(), 'Choose a time in the past or now.');
    }
    if (kind === 'remove') assert(state.logs.some(l => l.id === p.logId), 'This entry was already removed.');
    if (kind === 'confirm' || kind === 'step') assert(p.day <= dayKey(now), 'Future days cannot be confirmed.');
    if (kind === 'pauseStart') {
      assert(!state.activePause, 'A pause is already open. Finish it before starting another.');
      p.endsAt = new Date(now.getTime() + 180000).toISOString();
    }
    if (kind === 'pauseFinish') {
      assert(state.pauses.some(x => x.id === p.pauseId && !x.outcome), 'This pause was already saved.');
      if (p.outcome === 'smoked') assert(state.settings.products.includes(p.product), 'Choose an enabled product.');
    }
    const sequence = ops.reduce((largest, op) => Math.max(largest, op.sequence), 0) + 1;
    return validate({ v: 1, sequence, id: id(), at: now.toISOString(), kind, payload: p });
  }
  function counts(state, day) {
    const logs = state.logs.filter(l => dayKey(l.occurredAt) === day);
    return { stick: logs.filter(l => l.product === 'stick').length, cigarette: logs.filter(l => l.product === 'cigarette').length, total: logs.length, complete: state.confirmed[day] === true };
  }
  function week(state, now = new Date()) {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - 6 + i);
      const day = dayKey(d);
      return { day, ...counts(state, day) };
    });
  }
  function summary(state, now = new Date()) {
    const today = dayKey(now), days = week(state, now);
    const confirmed = days.filter(x => x.complete && x.day !== today);
    return { today: counts(state, today), days, confirmedDays: confirmed.length, average: confirmed.length ? confirmed.reduce((sum, d) => sum + d.total, 0) / confirmed.length : null, last: state.logs[0] || null, passed: state.pauses.filter(p => p.outcome === 'passed' && dayKey(p.finishedAt) === today).length };
  }
  function parseBackup(text, existing = []) {
    assert(typeof text === 'string' && text.length <= 10 * 1024 * 1024, 'Backup is too large.');
    const file = JSON.parse(text);
    assert(file.format === 'pause-backup' && file.version === 1 && Array.isArray(file.operations) && file.operations.length <= 100000, 'Choose a Pause version 1 backup.');
    const known = new Map(existing.map(op => [op.id, JSON.stringify(op)])), added = [];
    for (const op of file.operations) {
      validate(op);
      const encoded = JSON.stringify(op);
      if (known.has(op.id)) assert(known.get(op.id) === encoded, 'A backup record conflicts with existing data. Nothing was imported.');
      else { known.set(op.id, encoded); added.push(op); }
    }
    return added;
  }
  const backup = ops => JSON.stringify({ format: 'pause-backup', version: 1, exportedAt: new Date().toISOString(), operations: ops }, null, 2);
  const remaining = (pause, now = Date.now()) => pause ? Math.max(0, Math.ceil((Date.parse(pause.endsAt) - now) / 1000)) : 180;
  return { PRODUCTS, TRIGGERS, STEPS, id, dayKey, validate, reduce, command, counts, week, summary, parseBackup, backup, remaining };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = PauseCore;
