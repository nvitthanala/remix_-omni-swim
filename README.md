# OMNI-SWIM · Matrix Suite

<div align="center">

<img src="public/OMNISWIMLOGO.png" alt="OMNI-SWIM logo" width="220" />

**Meet analytics for competitive swimming**

Parse Hy-Tek-style PDFs, score meets with configurable rules, track team standings, and simulate recruit impact—without losing your workspace data between sessions.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

</div>

---

## At a glance

| Capability | Description |
|------------|-------------|
| **PDF ingestion** | Upload meet results; the server runs `backend/pdf_parser.py` and returns structured swimmers and relays. |
| **Configurable scoring** | NCAA-style tables, relay multipliers, and caps—edited in-app, persisted per workspace, applied on the next parse. |
| **Workspaces** | Multiple saved contexts in `data/meets.json` (auto-migrated from a legacy root file on first run). |
| **Export** | Download computed matrices as CSV from the app sidebar. |

---

## Table of contents

1. [Tech stack](#tech-stack)  
2. [Repository layout](#repository-layout)  
3. [Getting started](#getting-started)  
4. [Development](#development)  
5. [Documentation](#documentation)  
6. [Troubleshooting](#troubleshooting)  
7. [License](#license)

---

## Tech stack

### Application

| Layer | Technologies |
|-------|----------------|
| **UI** | [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite 6](https://vitejs.dev/) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/), [Motion](https://motion.dev/), [Lucide React](https://lucide.dev/) |
| **Charts** | [Recharts 3](https://recharts.org/) |
| **Server** | [Express](https://expressjs.com/), TypeScript (`server.ts`) |
| **PDF & scoring** | Python 3, [pdfplumber](https://github.com/jsvine/pdfplumber) (`backend/pdf_parser.py`, `backend/point_calculator.py`) |

### Supporting libraries

UUID, Lodash, Dotenv, JIMP, pdf-parse, Autoprefixer—see [`package.json`](package.json) and [`requirements.txt`](requirements.txt) for authoritative versions.

### Tooling & AI-assisted development

| Tool | Role |
|-------|------|
| **[Cursor](https://cursor.com/)** | Primary IDE: AI chat, **Agent** mode for multi-file edits, **Composer** for larger refactors, and integrated terminal / Git workflow. |
| **VS Code** | Compatible editing experience (Cursor is built on the VS Code stack). |
| **GitHub Copilot** | Inline completion where enabled. |

**Other models & assistants used on this project** (from team workflows—not hard-wired into the app): Claude Haiku 4.5, Gemini Pro 3.1 Preview (Google AI Studio), Gemma variants, DeepSeek V4, plus CLI-oriented helpers such as **cline** and **roocode** where applicable.

**About models in Cursor sessions:** When you use Cursor Chat or Agent, the **underlying model is selected by your Cursor account, plan, and model picker** (e.g. Composer or other frontier models). It can differ per session, so this README documents the **tooling** rather than pinning a single model name to the repository.

---

## Repository layout

| Path | Purpose |
|------|---------|
| `src/` | React application (components, hooks, types). |
| `public/` | Static assets (e.g. `OMNISWIMLOGO.png`). |
| `server.ts` | Express API, Vite middleware in dev, static `dist` in production. |
| `backend/` | Runtime Python: `pdf_parser.py`, `point_calculator.py`. |
| `data/` | Local persistence: `meets.json`, `scoring_settings.json` (written during parse). |
| `scripts/` | Node utilities (`scan_deps.mjs`, asset helpers, `smoke_parse_pdf.mjs`, etc.). |
| `tests/` | Parser/scoring harnesses and reference outputs. |
| `docs/` | [`CHANGELOG.md`](docs/CHANGELOG.md), [`CODEBASE_DOCS.md`](docs/CODEBASE_DOCS.md), and related notes. |
| `tools/python/` | Optional analysis, comparison, and debug scripts. |
| `utils/` | Shared Python helpers consumed by tooling. |
| `archive/` | Historical snapshots (e.g. checkpoints). |

---

## Getting started

The repo ships with a **dependency scanner** so first-time setup stays predictable.

### Quick start

1. **Windows:** double-click `start.bat`, or from a terminal in the repo root run `npm run dev`.  
2. **macOS / Linux:** `./start.sh`, or `npm run dev`.

### What happens automatically

- Scans TypeScript and Python sources for imports and syncs **npm** + **`requirements.txt`** into your **`venv`**.  
- Ensures **pdfplumber** is available inside the venv.  
- Starts the **Express** server and **Vite** dev middleware.  
- On Windows, `start.bat` can open **`http://localhost:3000`** after a short delay.

You can also run `npm run dev` directly; `predev` still runs `node scripts/scan_deps.mjs` so dependencies stay aligned.

---

## Development

```bash
# Install dependencies (first time or after package changes)
npm install

# Dev server (Express + Vite)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Typecheck only
npm run lint
```

### Smoke test (parse pipeline)

With the dev server running:

```bash
npm run smoke:parse
# optional: specify another sample PDF at repo root
npm run smoke:parse -- 2026_acc_championship_full_meet_results_1col.pdf
```

This posts a sample PDF to `/api/parse-pdf` and prints a short summary (see [`scripts/smoke_parse_pdf.mjs`](scripts/smoke_parse_pdf.mjs)).

---

## Documentation

| Document | Contents |
|----------|----------|
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Release-style notes and notable refactors. |
| [`docs/CODEBASE_DOCS.md`](docs/CODEBASE_DOCS.md) | Parser behavior, scoring engine, server integration, and where to change logic. |

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| **Node not found** | Install [Node.js](https://nodejs.org/) (LTS recommended) and ensure it is on your `PATH`. |
| **Python not found** | Install [Python 3](https://www.python.org/downloads/) and ensure `python` / `python3` is on your `PATH`. |
| **Port 3000 in use** | Stop the other process or adjust the listener in `server.ts` for local experiments. |
| **Parse errors on a specific PDF** | See `docs/CODEBASE_DOCS.md` and `tools/python/` comparison scripts; PDF layout varies by meet. |

---

## License

Apache-2.0
