#!/usr/bin/env python3
"""Probe men 1650 timed-finals scoring vs roster eligibility."""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / 'backend'))
from point_calculator import (  # noqa: E402
    calculate_points,
    parse_rank_int,
    classify_round_tier,
    is_scoring_athlete,
)

meets = json.loads((REPO / 'data' / 'meets.json').read_text(encoding='utf-8'))
ws = next(m for m in meets if m.get('conference') == 'NSISC')
settings = ws.get('scoringSettings') or {}


def row(r):
    return {
        'id': r.get('id'),
        'name': r.get('name'),
        'team': r.get('team'),
        'gender': r.get('gender', 'Men'),
        'event': r.get('event'),
        'rank': r.get('rank'),
        'round_swam': r.get('roundSwam'),
        'time': r.get('time'),
        'finals_time': r.get('finalsTime'),
        'prelims_time': r.get('prelimsTime'),
        'is_relay': r.get('isRelay', False),
        'is_exhibition': r.get('isExhibition', False),
        'is_time_trial': r.get('isTimeTrial', False),
    }


men = [row(r) for r in ws.get('menResults', []) if '1650' in str(r.get('event', ''))]
calculate_points(men, settings)

pts = settings.get('scoringPoints', [20, 17, 16, 15, 14, 13, 12, 11, 9, 7, 6, 5, 4, 3, 2, 1])
print(f'Men 1650 rows: {len(men)}')
for a in sorted(men, key=lambda x: parse_rank_int(x) or 999):
    rk = parse_rank_int(a)
    got = float(a.get('calculated_points') or 0)
    meet_pts = pts[rk - 1] if rk and 1 <= rk <= len(pts) else None
    scoring_ok = is_scoring_athlete(a)
    print(
        f"  rk {rk:>2} meet_pts={meet_pts} got={got:>4} ex={a.get('is_exhibition')} "
        f"ok_clock={scoring_ok} {a.get('team','')[:20]:20} {a.get('name')}"
    )

# Simulated scoring-place ladder (eligible finishers only, by meet rank)
eligible = []
for a in sorted(men, key=lambda x: parse_rank_int(x) or 999):
    rk = parse_rank_int(a)
    if not rk:
        continue
    if a.get('is_exhibition') or not is_scoring_athlete(a):
        continue
    if float(a.get('calculated_points') or 0) <= 0:
        continue
    eligible.append(a)

print('\nEligible with points (scoring-order simulation):')
for i, a in enumerate(eligible):
    rk = parse_rank_int(a)
    got = float(a.get('calculated_points') or 0)
    ladder = pts[i] if i < len(pts) else 0
    print(f"  scoring_place {i+1} meet_rk {rk} ladder={ladder} got={got} {a.get('name')} {a.get('team')}")
