# OMNI-SWIM: Matrix Suite

<div align="center">
  <img src="public/OMNISWIMLOGO.png" alt="OMNI-SWIM Logo - Swimming Analytics" width="200" />
</div>

Professional analytics for competitive swimming. Parse results, track team standings, and simulate recruit impacts.

---

## Tools & Tech Stack

### Frontend
- **React 19** – UI framework
- **TypeScript** – Type-safe development
- **Vite 6** – Lightning-fast bundler and dev server
- **Tailwind CSS 4** – Utility-first styling
- **Recharts 3** – Data visualization and charting
- **Motion** – Smooth animations and transitions
- **Lucide React** – Icon library

### Backend
- **Express.js** – HTTP server and REST API
- **Node.js** – JavaScript runtime
- **TypeScript** – Type-safe backend code
- **Python 3** – PDF parsing logic
- **pdfplumber** – PDF text extraction and analysis

### Development & AI Assistance
- **GitHub Copilot** – Code generation and completion
- **Claude Haiku 4.5** – AI-powered coding assistance and problem-solving
- **Gemini Pro 3.1 Preview** (via Google AI Studio) – Research and architectural guidance
- **Gemma 9B e4b** – Experimental code assistance and rapid prototyping
- **Gemma 4-26b-a4b** – Advanced synthesis and design guidance
- **DeepSeek V4** – Problem-solving and debugging
- **cline** – Command Line Interface utility for streamlined development tasks
- **roocode** – Specialized tool for generating and optimizing code snippets
- **VS Code** – IDE with TypeScript and Python support

### Utilities & Libraries
- **UUID** – Unique ID generation
- **Lodash** – Utility functions
- **Dotenv** – Environment variable management
- **JIMP** – Image processing
- **pdf-parse** – PDF parsing utilities
- **Autoprefixer** – CSS vendor prefixes

---

## One-Click Setup and Start

Starting the application requires zero manual configuration. The project features a dynamic dependency scanner that automatically installs everything you need on the first run.

1. **Start the app:**
   - Windows: Double-click `start.bat` (or run in terminal)
   - macOS/Linux: Run `./start.sh` in your terminal
   
2. **What the script does automatically:**
   - Scans the entire codebase for required Node and Python dependencies.
   - Installs Node dependencies (`npm install`) and syncs `package.json`.
   - Creates a Python virtual environment (`venv`).
   - Syncs Python dependencies via `pip install -r requirements.txt`.
   - Starts the application backend and frontend.
   - Opens your default web browser to `http://localhost:3000`.

*Note: You can also use `npm run dev` or `npm start` directly; the dependency scanner will still run as a prestart script to ensure your environment is fully configured.*

See the consolidated docs for details on scoring, parsing, and changelogs:

- `CHANGELOG.md` — recent repository edits and notes.
- `CODEBASE_DOCS.md` — consolidated documentation of parser and scoring logic, frontend hooks, and run instructions.

---

## Troubleshooting

- **Node.js Missing**: The startup scripts check for Node.js. If missing, install from https://nodejs.org/
- **Python Missing**: The startup scripts check for Python. If missing, install from https://www.python.org/downloads/ and add it to your PATH.

---

## Features

- **PDF Ingestion**: Upload Hy-Tek meet results to populate the matrix
- **Recruit Simulation**: Inject new swimmers to see how they impact team scores
- **Auto-Save**: All data is saved to `meets.json` for easy sharing
- **Safe Export**: Download your results as CSV at any time from the sidebar

---

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Type checking
npm run lint
```

---

## Project Structure

- `src/` – React frontend components and logic
- `public/` – Static assets (logo, images)
- `server.ts` – Express backend and API routes
- `pdf_parser.py` – PDF text extraction and parsing
- `point_calculator.py` – Meet scoring engine
- `meets.json` – Data storage file

---

## License

Apache-2.0
