# screenshot.local

Paste a screenshot, annotate with arrows/boxes/text/blur, copy back to clipboard or download.

**100% client-side. Nothing uploads anywhere.**

## Stack

- Next.js 16 App Router (static export)
- TypeScript strict
- Tailwind 4
- Canvas-based editor (no heavy libs)
- IndexedDB autosave

## Dev

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # static export -> out/
npm test             # vitest
npm run typecheck
```

## Privacy

There are no network calls. Open DevTools Network tab to verify. The only persistence is local: IndexedDB stores recent drafts for reload-recovery and auto-purges anything older than 7 days.

## Browser notes

- **Chrome / Edge**: full `navigator.clipboard.read()` + `write()` for image/png.
- **Firefox**: write of image/png to clipboard may be unavailable; the UI falls back to a download.
- Paste via `Ctrl+V` works everywhere via the global `paste` event.
