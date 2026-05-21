#!/usr/bin/env python3
"""Delta distance timed-finals: meet place vs scoring-place ladder."""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / 'backend'))
from point_calculator import (  # noqa: E402
    calculate_points,
    parse_rank_int,
    is_scoring_athlete,
    classify_round_tier,
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
        'prelims_time': r.get('prelimsTime'),
        'is_relay': r.get('isRelay', False),
        'is_exhibition': r.get('isExhibition', False),
        'is_time_trial': r.get('isTimeTrial', False),
    }


men = [row(r) for r in ws.get('menResults', [])]
calculate_points(men, settings)
cfg = settings
roster_fn = _build_roster_is_scorer(men, cfg) if _uses_roster(cfg) else None

DELTA = 'Delta State University'


def is_timed_final_distance(a):
    ev = str(a.get('event', '')).upper()
    if not any(x in ev for x in ('1000', '1650', '1500', '800')):
        return False
    return classify_round_tier(a.get('round_swam')) not in ('A', 'B', 'PRE')


def compress_event(evrows):
    """Assign points by scoring-place among roster-eligible finishers (timed-finals rule)."""
    evrows = sorted(evrows, key=lambda x: parse_rank_int(x) or 999)
    ladder_idx = 0
    delta_gain = 0.0
    for a in evrows:
        rk = parse_rank_int(a)
        got = float(a.get('calculated_points') or 0)
        is_scorer = roster_fn(a.get('name'), a.get('team'), a.get('gender')) if roster_fn else True
        counts = (
            not a.get('is_exhibition')
            and is_scoring_athlete(a)
            and is_scorer
        )
        ladder_pts = pts[ladder_idx] if counts and ladder_idx < len(pts) else 0
        if counts:
            if a.get('team') == DELTA:
                delta_gain += ladder_pts - got
            ladder_idx += 1
        meet_pts = pts[rk - 1] if rk and rk <= len(pts) else None
        if a.get('team') == DELTA or (got == 0 and counts) or (meet_pts and abs(meet_pts - got) > 0.01):
            print(
                f"    rk {rk:>2} meet={meet_pts} got={got:>4} compress={ladder_pts if counts else 0} "
                f"scorer={is_scorer} {a.get('name')}"
            )
    return delta_gain


for ev_key in ('1000', '1650'):
    evrows = [a for a in men if ev_key in str(a.get('event', '')) and 'MEN' in str(a.get('event', '')).upper()]
    evrows = sorted(evrows, key=lambda x: parse_rank_int(x) or 999)
    print(f'\n=== Men {ev_key} timed final ({len(evrows)} rows) ===')
    gain = compress_event(evrows)
    print(f'  Delta gain if scoring-place compress: {gain}')
