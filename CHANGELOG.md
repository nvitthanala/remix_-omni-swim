# Changelog

All notable changes to this repository are recorded in this file.

## 2026-05-13 — Scoring & Parsing Refactor
- Improved team-name recognition and canonicalization in `pdf_parser.py` to reduce duplicate/garbled team entries.
- Made scoring engine configurable in `point_calculator.py`. Introduced NCAA D2 default scoring (Top-16) and settings keys: `scoringPoints`, `relayMultiplier`, `halfRateRelaySwimmer`, `maxIndividualScorersPerTeam`, `maxRelaysScoringPerTeam`, `maxRosterSize`.
- `point_calculator.py` will now read `scoring_settings.json` if present. `server.ts` writes current workspace scoring settings to that file before invoking the Python calculator.
- Fixed multiple parsing and scoring bugs (duplicate else block, relay tie handling, team aggregation).
- Added `compare_all_teams.py` helper and improved it to fuzzy-align official PDF names to parsed keys for better comparisons.
- Created checkpoint snapshots in `checkpoints/checkpoint_2026-05-13/`.

## Notes
- These changes make scoring behavior configurable from the frontend. The default is NCAA D2 Top-16 scoring semantics.
- Future steps: add unit tests and per-event delta reports; implement Hy-Tek place-compression exact semantics if needed.
