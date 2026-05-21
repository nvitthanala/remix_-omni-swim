#!/usr/bin/env python3
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / 'backend'))
from point_calculator import (  # noqa: E402
    calculate_points,
    parse_rank_int,
    classify_round_tier,
    DEFAULT_NCAA_D2_SCORING,
)

meets = json.loads((REPO / 'data' / 'meets.json').read_text(encoding='utf-8'))
ws = next(m for m in meets if m.get('conference') == 'NSISC')
settings = ws.get('scoringSettings') or {}
pts = settings.get('scoringPoints', DEFAULT_NCAA_D2_SCORING)
bracket = settings.get('aFinalBracketSize', 8)
mult = settings.get('relayMultiplier', 2)


def to_snake(r):
    return {
        'name': r.get('name'),
        'team': r.get('team'),
        'gender': r.get('gender', 'Men'),
        'event': r.get('event'),
        'rank': r.get('rank'),
        'round_swam': r.get('roundSwam'),
        'time': r.get('time'),
        'finals_time': r.get('finalsTime'),
        'prelims_time': r.get('prelimsTime'),
        'relay_team_time': r.get('relayTeamTime'),
        'is_relay': r.get('isRelay', False),
        'is_exhibition': r.get('isExhibition', False),
        'is_time_trial': r.get('isTimeTrial', False),
    }


athletes = [to_snake(r) for r in ws.get('menResults', [])]
calculate_points(athletes, settings)
team = 'Delta State University'


def expected(r):
    rk = parse_rank_int(r)
    if not rk or rk > 16:
        return None
    tier = classify_round_tier(r.get('round_swam'))
    if tier in ('TT', 'C', 'D'):
        return None
    if r.get('is_relay'):
        idx = rk - 1
        if tier == 'B' and rk <= bracket:
            idx = bracket + (rk - 1)
        return pts[idx] * mult
    if tier == 'B' and rk <= bracket:
        return pts[bracket + rk - 1]
    return pts[rk - 1]


short = 0.0
for a in athletes:
    if a.get('team') != team:
        continue
    got = float(a.get('calculated_points') or 0)
    exp = expected(a)
    if exp is None:
        continue
    got_team = got * 4 if a.get('is_relay') else got
    d = exp - got_team
    if d > 0.001:
        short += d
        print(
            f'short {d:.2f} got {got_team} exp {exp} {a.get("name")} rk {a.get("rank")} '
            f'{a.get("round_swam")} {str(a.get("event"))[-40:]}'
        )
print('total shortfall', short)
