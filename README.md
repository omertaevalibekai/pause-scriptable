# Pause — alpha

**Version 0.1.0-alpha.3 · Experimental — iPhone testing pending.**

The Home Screen widget now uses the A3 / Night design: a matte dark surface, prominent time since the last entry, and two charcoal logging buttons with per-product counts. The medium widget keeps Undo and craving support in the dashboard; the large widget also has direct shortcuts. Relative time uses iOS date rendering and may follow the device locale. Counts and the dated Updated footer reflect the last widget refresh.

To enable automatic updates, replace the full code of your existing **Pause** script with [Pause-Auto.js](Pause-Auto.js), keep its name **Pause**, and run it once. Existing installations cannot update themselves until this one-time replacement. The journal is stored separately and is preserved. The browser preview shows the dashboard, not the native widget.

## Automatic updates

`Pause-Auto.js` includes a complete offline fallback and downloads newer alpha versions of `Pause.js` from this repository over HTTPS. It checks on ordinary foreground opens and at most once every six hours during widget runs. Logging and undo skip network checks. A failed or malformed download keeps the available version; complete code caches are stored in `PauseUpdates-v1`, separately from your journal. Downloaded code is compiled before use and invoked once, without retrying actions after runtime errors. Automated checks do not guarantee that a future release is bug-free.

This opts into running future code published to this repository. GitHub receives ordinary download requests (including your IP address), but the updater never attaches entries or backups. iOS controls widget refresh timing, so a GitHub push is not an instant remote refresh. Use the standalone `Pause.js` instead to disable automatic updates and keep all tracker operations offline. Updates to the launcher itself may require another manual replacement.

This is an early personal-use prototype. Automated tests cover the domain logic and a simulated Scriptable host. Real iPhone installation, WebView interactions, widget layout, and refresh behavior have not been verified yet. Please complete the device checklist in [START-HERE.md](START-HERE.md) before relying on it.

An offline, English-language tobacco tracker for **Scriptable on iPhone**, built for gradual reduction with cigarettes, IQOS sticks, or both. No account, backend, paid dependencies, or Apple developer membership.

Read [START-HERE.md](START-HERE.md) for Russian setup instructions. Download the project with **Code → Download ZIP**, extract it, and open **Install.html** for the English installation guide and copyable automatic-update launcher. Transfer **Pause-Auto.js** to Scriptable on your iPhone and name it **Pause**. Open **Preview.html** locally for an independent desktop preview; GitHub's file view does not run HTML pages.

## Included

- Real Scriptable Home Screen widget (medium / large: separate logging links; small: dashboard shortcut).
- Separate cigarette and stick counts, timestamped entries, backdated entries, targeted undo / deletion.
- Seven-day chart, selectable daily history, explicit complete-day confirmation. Unknown days stay unknown.
- Product selection, optional user-chosen daily goals, and a small behavior step for coffee, stress or work.
- Persistent three-minute craving pause, optional trigger, passed / smoked / cancelled outcomes.
- Local append-only event journal, JSON backup export and merge restore.
- Dependency-free browser preview, reproducible build, domain and Scriptable-host-double tests.

## Important behavior

Widget links **launch Scriptable** before recording. Home Screen refresh is scheduled by iOS and can lag. The dashboard reads the latest saved data on every mutation. Widget rendering never adds a smoking record. Old widget Undo links target the specific record shown when that widget was rendered.

The dashboard and widget share Scriptable's local journal. The browser preview has separate browser-local storage. The standalone tracker uses no network; the optional automatic-update launcher downloads code from GitHub. The optional Smokefree support link is external. Data is not encrypted separately from iOS / Scriptable's storage. Export a backup before uninstalling Scriptable.

The app supports tracking and behavior change, not medical treatment or nicotine-dose calculation. Goals are explicitly chosen by the user; no automatic reduction schedule is prescribed.

## Build / test

```sh
npm run build
npm run check
node scripts/serve.mjs
```

No install step or external libraries. Requires Node 22+ for development, not on iPhone. `private: true` prevents accidental npm publishing; the source is open under MIT.

GitHub Actions runs syntax checks, all tests, and a reproducible-build check on Ubuntu and Windows with Node 22 and 24. Actions are pinned to commit SHAs and use read-only repository permissions. CI does not test real iOS behavior.

`src/core.js` is the shared deterministic domain layer. `src/app.js` and `src/shell.html` form the dashboard. `src/scriptable.js` hosts it in Scriptable and renders the native widget. `src/autoupdate.js` is the launcher. `scripts/build.mjs` produces Pause.js, Pause-Auto.js, Preview.html and Install.html. For each published update, increment the alpha version in package.json, rebuild, run checks, and commit the generated files. The launcher only adopts strictly newer versions.

## Verification status

See **VERIFICATION.md**. Domain and mocked Scriptable checks run on Windows. iOS-specific presentation, real widget layout, refresh timing, and WebView bridging still require testing on an actual iPhone. This is a personal MVP, not an App Store binary.

## Contributing during alpha

Bug reports and small fixes are welcome. For iPhone issues, include your iOS version, Scriptable version, widget size, and steps to reproduce. Use fictional sample entries; do not attach your personal smoking history or backups. Run `npm run build` and `npm run check` before submitting a change.

## License

[MIT License](LICENSE) · Copyright (c) 2026 Alibek Omertaev.

Pause is an independent project and is not affiliated with Scriptable or IQOS.
