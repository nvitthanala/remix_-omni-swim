# Codebase Documentation (Consolidated)

This consolidated document explains the core logic and where to modify behavior.

1) PDF Parsing (`pdf_parser.py`)
- Purpose: extract swimmers, relays, team names, times, rounds, ranks, and class years using `pdfplumber` text extraction.
- Team discovery: two-pass approach — discover candidate teams from lines with class-year tokens, canonicalize using normalized keys, and prefer exact/prefix matches before fuzzy fallback.
- Relay parsing: detects relay header lines and reads following lines to extract swimmer names and years.
- Known limitations: PDFs with nonstandard formatting may still require per-file heuristics.

2) Scoring Engine (`point_calculator.py`)
- Purpose: compute `calculated_points` for swimmers based on rank/round/time and conference rules.
- Configuration: accepts an optional `scoring_settings` dict with keys:
  - `scoringPoints` (array)
  - `relayMultiplier` (number)
  - `halfRateRelaySwimmer` (bool)
  - `maxIndividualScorersPerTeam` (int)
  - `maxRelaysScoringPerTeam` (int)
  - `maxRosterSize` (int)
- Defaults: NCAA D2 Top-16 scoring is used when settings are absent.
- Relay handling: group relays by (team, rank, time), compute team relay points from scoring points * relayMultiplier, split into swimmer points. If `halfRateRelaySwimmer` is true, swimmers receive team_pts / 4.
- Conference rules: `allowed_rounds_for_conference(conf)` identifies which rounds count for scoring (NSISC: A+B finals). Distance/timed-final events may treat prelims as scoring heat.

3) Frontend Settings and Hooks
- `src/components/ScoringSettingsPanel.tsx` and `ScoringSettingsModal.tsx` allow editing scoring settings. Saving writes to the workspace object; server writes workspace settings to `scoring_settings.json` before invoking the Python calculator.
- `OpsModule.tsx` passes `workspace.scoringSettings` into the frontend `calculatePoints` utility for live projection.

4) Server Integration (`server.ts`)
- Endpoint `/api/parse-pdf` accepts a base64 PDF, calls `pdf_parser.py`, writes `scoring_settings.json`, then calls `point_calculator.py` and returns normalized results.

5) Utilities & Helpers
- `compare_all_teams.py` — helper script to extract official team totals from last pages and compare against our computed totals. Now does fuzzy alignment of names.

6) Testing & Checkpoints
- Checkpoints saved under `checkpoints/` with snapshots of edited files.
- Recommended next steps: add pytest fixtures for representative PDF fragments, per-event delta unit tests, and a Hy-Tek-compatible tie/place compression test matrix.

7) How to modify scoring from UI
- Open the Scoring Settings modal in the app and edit the `Scoring Points`, `Relay Multiplier`, and caps. Saving updates workspace settings and will be used by the next parse operation (server writes settings to `scoring_settings.json`).

8) Contact / Authors
- Primary maintainer: repository owner (local workspace). For changes to parsing heuristics, prefer small iterative edits and re-run comparisons.
