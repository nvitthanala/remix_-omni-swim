#!/usr/bin/env python3
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / 'backend'))
from point_calculator import calculate_points, parse_rank_int, is_scoring_athlete  # noqa: E402

meets = json.loads((REPO / 'data' / 'meets.json').read_text(encoding='utf-8'))
ws = next(m for m in meets if m.get('conference') == 'NSISC')
settings = {**ws.get('scoringSettings', {}), 'scorerRosterOverrides': ws.get('scorerRosterOverrides') or []}


def row(r):
    return {
        'id': r.get('id'),
        'name': r.get('name'),
        'team': r.get('team'),
        'gender': r.get('gender', 'Men'),
        'event': r.get('event'),
        'rank': r.get('rank'),
        'round_swam': r.get('roundSwam'),
        'finals_time': r.get('finalsTime'),
        'prelims_time': r.get('prelimsTime'),
        'is_relay': r.get('isRelay', False),
        'is_exhibition': r.get('isExhibition', False),
        'is_time_trial': r.get('isTimeTrial', False),
    }


men = [row(r) for r in ws.get('menResults', [])]
calculate_points(men, settings)
pts = settings.get('scoringPoints', [])

ev = [a for a in men if '1650' in str(a.get('event', ''))]
print('Full meet context — men 1650:')
for a in sorted(ev, key=lambda x: parse_rank_int(x) or 999):
    rk = parse_rank_int(a)
    got = float(a.get('calculated_points') or 0)
    meet_pts = pts[rk - 1] if rk and rk <= len(pts) else None
    diff = (meet_pts - got) if meet_pts is not None else None
    flag = ' ***' if diff and diff > 0.01 else ''
    print(
        f"  rk {rk:>2} meet={meet_pts} got={got:>4} diff={diff}{flag} "
        f"{a.get('team','')[:18]:18} {a.get('name')}"
    )

# Delta total
team = 'Delta State University'
total = sum(float(a.get('calculated_points') or 0) for a in men if a.get('team') == team)
print(f'\nDelta men total: {total}')
