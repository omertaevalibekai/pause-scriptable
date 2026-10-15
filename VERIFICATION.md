# Verification

## Executed on Windows

- `node scripts/build.mjs` — successful. Generated single-file Scriptable app and two standalone HTML pages.
- `node --check src/core.js` and `node --check src/app.js` — successful.
- The complete test set was exercised on Windows: **22 passing, 0 failing** (14 domain tests and 8 Scriptable-host tests).
- Scriptable's complete generated script parsed and executed inside a Node VM host double.

Domain coverage: separate counts; backdated records; targeted undo; unknown vs confirmed days; editing reopens days; confirmed-day averages; product settings; future-date rejection; saved pause countdown; exactly-once pause outcome with a smoking record; backup merge, conflict and duplicate handling; concurrent writer merge; local midnight and year boundaries; causal ordering with identical timestamps and a device clock moving backwards.

Host-double coverage: medium/small/large widgets; dedicated craving widget; URL actions; persistence across invocations; stale undo; no mutation on widget reads; interrupted temporary files; malformed queries and corrupt journal preservation; sequential dashboard bridge actions and visible validation error responses.

## Not verified here

- A browser visual / interaction pass: local network access remained blocked by this execution environment even after requesting access. A standalone Preview.html is supplied for inspection outside that environment.
- Actual Scriptable execution on iPhone, WebView bridge lifecycle and share-sheet behavior.
- Actual iOS widget layout, tappable regions, refresh timing and installation flow on the user's iOS version.

These limitations are not represented as passing checks. Use the short iPhone acceptance checklist in START-HERE.md before relying on the tracker.
