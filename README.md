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
- **VS Code** – IDE with TypeScript and Python support

### Utilities & Libraries
- **UUID** – Unique ID generation
- **Lodash** – Utility functions
- **Dotenv** – Environment variable management
- **JIMP** – Image processing
- **pdf-parse** – PDF parsing utilities
- **Autoprefixer** – CSS vendor prefixes

---

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   pip install pdfplumber
   ```

2. **Start the app:**
   - Windows: `start.bat`
   - macOS/Linux: `start.sh`
   - Or run: `npm run dev`

3. **Open in browser:**
   - Navigate to `http://localhost:3000`

See the consolidated docs for details on scoring, parsing, and changelogs:

- `CHANGELOG.md` — recent repository edits and notes.
- `CODEBASE_DOCS.md` — consolidated documentation of parser and scoring logic, frontend hooks, and run instructions.

---

## Troubleshooting

- **Node.js Missing**: Install from https://nodejs.org/
- **Python Missing**: Install from https://www.python.org/downloads/ and add to PATH
- **Python Dependency**: `start.bat` installs `pdfplumber` automatically if needed

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
