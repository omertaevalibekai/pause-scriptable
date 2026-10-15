# Automated tests

- `core.test.cjs`: domain behavior, date boundaries, backups, and causal ordering.
- `scriptable.test.cjs`: the generated script running against a simulated Scriptable host.
- `autoupdate.test.cjs`: update downloads, offline fallback, version ordering and journal preservation.

Run `npm test` from the repository root. These tests do not replace checking installation, rendering, WebView interactions, or widget refresh on a real iPhone. Use fictional entries in tests and bug reports.
