# Development scripts

- `build.mjs`: generates Pause.js, Preview.html and Install.html without dependencies. `--check` verifies committed output without rewriting files.
- `serve.mjs`: serves the browser preview on 127.0.0.1:4173. It is local to this computer and is not needed on iPhone.

Use Node 22 or newer. Run `npm run build` followed by `npm run check` from the repository root.
