# screenshot.local

> Paste a screenshot, annotate it, copy it back. Zero uploads — everything happens in your browser tab.

Every time you grab a screenshot to send a colleague, three things happen:
you take the screenshot, you open an annotation tool (which uploads to someone's
cloud), you wait. `screenshot.local` collapses that into one keystroke. Paste
with `Ctrl+V`, draw an arrow, hit copy, paste into Slack. The image never leaves
the device — you can verify it in DevTools' Network tab.

[![Status](https://img.shields.io/badge/status-alpha-yellow)](#)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-10%20passing-brightgreen)](#)

## Demo

> _Screenshots / GIF go here. Until then:_

1. Take a screenshot (Win+Shift+S, Cmd+Shift+4, whatever your OS does).
2. Open the page, press `Ctrl+V` anywhere — the image appears in the editor.
3. Pick the **Arrow** tool, drag from the bug to your annotation note.
4. Pick **Blur**, drag over the API key your screenshot exposed.
5. Press **Copy** → paste straight into your chat client.

## Features

- Paste-anywhere via the global `paste` event (`Ctrl+V` works without focusing an input)
- Tools: arrow, rectangle, text label, blur — all canvas-rendered, no DOM hacks
- Undo / redo with full history (immutable op log)
- Copy back to clipboard as `image/png`, or download as PNG
- IndexedDB autosave: reload-recovery for the in-progress draft (older than 7 days are purged)
- Zero network calls — provable from DevTools, no analytics, no fonts, no CDN
- Works offline once loaded; deployable as plain static files
- No accounts, no signup, no settings to configure

## Quickstart

```bash
git clone https://github.com/freyesperales/screenshot-local
cd screenshot-local
npm install
npm run dev    # opens at http://localhost:3000
```

Open `http://localhost:3000`, paste any image (`Ctrl+V` from your clipboard
buffer), and you're in the editor. The toolbar at the top picks the active tool;
drag on the canvas to draw. Undo with `Ctrl+Z`, redo with `Ctrl+Shift+Z`. When
you're happy, click **Copy** (or **Download** if you're on a browser where the
clipboard API is restricted).

## How it works

The whole editor is a single `<canvas>` plus an immutable op log
([`src/lib/ops.ts`](src/lib/ops.ts)). Drawing an arrow doesn't mutate the
canvas state directly — it appends an `Op` to the history, and the canvas is
re-rendered from scratch by replaying every op on top of the base image. That's
what makes undo/redo trivial (`history.ops.slice(0, -1)`) and what guarantees
the saved draft can be reconstructed exactly on reload.

Blur is its own beast ([`src/lib/blur.ts`](src/lib/blur.ts)). It runs a
box-blur over the selected region in pure JS over `ImageData` — small enough
that we don't need WebGL, fast enough to feel instant on a 4K screenshot, and
it works in browsers that don't expose CSS `filter: blur()` to canvas correctly.

Persistence ([`src/lib/persistence.ts`](src/lib/persistence.ts)) writes the
current op log and base image to IndexedDB every few seconds. Drafts older
than 7 days get garbage-collected on app start — so reload recovery works
without growing your browser's storage forever.

Clipboard interop ([`src/lib/clipboard.ts`](src/lib/clipboard.ts)) tries the
modern `navigator.clipboard.write(...)` API first; on browsers that refuse
image writes (Firefox most notoriously), it falls back to a triggered download
of the PNG.

## Deploy

### Cloudflare Pages / Netlify / GitHub Pages / S3

The project is configured with `output: "export"` — `npm run build` writes a
self-contained static site to `out/`. Drop it anywhere.

```bash
npm run build
npx wrangler pages deploy out --project-name=screenshot-local
# or
netlify deploy --dir=out --prod
```

### Self-host

Any static file server. With Caddy:

```caddy
screenshot.example.com {
  root * /var/www/screenshot-local/out
  file_server
}
```

### Vercel

Works, but overkill — you're not using any server features. Prefer a static host.

## Configuration

None. No environment variables, no API keys, no settings file. That's the
selling point.

## Development

```bash
npm run dev          # dev server with hot reload
npm run build        # static export to out/
npm test             # vitest, 10 tests
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
```

### Project layout

```
src/
├── app/
│   ├── edit/page.tsx   the editor page
│   ├── page.tsx        landing / paste zone
│   └── layout.tsx
├── components/
│   ├── Canvas.tsx      canvas + pointer handlers + tool dispatch
│   ├── Toolbar.tsx     tool picker + colour + thickness
│   ├── PasteZone.tsx   global paste event listener
│   └── PrivacyBadge.tsx
└── lib/
    ├── ops.ts          op log, undo/redo, canvas replay
    ├── blur.ts         box-blur over ImageData
    ├── clipboard.ts    read/write image clipboard with fallbacks
    ├── persistence.ts  IndexedDB autosave + 7-day garbage collection
    └── types.ts        Op, HistoryState, Point
tests/                  vitest unit tests
```

`lib/` is plain TypeScript with no React imports — every op transformation can
be tested in isolation, which is exactly how the 10 tests work.

## Browser support

| Browser              | Paste | Copy as image | Blur | Notes                                   |
| -------------------- | :---: | :-----------: | :--: | --------------------------------------- |
| Chrome / Edge        | ✓     | ✓             | ✓    | First-class                             |
| Firefox              | ✓     | fallback      | ✓    | Image clipboard write falls back to DL  |
| Safari (desktop)     | ✓     | ✓             | ✓    | Recent versions                         |
| Safari (iOS)         | ✓     | ✓             | ✓    | Paste from screenshot sheet works       |

## Roadmap

- [ ] v0.2: number / step labels (1, 2, 3, …) tool
- [ ] v0.2: pixelate as an alternative to blur
- [ ] v0.2: keyboard shortcut hint overlay
- [ ] v0.3: light theme (currently dark-only)
- [ ] would-be-nice: a "share via local network" mode using WebRTC
- [ ] would-be-nice: SVG export so you can post-process in Figma

## Contributing

PRs welcome. Quick checklist:

1. Open an issue first if it's a feature so we can align on scope.
2. Run `npm test` and `npm run typecheck` — both green before pushing.
3. New tool? Add an `Op` variant in `lib/types.ts`, an `applyOp` case in `lib/ops.ts`, and a test before wiring UI.
4. No `any`. Keep functions small. Comments explain *why*, not what.

## License

[MIT](./LICENSE) © Francisco Reyes
