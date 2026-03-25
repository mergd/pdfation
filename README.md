# PDF Coworker

Read-only PDF chat with Google Docs-style anchored comments and a right-side AI coworker panel.

## Stack

- `bun`
- `vite` + `react` + `typescript`
- `@tanstack/react-router` + `@tanstack/react-query`
- `pdfjs-dist`
- `express`
- `openai` SDK pointed at `OpenRouter`
- `IndexedDB` via `idb`

## Run

```bash
bun install
bun run dev
```

The web app runs on `5173` and the API runs on `8787`.

## Environment

Set a shared OpenRouter key for free-tier usage:

```bash
export OPENROUTER_API_KEY=your_key_here
```

Users can also add their own OpenRouter key in-app, which is stored locally in `IndexedDB`.

## Checks

```bash
bun run lint
bun run build
```
