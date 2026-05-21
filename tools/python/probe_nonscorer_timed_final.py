#!/usr/bin/env python3
"""Find non-scorers who still get meet-rank points in timed finals."""
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
    _build_roster_is_scorer,
    _uses_roster,
)

meets = json.loads((REPO / 'data' / 'meets.json').read_text(encoding='utf-8'))
ws = next(m for m in meets if m.get('conference') == 'NSISC')
settings = {**ws.get('scoringSettings', {}), 'scorerRosterOverrides': ws.get('scorerRosterOverrides') or []}
pts = settings['scoringPoints']


def row(r):
    return {
        'name': r.get('name'),
        'team': r.get('team'),
        'gender': r.get('gender', 'Men'),
        'event': r.get('event'),
        'rank': r.get('rank'),
        'round_swam': r.get('roundSwam'),
        'finals_time': r.get('finalsTime'),
        'is_exhibition': r.get('isExhibition', False),
        'is_time_trial': r.get('isTimeTrial', False),
        'is_relay': r.get('isRelay', False),
    }


def is_timed_final_distance(a):
    ev = str(a.get('event', '')).upper()
    if not any(x in ev for x in ('1000', '1650', '1500', '800')):
        return False
    return classify_round_tier(a.get('round_swam')) not in ('A', 'B', 'PRE')


men = [row(r) for r in ws.get('menResults', [])]
calculate_points(men, settings)
roster_fn = _build_roster_is_scorer(men, settings) if _uses_roster(settings) else None

DELTA = 'Delta State University'

# Group timed-final events
by_event = {}
for a in men:
    if not is_timed_final_distance(a) or a.get('is_relay'):
        continue
    ev = a.get('event')
    by_event.setdefault(ev, []).append(a)

total_delta_gain = 0.0
for ev, evrows in sorted(by_event.items()):
    evrows = sorted(evrows, key=lambda x: parse_rank_int(x) or 999)
    ladder = 0
    event_gain = 0.0
    for a in evrows:
        rk = parse_rank_int(a)
        got = float(a.get('calculated_points') or 0)
        is_scorer = roster_fn(a.get('name'), a.get('team'), a.get('gender')) if roster_fn else True
        counts = not a.get('is_exhibition') and is_scoring_athlete(a) and is_scorer
        compress_pts = pts[ladder] if counts and ladder < len(pts) else 0
        meet_pts = pts[rk - 1] if rk and rk <= len(pts) else 0
        if counts:
            ladder += 1
        if got != compress_pts and (counts or got > 0):
            print(f'{ev[-30:]}')
            print(f'  rk{rk} {a.get("name")} scorer={is_scorer} meet={meet_pts} got={got} compress={compress_pts}')
        if a.get('team') == DELTA:
            event_gain += compress_pts - got
    total_delta_gain += event_gain

print(f'\nTotal Delta gain if all timed finals use compress ladder: {total_delta_gain}')
