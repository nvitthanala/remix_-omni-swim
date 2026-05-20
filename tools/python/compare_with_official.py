#!/usr/bin/env python3
"""Compare computed team totals to HyTek official block at end of meet PDF."""

import argparse
import difflib
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BACKEND = REPO / 'backend'
PDF_PARSER = BACKEND / 'pdf_parser.py'
POINT_CALC = BACKEND / 'point_calculator.py'
PRESETS_DIR = REPO / 'data' / 'scoring_presets'
SCORING_SETTINGS = REPO / 'data' / 'scoring_settings.json'
ENV = {**os.environ, 'OMNI_PROJECT_ROOT': str(REPO), 'OMNI_DATA_DIR': str(REPO / 'data')}

PRESET_META = frozenset({'id', 'label', 'description'})


def load_preset_settings(preset_id: str) -> dict:
    path = PRESETS_DIR / f'{preset_id.replace("/", "")}.json'
    if not path.is_file():
        raise FileNotFoundError(f'Preset not found: {preset_id} ({path})')
    raw = json.loads(path.read_text(encoding='utf-8'))
    return {k: v for k, v in raw.items() if k not in PRESET_META}


def main():
    parser = argparse.ArgumentParser(description='Compare computed scores to PDF official team rankings')
    parser.add_argument('pdf', help='Path to meet results PDF')
    parser.add_argument(
        '--preset',
        help='Scoring preset id (e.g. nsisc, generic-top16). Writes data/scoring_settings.json before scoring.',
    )
    args = parser.parse_args()

    if args.preset:
        settings = load_preset_settings(args.preset)
        SCORING_SETTINGS.write_text(json.dumps(settings, indent=2), encoding='utf-8')
        print(f'Using preset: {args.preset}')

    sys.path.insert(0, str(BACKEND))
    from team_rankings_parser import extract_team_rankings_from_pdf

    try:
        official_data = extract_team_rankings_from_pdf(args.pdf)
    except Exception as e:
        print('Failed to extract official rankings from PDF:', e)
        sys.exit(1)

    official = {
        'Women': official_data.get('women', {}),
        'Men': official_data.get('men', {}),
    }
    event_through = official_data.get('eventThrough')
    if event_through:
        print(f'Official rankings through event {event_through}')

    proc = subprocess.run(
        [sys.executable, str(PDF_PARSER), args.pdf],
        capture_output=True,
        text=True,
        cwd=str(REPO),
        env=ENV,
    )
    try:
        parsed = json.loads(proc.stdout)
    except Exception as e:
        print('Failed to parse parser output:', e)
        print(proc.stdout[:1000])
        sys.exit(1)

    proc2 = subprocess.run(
        [sys.executable, str(POINT_CALC)],
        input=json.dumps(parsed),
        capture_output=True,
        text=True,
        cwd=str(REPO),
        env=ENV,
    )
    try:
        scored = json.loads(proc2.stdout)
    except Exception as e:
        print('Failed to parse scorer output:', e)
        print(proc2.stdout[:1000])
        sys.exit(1)

    team_totals = defaultdict(lambda: defaultdict(float))
    for a in scored:
        team = a.get('team') or 'UNKNOWN'
        gender = a.get('gender') or 'Women'
        pts = a.get('calculated_points')
        if isinstance(pts, (int, float)):
            team_totals[team][gender] += float(pts)

    official_names = set(list(official['Women'].keys()) + list(official['Men'].keys()))

    def norm_key(s):
        return re.sub(r'[^a-z0-9]', '', (s or '').lower())

    name_map = {}
    for parsed_name in list(team_totals.keys()):
        if parsed_name in official_names:
            name_map[parsed_name] = parsed_name
            continue
        matches = difflib.get_close_matches(parsed_name, list(official_names), n=1, cutoff=0.5)
        if matches:
            name_map[parsed_name] = matches[0]
            continue
        nk = norm_key(parsed_name)
        for off in official_names:
            if norm_key(off) == nk:
                name_map[parsed_name] = off
                break
        if parsed_name not in name_map:
            name_map[parsed_name] = parsed_name

    merged_totals = defaultdict(lambda: defaultdict(float))
    for tname, genders in team_totals.items():
        mapped = name_map.get(tname, tname)
        for g, val in genders.items():
            merged_totals[mapped][g] += val

    team_totals = merged_totals
    all_teams = set(list(team_totals.keys()) + list(official['Women'].keys()) + list(official['Men'].keys()))
    rows = []
    for t in sorted(all_teams):
        our_w = team_totals.get(t, {}).get('Women', 0.0)
        our_m = team_totals.get(t, {}).get('Men', 0.0)
        off_w = official['Women'].get(t, 0.0)
        off_m = official['Men'].get(t, 0.0)
        rows.append((t, our_w, off_w, our_m, off_m, our_w - off_w, our_m - off_m))

    print('Team | OurW | OffW | DeltaW | OurM | OffM | DeltaM')
    for r in sorted(rows, key=lambda x: -(abs(x[5]) + abs(x[6]))):
        print(f"{r[0]:40.40} | {r[1]:6.1f} | {r[2]:6.1f} | {r[5]:7.1f} | {r[3]:6.1f} | {r[4]:6.1f} | {r[6]:7.1f}")

    print('\nSummary: Our totals vs Official totals:')
    print('Our Women total:', sum(v.get('Women', 0) for v in team_totals.values()))
    print('Official Women total:', sum(official['Women'].values()))
    print('Our Men total:', sum(v.get('Men', 0) for v in team_totals.values()))
    print('Official Men total:', sum(official['Men'].values()))


if __name__ == '__main__':
    main()
