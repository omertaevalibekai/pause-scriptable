# Verification

## Executed on Windows

- `node scripts/build.mjs` — successful. Generated single-file Scriptable app and two standalone HTML pages.
- `node --check src/core.js` and `node --check src/app.js` — successful.
- **32 tests passed** for **0.1.0-alpha.5 / English widget labels and numeric timer**: 14 domain tests, 11 Scriptable-host tests, and 7 updater tests. The dashboard test checks the final widget contains saved entries and has no future minimum refresh date. These checks do not measure iOS refresh latency.
- Scriptable's complete generated script parsed and executed inside a Node VM host double.

Domain coverage: separate counts; backdated records; targeted undo; unknown vs confirmed days; editing reopens days; confirmed-day averages; product settings; future-date rejection; saved pause countdown; exactly-once pause outcome with a smoking record; backup merge, conflict and duplicate handling; concurrent writer merge; local midnight and year boundaries; causal ordering with identical timestamps and a device clock moving backwards.

Host-double coverage: medium/small/large widgets; dedicated craving widget; URL actions; persistence across invocations; stale undo; no mutation on widget reads; interrupted temporary files; malformed queries and corrupt journal preservation; sequential dashboard bridge actions and visible validation error responses. Night-specific checks cover counts attached to the correct logging actions, the native numeric timer bound to the latest entry, and single-product settings retaining the total recorded use.

Updater coverage includes offline first launch, cached operation, HTTP errors, truncated and invalid JavaScript, version ordering, network-free logging/undo, journal preservation, and no retry after execution errors. The generated launcher is also exercised with the real bundled widget against the Scriptable host double.

## Not verified here

- A browser visual / interaction pass: local network access remained blocked by this execution environment even after requesting access. A standalone Preview.html is supplied for inspection outside that environment.
- Actual Scriptable execution on iPhone, WebView bridge lifecycle and share-sheet behavior.
- Actual iOS widget layout, tappable regions, refresh timing and installation flow on the user's iOS version.

These limitations are not represented as passing checks. Use the short iPhone acceptance checklist in START-HERE.md before relying on the tracker.
