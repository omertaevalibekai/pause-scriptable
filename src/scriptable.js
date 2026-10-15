/* Scriptable host. The build embeds the shared core and dashboard below. */
/*__CORE__*/
const DASHBOARD_HTML = /*__HTML__*/;

const store = (() => {
  const fm = FileManager.local();
  const directory = fm.joinPath(fm.documentsDirectory(), 'PauseData-v1');
  const journal = fm.joinPath(directory, 'journal');
  if (!fm.fileExists(journal)) fm.createDirectory(journal, true);
  const read = () => fm.listContents(journal).filter(n => n.endsWith('.json')).map(name => {
    try { return PauseCore.validate(JSON.parse(fm.readString(fm.joinPath(journal, name)))); }
    catch (error) { throw new Error('Cannot read ' + name + '. Existing data was kept. Restore a backup or ask for help. ' + error.message); }
  });
  const write = op => {
    PauseCore.validate(op);
    const final = fm.joinPath(journal, op.id + '.json');
    if (fm.fileExists(final)) {
      if (fm.readString(final) !== JSON.stringify(op)) throw new Error('A data record already exists with this ID.');
      return;
    }
    // Publish only a complete record. Readers ignore temporary files.
    // Separate immutable files prevent app/widget read-modify-write data loss.
    const temporary = fm.joinPath(journal, op.id + '-' + UUID.string() + '.tmp');
    fm.writeString(temporary, JSON.stringify(op));
    fm.move(temporary, final);
  };
  return {
    read,
    command(kind, payload) { const op = PauseCore.command(read(), kind, payload); write(op); return read(); },
    merge(text) { const additions = PauseCore.parseBackup(text, read()); additions.forEach(write); return read(); },
    async export() {
      const path = fm.joinPath(fm.temporaryDirectory(), 'Pause-backup-' + PauseCore.dayKey(new Date()) + '.json');
      fm.writeString(path, PauseCore.backup(read()));
      await ShareSheet.present([path]);
    }
  };
})();

function runURL(action = 'open', extra = {}) {
  return URLScheme.forRunningScript() + '&action=' + encodeURIComponent(action) + Object.entries(extra).map(([k, v]) => '&' + encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('');
}
function text(stack, value, size = 12, color = '25252B', bold = false) {
  const item = stack.addText(String(value));
  item.font = bold ? Font.semiboldSystemFont(size) : Font.systemFont(size);
  item.textColor = new Color(color); item.lineLimit = 1; item.minimumScaleFactor = 0.75;
  return item;
}
const NIGHT = { background: '191A1C', button: '2C2D30', primary: 'F5F5F7', secondary: 'AEAEB5' };
function centeredText(parent, value, size, color = NIGHT.primary, bold = false) {
  const row = parent.addStack(); row.addSpacer();
  const item = text(row, value, size, color, bold); row.addSpacer();
  return item;
}
function widgetButton(parent, title, count, url) {
  const stack = parent.addStack(); stack.url = url; stack.backgroundColor = new Color(NIGHT.button);
  stack.layoutVertically(); stack.cornerRadius = 12; stack.setPadding(7, 10, 7, 10);
  centeredText(stack, title, 14, NIGHT.primary, true);
  stack.addSpacer(2); centeredText(stack, count + ' today', 11, NIGHT.secondary);
  return stack;
}
function makeWidget(operations, family = 'medium', parameter = '') {
  const state = PauseCore.reduce(operations), summary = PauseCore.summary(state), now = new Date();
  const widget = new ListWidget(); widget.backgroundColor = new Color(NIGHT.background); widget.setPadding(12, 14, 10, 14);
  widget.url = runURL();
  // This is a requested earliest refresh, not a promise of an immediate update.
  widget.refreshAfterDate = new Date(Date.now() + 5 * 60000);
  if (parameter === 'pause') {
    widget.url = runURL('craving');
    widget.addSpacer();
    const symbol = widget.addImage(SFSymbol.named('pause.circle.fill').image);
    symbol.imageSize = new Size(42, 42); symbol.tintColor = new Color(NIGHT.primary);
    widget.addSpacer(9); text(widget, state.activePause ? 'Return to your pause' : 'Feeling the urge?', 15, NIGHT.primary, true);
    widget.addSpacer(5); text(widget, 'Make a little space.', 11, NIGHT.secondary); widget.addSpacer();
    return widget;
  }
  const heading = widget.addStack(); text(heading, 'Pause', 14, NIGHT.primary, true); heading.addSpacer();
  // The total includes both products even when one logging button is hidden.
  text(heading, (summary.today.stick + summary.today.cigarette) + ' today', 11, NIGHT.secondary);
  widget.addSpacer();
  if (summary.last) {
    // Native relative text can advance between widget refreshes; do not bake a stale "42m" into the image.
    const last = widget.addStack(); last.addSpacer();
    const date = last.addDate(new Date(summary.last.occurredAt)); date.applyRelativeStyle();
    date.font = Font.semiboldSystemFont(family === 'large' ? 46 : 32); date.textColor = new Color(NIGHT.primary);
    date.lineLimit = 1; date.minimumScaleFactor = 0.65; last.addSpacer();
    centeredText(widget, 'since last entry', 11, NIGHT.secondary);
  } else {
    centeredText(widget, 'No entries yet', 19, NIGHT.primary, true);
    centeredText(widget, 'Your day starts here', 11, NIGHT.secondary);
  }
  widget.addSpacer();
  if (family === 'small') {
    text(widget, 'Tap to open your day', 10, NIGHT.secondary); widget.addSpacer(4);
  } else {
    const buttons = widget.addStack();
    state.settings.products.forEach((p, i) => {
      if (i) buttons.addSpacer(8);
      widgetButton(buttons, p === 'stick' ? '+ Stick' : '+ Cigarette', summary.today[p], runURL('log', { product: p }));
    });
    if (family === 'large') {
      widget.addSpacer(10);
      const footer = widget.addStack();
      const urge = footer.addStack(); urge.url = runURL('craving'); text(urge, 'Pause the urge', 11, NIGHT.secondary);
      footer.addSpacer();
      if (state.undoId) { const undo = footer.addStack(); undo.url = runURL('undo', { logId: state.undoId }); text(undo, 'Undo', 11, NIGHT.secondary); }
      widget.addSpacer(22); const step = PauseCore.STEPS[state.settings.step];
      text(widget, 'My small step', 12, NIGHT.secondary); widget.addSpacer(8); text(widget, step.title, 17, NIGHT.primary, true);
      widget.addSpacer(8); const detail = text(widget, step.detail, 13, NIGHT.secondary); detail.lineLimit = 3;
      widget.addSpacer(); text(widget, 'Recorded use, not nicotine dose.', 10, NIGHT.secondary);
    }
  }
  widget.addSpacer(3); text(widget, now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · Updated ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), 8, NIGHT.secondary);
  return widget;
}

function safeJSON(value) { return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); }
async function dashboard(operations, route = 'today', message = '') {
  const web = new WebView();
  const bootstrap = 'window.__PAUSE_BOOT__=' + safeJSON({ mode: 'native', operations, route, toast: message }) + ';';
  await web.loadHTML(DASHBOARD_HTML.replace('/*__BOOT__*/', bootstrap));
  let closed = false;
  async function pump() {
    while (!closed) {
      let request;
      try {
        request = await web.evaluateJavaScript(`(() => {
          if (window.__nativeQueue.length) completion(window.__nativeQueue.shift());
          else window.__nativeWaiter = completion;
        })()`, true);
      } catch (e) { if (!closed) console.error('Dashboard bridge closed: ' + e); return; }
      if (!request || request.type === 'close') return;
      let response;
      try {
        const p = request.payload || {};
        switch (request.type) {
          case 'command': store.command(p.kind, p.payload); break;
          case 'export': await store.export(); break;
          case 'import': store.merge(p.text); break;
          case 'widgetPreview': await makeWidget(store.read()).presentMedium(); break;
          case 'refresh': break;
          default: throw new Error('Unknown action.');
        }
        response = { operations: store.read() };
        Script.setWidget(makeWidget(response.operations));
      } catch (e) { response = { error: e.message || String(e) }; }
      try { await web.evaluateJavaScript('window.__pauseReply(' + safeJSON(request.id) + ',' + safeJSON(response) + ')', false); }
      catch (e) { if (!closed) console.error(e); return; }
    }
  }
  const pumping = pump();
  try { await web.present(); }
  finally {
    closed = true;
    // Release a pending callback when the user dismisses the sheet.
    try { await web.evaluateJavaScript("if(window.__nativeWaiter){window.__nativeWaiter({type:'close'});window.__nativeWaiter=null}", false); } catch (_) { /* Dismissed views can reject evaluation. */ }
  }
  // Do not await a suspended WKWebView callback after dismissal.
  void pumping;
}

async function main() {
  let operations = store.read();
  if (config.runsInWidget) {
    Script.setWidget(makeWidget(operations, config.widgetFamily || 'medium', args.widgetParameter || ''));
    return;
  }
  const query = args.queryParameters || {};
  let message = '';
  if (query.action === 'log') {
    operations = store.command('log', { product: query.product });
    message = query.product === 'stick' ? 'Stick logged' : 'Cigarette logged';
  } else if (query.action === 'undo' && query.logId) {
    // An old widget must never delete a newer entry by accident.
    if (PauseCore.reduce(operations).logs.some(l => l.id === query.logId)) {
      operations = store.command('remove', { logId: query.logId }); message = 'Entry removed';
    } else message = 'This entry was already removed';
  }
  Script.setWidget(makeWidget(operations));
  await dashboard(operations, query.action === 'craving' ? 'craving' : 'today', message);
}
try { await main(); }
catch (error) {
  if (config.runsInWidget) {
    const widget = new ListWidget(); widget.backgroundColor = new Color(NIGHT.background);
    text(widget, 'Pause needs attention', 14, NIGHT.primary, true); widget.addSpacer(8);
    const detail = text(widget, 'Open Pause to check your saved data.', 12, NIGHT.secondary); detail.lineLimit = 3;
    widget.url = runURL(); Script.setWidget(widget);
  } else {
    const alert = new Alert(); alert.title = 'Unable to open Pause';
    alert.message = error.message + '\n\nExisting records have not been reset.'; alert.addAction('OK'); await alert.presentAlert();
  }
}
Script.complete();
