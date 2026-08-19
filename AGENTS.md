# Agent notes

- Keep runtime fully client-side.
- Do not add runtime CDN dependencies.
- `src/index.template.html` intentionally contains embedded ORT/YuNet payloads.
- MP4Box.js is pinned in `dependencies.json` and embedded at build time.
- Preserve manual masks and the warning that automatic detection is fallible.
