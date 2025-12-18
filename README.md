# MeetIQ

**MeetIQ** is a local-first starter template for a **Meeting Intelligence** product. It provides a clean foundation for uploading meeting audio, managing meeting data, and preparing for AI-powered transcription and summarization.

The goal of this repo is to move fast locally, stay simple, and layer in AI capabilities incrementally.

---

## ✨ Features

* Local-first development (no cloud dependencies required)
* Modern React frontend with Vite
* Node.js + Express backend API
* Clean separation between client, server, and future AI scripts
* Ready for Whisper, Ollama, and other AI tooling

---

## 🧱 Tech Stack

### Frontend

* **Vite + React**
* Location: `/client`

### Backend

* **Node.js + Express**
* Location: `/server`

### Future AI Layer

* Python scripts (Whisper, summarization, embeddings, etc.)
* Location: `/ai`

---

## 📁 Project Structure

```
MeetIQ/
├── client/        # Vite + React frontend
├── server/        # Node.js + Express API
│   └── uploads/   # Local file uploads (gitignored)
├── ai/            # Future AI scripts (Whisper, LLMs, etc.)
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Getting Started

From the **repo root**:

```bash
npm install
npm run dev
```

This will start both the client and server in development mode.

---

## 🌐 Dev URLs / Ports

* **Client:** [http://localhost:5173](http://localhost:5173)
* **Server:** [http://localhost:5000](http://localhost:5000)

---

## 🔌 API Endpoints

The frontend communicates with the backend via:

```http
POST /api/upload
GET  /api/meetings/:id
```

Example:

```http
POST http://localhost:5000/api/upload
GET  http://localhost:5000/api/meetings/123
```

---

## 🗂 Data & Storage Notes

* Uploaded files are stored **locally** in:

  ```
  server/uploads/
  ```
* Meeting metadata is currently stored **in-memory** using a `Map` as a placeholder
* No database is connected yet (by design)

---

🧠 Roadmap (Coming Soon)

Whisper transcription scripts (Python) under /ai

Ollama-powered summarization

Structured outputs (action items, decisions, highlights)

Persistent storage (SQLite / Postgres)

Auth & multi-user support
___

🛠 Development Notes

This is a local-first project

No environment variables are required yet

node_modules, uploads, and OS files are ignored via .gitignore

-----
🧩 Extra Note (for Windsurf / AI tools)

This project is a Vite + React client in /client and a Node/Express server in /server. Run everything from the repo root using npm install then npm run dev
