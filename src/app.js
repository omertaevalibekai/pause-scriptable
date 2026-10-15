(() => {
  'use strict';
  const C = PauseCore, boot = window.__PAUSE_BOOT__ || { mode: 'browser' };
  const native = boot.mode === 'native', prefix = 'pause.v1.op.';
  const $ = id => document.getElementById(id);
  const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const paths = {
    today: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    history: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    plan: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 3h6v3H9zM9 11h6M9 15h6"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    coffee: '<path d="M4 9h13v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM17 10h2a3 3 0 0 1 0 6h-2M7 3v3M11 2v4M15 3v3"/>',
    stress: '<path d="m13 2-8 12h6l-1 8 9-13h-6z"/>',
    work: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V4h8v3M3 12h18"/>',
    other: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    arrow: '<path d="m9 6 6 6-6 6"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    settings: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3"/>',
    leaf: '<path d="M20 3C5 2 1 10 6 16s15 1 14-13ZM5 21l10-13"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.other}</svg>`;
  const productName = p => p === 'stick' ? 'Stick' : 'Cigarette';
  const productPlural = p => p === 'stick' ? 'IQOS sticks' : 'Cigarettes';
  const triggerName = t => t ? t[0].toUpperCase() + t.slice(1) : 'Not tagged';
  const dateLabel = day => new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeLabel = d => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  let ops = [], state, page = 'today', modal = null, error = '', pending = false, toastTimer, lastFocus;
  let historyDay = C.dayKey(new Date());
  let selectedTrigger = 'coffee', selectedProducts = ['stick', 'cigarette'];
  window.__nativeQueue = []; window.__nativeWaiter = null;
  const requests = new Map();
  window.__pauseReply = (id, response) => { const request = requests.get(id); if (request) { requests.delete(id); response.error ? request.reject(new Error(response.error)) : request.resolve(response); } };
  function nativeCall(type, payload) {
    const id = C.id();
    return new Promise((resolve, reject) => {
      requests.set(id, { resolve, reject });
      const message = { id, type, payload };
      if (window.__nativeWaiter) { const waiter = window.__nativeWaiter; window.__nativeWaiter = null; waiter(message); }
      else window.__nativeQueue.push(message);
    });
  }
  function browserRead() {
    const all = [];
    for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key.startsWith(prefix)) all.push(C.validate(JSON.parse(localStorage.getItem(key)))); }
    return all;
  }
  async function transport(type, payload) {
    if (native) return nativeCall(type, payload);
    let current = browserRead();
    if (type === 'command') {
      const op = C.command(current, payload.kind, payload.payload);
      localStorage.setItem(prefix + op.id, JSON.stringify(op));
      current = browserRead();
    } else if (type === 'export') {
      const url = URL.createObjectURL(new Blob([C.backup(current)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'Pause-backup-' + C.dayKey(new Date()) + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else if (type === 'import') {
      const additions = C.parseBackup(payload.text, current);
      for (const op of additions) localStorage.setItem(prefix + op.id, JSON.stringify(op));
      current = browserRead();
    }
    return { operations: current };
  }
  function toast(text) { clearTimeout(toastTimer); $('toast').textContent = text; $('toast').hidden = false; toastTimer = setTimeout(() => $('toast').hidden = true, 3400); }
  function showError(e) {
    error = e.message || 'Unable to save. Please try again.';
    const target = $('modal-error') || $('page-error');
    if (target) { target.textContent = error; target.hidden = false; target.scrollIntoView({ block: 'nearest' }); }
  }
  async function action(kind, payload, message, close = false) {
    if (pending) return false;
    pending = true; document.body.classList.add('is-busy'); document.body.setAttribute('aria-busy', 'true');
    try {
      const response = await transport('command', { kind, payload });
      ops = response.operations; state = C.reduce(ops); error = '';
      if (close) modal = null;
      render(); if (message) toast(message);
      return true;
    } catch (e) { showError(e); return false; }
    finally { pending = false; document.body.classList.remove('is-busy'); document.body.removeAttribute('aria-busy'); }
  }
  function lastText() {
    const last = state.logs[0];
    if (!last) return 'Your first entry starts here';
    const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(last.occurredAt)) / 60000));
    if (minutes < 1) return 'Last recorded just now';
    if (minutes < 60) return 'Last recorded ' + minutes + ' min ago';
    if (minutes < 1440) return 'Last recorded ' + Math.floor(minutes / 60) + ' hr ' + minutes % 60 + ' min ago';
    return 'Last recorded ' + Math.floor(minutes / 1440) + ' days ago';
  }
  function chart() {
    const days = C.week(state), max = Math.max(1, ...days.map(d => d.total));
    return `<div class="card"><div class="card-title"><h2>Last 7 days</h2><div class="legend"><span>Sticks</span><span>Cigarettes</span></div></div><div class="chart" role="img" aria-label="Recorded use over seven days. ${days.map(d => `${dateLabel(d.day)}: ${d.total} recorded${d.complete ? ', complete' : ', unconfirmed'}`).join('. ')}">${days.map(d => `<div class="day-bar"><span class="bar-number">${d.total || (d.complete ? '0' : '—')}</span><div class="bar" style="height:${d.total ? Math.max(5, d.total / max * 98) : 3}px"><div class="segment-stick" style="height:${d.total ? d.stick / d.total * 100 : 0}%"></div><div class="segment-cigarette" style="height:${d.total ? d.cigarette / d.total * 100 : 0}%"></div></div><span class="bar-label">${new Date(d.day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}</span></div>`).join('')}</div><p class="chart-note">Recorded use, not nicotine dose. — means no entries and no day confirmation.</p></div>`;
  }
  function logButtons() { return state.settings.products.map(p => `<button class="btn ${p === 'stick' ? 'primary' : 'secondary'}" data-act="log" data-product="${p}">+ ${productName(p)}</button>`).join(''); }
  function today() {
    const summary = C.summary(state), step = C.STEPS[state.settings.step], day = C.dayKey(new Date()), done = state.steps[day];
    return `<div class="top"><div><h1>My day</h1><p>${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p></div><button class="icon-button" aria-label="Open my plan" data-act="page" data-page="plan">${icon('settings')}</button></div>
    <section class="card"><h2>Today</h2><div class="counts">${state.settings.products.map(p => `<div class="count"><div class="number" data-count="${p}">${summary.today[p]}</div><div class="count-label">${productPlural(p)}</div></div>`).join('')}</div><p class="last" id="last-use">${lastText()}</p><div class="buttons">${logButtons()}</div><div class="card-footer"><button class="link" data-act="add">Add a missed entry</button><button class="link" data-act="undo" ${!state.undoId ? 'disabled' : ''}>Undo last entry</button></div></section>
    <button class="crave-button" data-act="craving"><span>${icon('pause')} ${state.activePause ? 'Return to your pause' : 'I feel like smoking'}</span>${icon('arrow')}</button>
    ${chart()}<div class="card step"><div class="step-icon">${icon(step.icon)}</div><div class="step-text"><p>My small step</p><h3>${step.title}</h3><p>${step.detail}</p></div><button class="check ${done ? 'done' : ''}" data-act="step" aria-label="${done ? 'Mark step as not done' : 'Mark step as done'}" aria-pressed="${!!done}">${done ? icon('check') : icon('plus')}</button></div>
    ${state.settings.products.some(p => state.settings.goals[p] !== null) ? `<section class="card"><h2>My daily goals</h2>${state.settings.products.filter(p => state.settings.goals[p] !== null).map(p => `<div class="goal-line"><span>${productPlural(p)}</span><span>${summary.today[p]} recorded · goal ${state.settings.goals[p]}</span></div>`).join('')}<p class="hint">A goal you chose. Every next decision still counts.</p></section>` : ''}
    ${summary.passed ? `<p class="center small muted">${summary.passed} ${summary.passed === 1 ? 'urge' : 'urges'} passed without smoking today.</p>` : ''}
    <div class="center"><button class="link" data-act="review-day">${summary.today.complete ? 'Today is confirmed · review' : 'Finished logging for today?'}</button></div>`;
  }
  function history() {
    const logs = state.logs.filter(l => C.dayKey(l.occurredAt) === historyDay);
    const stats = C.counts(state, historyDay), summary = C.summary(state);
    return `<div class="top"><div><h1>Your history</h1><p>Notice patterns, one day at a time.</p></div><button class="icon-button" data-act="add" aria-label="Add a missed entry">${icon('plus')}</button></div>${chart()}
    <label class="field"><span>Choose a day</span><input type="date" id="history-day" value="${historyDay}" max="${C.dayKey(new Date())}"></label>
    <div class="day-heading"><h2>${dateLabel(historyDay)}</h2><span class="badge ${stats.complete ? 'complete' : ''}">${stats.complete ? 'Day confirmed' : 'Not confirmed'}</span></div>
    <section class="card">${logs.length ? logs.map(l => `<div class="row"><span class="dot ${l.product}"></span><div class="details"><strong>${productName(l.product)}</strong><small>${timeLabel(l.occurredAt)}${l.trigger ? ' · ' + triggerName(l.trigger) : ''}</small></div><button class="icon-button" data-act="delete" data-id="${l.id}" aria-label="Delete ${productName(l.product).toLowerCase()} at ${timeLabel(l.occurredAt)}">${icon('trash')}</button></div>`).join('') : `<div class="empty">${icon('leaf')}<p>${stats.complete ? 'You confirmed no tobacco use on this day.' : 'No entries for this day yet.<br>Add anything you missed, or confirm the day.'}</p></div>`}<button class="btn ghost wide" data-act="confirm-day">${stats.complete ? 'Reopen this day' : 'Confirm this day is complete'}</button></section>
    <p class="hint">${summary.confirmedDays ? 'Average across ' + summary.confirmedDays + ' confirmed past ' + (summary.confirmedDays === 1 ? 'day' : 'days') + ' in this week: ' + summary.average.toFixed(1) + ' recorded uses per day.' : 'Confirm past days to see a meaningful average.'} Missing days are not counted as zero.</p>`;
  }
  function productChoices(products) { return C.PRODUCTS.map(p => `<button type="button" class="choice ${products.includes(p) ? 'selected' : ''}" data-act="choose-product" data-product="${p}" aria-pressed="${products.includes(p)}">${products.includes(p) ? icon('check') : icon('plus')}${productPlural(p)}</button>`).join(''); }
  function plan() {
    return `<div class="top"><div><h1>Your pace</h1><p>A small step you choose.</p></div></div><form id="plan-form"><section class="card"><h2>What do you use?</h2><div class="choices" id="product-choices" style="margin-top:16px">${productChoices(selectedProducts)}</div><p class="hint">Changing this keeps your existing history.</p><div class="divider"></div><h2>Daily goals <span class="time-range">optional</span></h2><p class="hint">Choose your own numbers, or leave them blank while you learn your pattern.</p><div class="split">${C.PRODUCTS.map(p => `<label class="field"><span>${productPlural(p)}</span><input id="goal-${p}" aria-label="Daily goal for ${productPlural(p).toLowerCase()}" type="number" inputmode="numeric" min="0" max="200" step="1" placeholder="Not set" value="${state.settings.goals[p] === null ? '' : state.settings.goals[p]}"></label>`).join('')}</div><label class="field"><span>My small step</span><select id="plan-step">${Object.entries(C.STEPS).map(([key, step]) => `<option value="${key}" ${state.settings.step === key ? 'selected' : ''}>${step.title}</option>`).join('')}</select></label><button type="submit" class="btn primary wide">Save my plan</button></section></form>
    <section class="card"><h2>Your data</h2><p class="hint">${native ? 'Saved on this iPhone. No account or server.' : 'Saved only in this browser. This preview does not sync with Scriptable.'}</p><div class="buttons"><button class="btn ghost" data-act="export">Export backup</button><button class="btn ghost" data-act="import">Restore backup</button></div><p class="hint">Keep a backup before deleting Scriptable or changing phones.</p></section>
    <section class="card"><h2>Support for quitting</h2><p class="hint">Reducing use can be a step toward stopping. Pause tracks behavior; it does not measure nicotine or prescribe a taper.</p><p class="hint">A health professional can help you explore counseling and stop-smoking treatments.</p><a class="install-link support-link" href="https://smokefree.gov/build-your-quit-plan" target="_blank" rel="noopener">Build a quit plan with Smokefree.gov</a></section>
    ${native ? '<div class="center"><button class="link" data-act="widget-preview">Preview my widget</button></div>' : '<div class="center"><a class="install-link" href="Install.html" target="_blank">Install the iPhone widget</a></div>'}`;
  }
  function render() {
    $('preview-note').hidden = native;
    $('app').innerHTML = `<div id="page-error" class="error-banner" role="alert" ${error ? '' : 'hidden'}>${escape(error)}</div>` + ({ today, history, plan }[page])();
    $('nav').innerHTML = ['today', 'history', 'plan'].map(p => `<button data-act="page" data-page="${p}" class="${page === p ? 'active' : ''}" aria-current="${page === p ? 'page' : 'false'}">${icon(p)}${p[0].toUpperCase() + p.slice(1)}</button>`).join('');
    renderModal();
  }
  function openModal(type, extra = {}) { lastFocus = document.activeElement; modal = { type, ...extra }; renderModal(); }
  function closeModal() { modal = null; renderModal(); if (lastFocus && lastFocus.isConnected) lastFocus.focus(); }
  function renderModal() {
    if (!modal) { $('modal-root').innerHTML = ''; document.body.style.overflow = ''; $('app').inert = false; $('nav').inert = false; return; }
    document.body.style.overflow = 'hidden'; $('app').inert = true; $('nav').inert = true;
    let title = '', body = '';
    if (modal.type === 'welcome') {
      title = 'A little more space.';
      body = `<div class="welcome-symbol">${icon('pause')}</div><p>Log a stick or cigarette in a moment. Notice your patterns and take one small step at a time.</p><h3 style="margin:24px 0 14px">What do you use?</h3><div class="choices" id="product-choices">${productChoices(selectedProducts)}</div><p class="hint" style="margin-top:18px">You can change this anytime. Your history stays with you.</p><button class="btn primary wide" data-act="begin" style="margin-top:24px">Start my day</button>`;
    } else if (modal.type === 'craving') {
      title = 'Feeling the urge?';
      const pause = state.activePause, trigger = pause ? pause.trigger : selectedTrigger;
      const hints = { coffee: 'Try finishing your coffee in a different spot.', stress: 'Stand up, sip some water, or take a short walk.', work: 'Step away from your desk for a different kind of break.', other: 'Change what you are doing for a few minutes.' };
      body = `<div class="craving"><p>${pause ? 'Make a little room for yourself.' : 'What is bringing it on?'}</p><div class="choices">${C.TRIGGERS.map(t => `<button class="choice ${t === trigger ? 'selected' : ''}" data-act="trigger" data-trigger="${t}" aria-pressed="${t === trigger}" ${pause ? 'disabled' : ''}>${icon(t)}${triggerName(t)}</button>`).join('')}</div><div class="pause-orb">${icon('pause')}</div><div class="timer" id="pause-timer" role="timer" aria-label="Time remaining">03:00</div><h3 id="pause-heading">Try a little pause</h3><p>${hints[trigger]}</p>${pause ? `<button class="btn primary wide" data-act="passed">The urge passed</button><button class="btn ghost wide" data-act="smoked">I smoked</button><button class="link" data-act="cancel-pause">End pause without a result</button>` : '<button class="btn primary wide" data-act="start-pause">Start 3-minute pause</button><button class="btn ghost wide" data-act="smoked">Record a smoke instead</button>'}</div>`;
    } else if (modal.type === 'smoked') {
      title = 'What did you use?';
      body = `<p>Your progress is still here. Record it and keep going.</p><div class="buttons">${state.settings.products.map(p => `<button class="btn ${p === 'stick' ? 'primary' : 'secondary'}" data-act="finish-smoked" data-product="${p}">+ ${productName(p)}</button>`).join('')}</div>`;
    } else if (modal.type === 'add') {
      title = 'Add a missed entry';
      const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      const local = d.toISOString().slice(0, 16);
      body = `<form id="add-form"><label class="field"><span>Product</span><select id="entry-product">${state.settings.products.map(p => `<option value="${p}">${productName(p)}</option>`).join('')}</select></label><label class="field"><span>When?</span><input id="entry-date" type="datetime-local" value="${local}" max="${local}" required></label><label class="field"><span>Trigger <span class="muted">optional</span></span><select id="entry-trigger"><option value="">Not tagged</option>${C.TRIGGERS.map(t => `<option value="${t}">${triggerName(t)}</option>`).join('')}</select></label><button type="submit" class="btn primary wide">Save entry</button></form>`;
    } else if (modal.type === 'delete') {
      title = 'Remove this entry?';
      body = `<p>This changes your recorded count for that day.</p><div class="buttons"><button class="btn ghost" data-act="close">Keep entry</button><button class="btn primary" data-act="delete-confirm" data-id="${escape(modal.id)}">Remove entry</button></div>`;
    } else if (modal.type === 'confirm') {
      title = 'All logged for this day?';
      const counts = C.counts(state, modal.day);
      body = `<p>${dateLabel(modal.day)}: ${counts.stick} ${counts.stick === 1 ? 'stick' : 'sticks'} and ${counts.cigarette} ${counts.cigarette === 1 ? 'cigarette' : 'cigarettes'} recorded.</p><p style="margin-top:14px">Confirm only if this includes everything you used. Adding or removing an entry will reopen the day.</p><div class="buttons"><button class="btn ghost" data-act="close">Not yet</button><button class="btn primary" data-act="confirm-save" data-day="${modal.day}">Yes, all logged</button></div>`;
    } else if (modal.type === 'import') {
      title = 'Restore a backup';
      body = `<p>Paste the full contents of a Pause backup. Records are merged without deleting your existing history.</p><form id="import-form"><label class="field"><span>Backup JSON</span><textarea id="backup-text" required spellcheck="false" placeholder="Paste your backup here"></textarea></label><button class="btn primary wide" type="submit">Merge backup</button></form>`;
    }
    $('modal-root').innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">${title}</h2>${modal.type !== 'welcome' ? `<button class="icon-button" data-act="close" aria-label="Close">${icon('close')}</button>` : ''}</div><div id="modal-error" class="error-banner modal-error" role="alert" hidden></div>${body}</section></div>`;
    tick();
    setTimeout(() => { const first = $('modal-root').querySelector('button:not([disabled]),input,select'); if (first) first.focus({ preventScroll: true }); }, 0);
  }
  function tick() {
    const el = $('pause-timer');
    if (el) { const seconds = C.remaining(state.activePause); el.textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'); $('pause-heading').textContent = seconds === 0 ? 'How do you feel now?' : 'Try a little pause'; }
    if ($('last-use')) $('last-use').textContent = lastText();
  }
  async function special(type, payload = {}, message = '') {
    if (pending) return;
    pending = true;
    try { const response = await transport(type, payload); if (response.operations) { ops = response.operations; state = C.reduce(ops); } error = ''; if (type === 'import') modal = null; render(); if (message) toast(message); }
    catch (e) { showError(e); }
    finally { pending = false; }
  }
  document.addEventListener('click', async e => {
    const button = e.target.closest('[data-act]'); if (!button || button.disabled || pending) return;
    const a = button.dataset.act, p = button.dataset.product;
    if (a === 'page') { page = button.dataset.page; selectedProducts = [...state.settings.products]; render(); window.scrollTo(0, 0); }
    else if (a === 'log') await action('log', { product: p }, productName(p) + ' logged');
    else if (a === 'undo' && state.undoId) await action('remove', { logId: state.undoId }, 'Last entry removed');
    else if (a === 'add') openModal('add');
    else if (a === 'close') closeModal();
    else if (a === 'craving') openModal('craving');
    else if (a === 'trigger') { selectedTrigger = button.dataset.trigger; renderModal(); }
    else if (a === 'start-pause') await action('pauseStart', { trigger: selectedTrigger }, 'Your pause has started');
    else if (a === 'passed' || a === 'cancel-pause') await action('pauseFinish', { pauseId: state.activePause.id, outcome: a === 'passed' ? 'passed' : 'cancelled' }, a === 'passed' ? 'A moment you made room for.' : 'Pause ended', true);
    else if (a === 'smoked') openModal('smoked');
    else if (a === 'finish-smoked') {
      if (state.activePause) await action('pauseFinish', { pauseId: state.activePause.id, outcome: 'smoked', product: p }, productName(p) + ' logged', true);
      else await action('log', { product: p, trigger: selectedTrigger }, productName(p) + ' logged', true);
    }
    else if (a === 'step') await action('step', { day: C.dayKey(new Date()), value: !state.steps[C.dayKey(new Date())] }, 'Step updated');
    else if (a === 'delete') openModal('delete', { id: button.dataset.id });
    else if (a === 'delete-confirm') await action('remove', { logId: button.dataset.id }, 'Entry removed', true);
    else if (a === 'review-day') { page = 'history'; historyDay = C.dayKey(new Date()); render(); }
    else if (a === 'confirm-day') {
      if (state.confirmed[historyDay]) await action('confirm', { day: historyDay, value: false }, 'Day reopened');
      else openModal('confirm', { day: historyDay });
    }
    else if (a === 'confirm-save') await action('confirm', { day: button.dataset.day, value: true }, 'Day confirmed', true);
    else if (a === 'choose-product') { selectedProducts = selectedProducts.includes(p) ? selectedProducts.filter(x => x !== p) : [...selectedProducts, p]; $('product-choices').innerHTML = productChoices(selectedProducts); }
    else if (a === 'begin') await action('settings', { products: selectedProducts, onboarded: true }, 'Your day starts here', true);
    else if (a === 'export') await special('export');
    else if (a === 'import') openModal('import');
    else if (a === 'widget-preview') await special('widgetPreview');
  });
  document.addEventListener('submit', async e => {
    e.preventDefault(); if (pending) return;
    try {
      if (e.target.id === 'plan-form') {
        const goals = Object.fromEntries(C.PRODUCTS.map(p => [p, $('goal-' + p).value === '' ? null : Number($('goal-' + p).value)]));
        await action('settings', { products: selectedProducts, goals, step: $('plan-step').value }, 'Plan saved');
      } else if (e.target.id === 'add-form') await action('log', { product: $('entry-product').value, occurredAt: new Date($('entry-date').value).toISOString(), trigger: $('entry-trigger').value || null }, 'Entry saved', true);
      else if (e.target.id === 'import-form') await special('import', { text: $('backup-text').value }, 'Backup merged');
    } catch (err) { showError(err); }
  });
  document.addEventListener('change', e => { if (e.target.id === 'history-day' && e.target.value && e.target.value <= C.dayKey(new Date())) { historyDay = e.target.value; render(); } });
  document.addEventListener('keydown', e => {
    if (!modal) return;
    if (e.key === 'Escape' && modal.type !== 'welcome') { e.preventDefault(); closeModal(); }
    if (e.key === 'Tab') {
      const nodes = [...$('modal-root').querySelectorAll('button:not([disabled]),input,select,textarea,a[href]')];
      if (nodes.length && ((e.shiftKey && document.activeElement === nodes[0]) || (!e.shiftKey && document.activeElement === nodes[nodes.length - 1]))) { e.preventDefault(); nodes[e.shiftKey ? nodes.length - 1 : 0].focus(); }
    }
  });
  window.addEventListener('storage', () => { if (!native && !modal) { try { ops = browserRead(); state = C.reduce(ops); render(); } catch (e) { showError(e); } } });
  let currentDay = C.dayKey(new Date());
  setInterval(() => { const nextDay = C.dayKey(new Date()); if (nextDay !== currentDay) { currentDay = nextDay; if (!modal && page === 'today') render(); } tick(); }, 1000);
  try {
    ops = native ? boot.operations : browserRead(); state = C.reduce(ops); selectedProducts = [...state.settings.products];
    if (!state.settings.onboarded) modal = { type: 'welcome' };
    else if (boot.route === 'craving') modal = { type: 'craving' };
    render(); if (boot.toast) toast(boot.toast);
  } catch (e) {
    $('app').innerHTML = `<div class="top"><h1>Your data needs attention</h1></div><div class="error-banner" role="alert">${escape(e.message)}</div><p>Existing data has been kept. Restore a valid backup or ask for help before clearing storage.</p>`;
    $('nav').hidden = true;
  }
})();
