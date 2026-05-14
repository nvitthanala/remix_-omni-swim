# Omni Swim Matrix - Documentation and Changelog

## 📋 Overview
Omni Swim Matrix is a comprehensive swimming recruitment and team performance matrix tool designed to seamlessly manage swim times, project future drop rates, and simulate meet scoring outcomes based on uploaded athlete meet results.

Built with React, Vite, and Tailwind CSS for styling alongside an Express/Python backend (invoking `pdf_parser.py` with `pdfplumber`), this application serves as a dashboard for swim coaches to visualize their team's trajectory and potential.

---

## 🛠️ Tools & Technologies

### Frontend Stack
| Tool | Version | Purpose |
|------|---------|---------|
| **React** | 19.0.1 | Component-based UI framework |
| **TypeScript** | ~5.8.2 | Type-safe JavaScript |
| **Vite** | 6.2.3 | Fast bundler and dev server |
| **Tailwind CSS** | 4.1.14 | Utility-first CSS framework |
| **Recharts** | 3.8.1 | React charting library for visualizations |
| **Motion** | 12.23.24 | Animation and transitions library |
| **Lucide React** | 0.546.0 | Icon library |
| **React DOM** | 19.0.1 | DOM rendering for React |

### Backend Stack
| Tool | Version | Purpose |
|------|---------|---------|
| **Express.js** | 4.21.2 | HTTP server and REST API |
| **Node.js** | 22.14.0+ | JavaScript runtime environment |
| **TypeScript** | ~5.8.2 | Type-safe backend code |
| **Python** | 3.x | PDF parsing and data processing |
| **pdfplumber** | Latest | PDF text extraction and analysis |

### Development & AI Assistance Tools
| Tool | Purpose |
|------|---------|
| **GitHub Copilot** | AI-powered code generation and completion in VS Code |
| **Gemini Pro 1.5 Preview** | Research, architectural decisions, and optimization guidance via Google AI Studio |
| **DeepSeek V4** | Complex problem-solving, debugging, and algorithmic assistance |
| **VS Code** | Primary IDE with TypeScript and Python support |

### Build & Development Tools
| Tool | Version | Purpose |
|------|---------|---------|
| **npm** | Latest | Package management and task runner |
| **tsx** | 4.21.0 | TypeScript execution for Node scripts |
| **Autoprefixer** | 10.4.21 | CSS vendor prefixes |
| **JIMP** | 1.6.1 | Image processing (background removal, logo generation) |

### Utilities & Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| **UUID** | 14.0.0 | Unique ID generation for workspaces/athletes |
| **Lodash** | 4.18.1 | Utility functions for data manipulation |
| **Dotenv** | 17.2.3 | Environment variable management |
| **pdf-parse** | 2.4.5 | PDF parsing utilities |

### Data Storage
| Format | Purpose |
|--------|---------|
| **JSON** | Persistent storage via `meets.json` for all workspace and result data |

---
## Recent Edits (2026-05-13)

- Improved team-name recognition in `pdf_parser.py` to reduce duplicate/garbled matches and prefer exact/prefix matches before fuzzy matching.
- Made scoring engine in `point_calculator.py` configurable; added NCAA D2 default scoring (Top 16) while respecting frontend `scoringSettings`.
- Implemented checkpoint copies of parser and calculator in `checkpoints/checkpoint_2026-05-13/`.

See `checkpoints/` for saved snapshots and `checklist` for remaining tasks.

## 🚀 Features

### 1. **PDF Parsing and Data Extraction**
*   **Meet Results Extraction:** Uses `python-pdfplumber` backend service to parse NCAA / standard formatted swim meet result PDFs.
*   **Swimmer Deduplication & Classification:** Groups extracted times by athlete and matches swimmer class years (`FR`, `SO`, `JR`, `SR`, `5Y`, etc.).
*   **Relay and Split Identification:** Identifies lead-off splits and relay team contributions.
*   **Dynamic Team Discovery:** Auto-discovers teams safely using headers ("Scores - Men", "Scores - Women"); now equipped with failsafe class-based regex to discover teams if absolute headers are missing.

### 2. **Scoring Engine**
*   **Custom Models:** Allows coaches to customize scoring matrices (e.g., standard 16-place scoring (20, 17, 16...) or dual meet scoring).
*   **Limits & Restrictions:** Settings for max individual scorers per team (e.g., up to 4 individual scorers) and relays per team (e.g., 1 relay per team) to mimic championship rules accurately.
*   **Real-time Matrix Calculation:** Fast, dynamic recalculations using React state whenever settings or rosters are altered.

### 3. **Points Projection and NCAA Cut Matching**
*   **Future Drop Rates Projector:** Calculates swimmer graduation years based on academic class (e.g., FR = 3 years remaining) and applies a formulaic time drop basis (overall percentage drops) to project future performance.
*   **NCAA Cut Line Tracker:** Compares current and projected times against pre-defined A and B cut standards.
*   **Future Target Highlighting:** Dynamically displays "Beats Future A-Cut (proj_26_27)" directly in the user interface if the projected curve hits the standard.

### 4. **Drill-down Dashboards & Analytics**
*   **"By Event" and "By Swimmer" Views:** A toggleable view to analyze team scores holistically by event, or granularly by the individual.
*   **Holistic Data Visualizations:** Integrated `recharts` to render real-time Bar charts showing "Total Points by Event" and "Total Points by Academic Class" (FR vs SO vs JR vs SR contribution).
*   **Neon & Brutalist Dark Mode UI:** High contrast dark-mode UI prioritizing readability for data-dense dashboards.

### 5. **Recruit Injection Engine**
*   **Scenario Modeler:** Add prospective recruits via a manual form. The system will inject them into the active matrix, simulate where they would place, and dynamically track new scoring potentials against rival teams.

---

## 🛠️ Recent Fixes & stability Improvements (Changelog)

### PDF Parsing Engine Refinement
*   **Fix:** "Individual swims logging as teams" – Fixed by introducing strict filters. The parser now ceases team-list scanning upon hitting keywords like `EVENT ` or `INDIVIDUAL `.
*   **Team Auto-Discovery Failsafe:** Added an auto-discovery fallback mechanism scanning lines for valid academic class abbreviations (`FR`, `SO`, `JR`...) and stripping times/names to infer team names dynamically if end-result explicit team lists are missing.

### User Interface Polish
*   **Dark Mode Contrast:** Fixed all instances of unreadable `text-black` or `text-gray-800` text elements in a dark background. Hardened the dark mode palette by replacing these with `text-white` or `text-gray-400`.
*   **Logo Visibility:** Removed the PNG logo bearing white/grey checkerboard artifacts, replacing it with a clean, dynamic, scaleable `logo.svg`. Updated both the Favicon and the In-App Header to utilize the SVG.
*   **Compressed Event Graphs:** Implemented `slice(0, 8)` to limit the Recharts "Top Events" graph exclusively to the Top 8 scoring events to prevent X-Axis label overflow and ensure high dashboard density.

### Data Aggregations
*   **Dual Graphs Integration:** Built alongside the event performance graph, we successfully reintegrated the Points by Academic class distribution chart (showing FR, SO, JR, SR in a nested layout for quick coach overview).

---

## 📂 File System Guide
*   **`server.ts`**: The backend HTTP listener mapping Vite routes and the `/api/parse-pdf` upload command via Express.
*   **`pdf_parser.py`**: The raw Python script that handles the heavy lifting of OCR and text scanning for swim PDFs.
*   **`src/App.tsx`**: The main interface structure managing Workspace States, Routing logic, and UI overlays.
*   **`src/components/TeamCard.tsx`**: The core data component representing a single team's statistics, charts (Event & Class), and drill-down swimmer tables.
*   **`src/lib/utils.ts`**: Math factories converting string times (e.g. `1:20.50`) into integers and applying projection algorithms.
*   **`src/cutlines.ts`**: The exported static array of strict NCAA A/B cut time standards.
