# Meeting Intelligence (Local-First Starter)

A local-first starter template for a “Meeting Intelligence” product.

- Frontend: Vite + React (`/client`)
- Backend: Node.js + Express (`/server`)
- Future AI scripts (Whisper, etc.): `/ai`

## Setup

From the repo root:

```bash
npm install
npm run dev
```

## Dev URLs / Ports

- Client: `http://localhost:5173`
- Server: `http://localhost:5000`

The client talks to the server via:

- `POST http://localhost:5000/api/upload`
- `GET  http://localhost:5000/api/meetings/:id`

## Notes

- Uploads are stored locally in `server/uploads`.
- Meeting data is currently stored in-memory (a `Map`) as a placeholder (no database yet).

## Coming Soon

- **Whisper** transcription scripts (Python) under `/ai`
- **Ollama**-powered summarization and structured outputs

## Extra note (what to tell Windsurf if it asks)

This project is a Vite + React client in `/client` and a Node/Express server in `/server`. Run everything from the repo root with `npm install` then `npm run dev`.
