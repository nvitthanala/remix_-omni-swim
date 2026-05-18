#!/usr/bin/env python3
import sys, json, subprocess, re
from collections import defaultdict

if len(sys.argv) < 2:
    print('Usage: python compare_with_official.py <pdf>')
    sys.exit(1)

pdf=sys.argv[1]

# Official totals provided by user for NSISC
official = {
    'Women': {
        'University of West Florida': 1239.0,
        'Delta State University': 916.0,
        'Ouachita Baptist University': 536.0,
        'Henderson State University': 476.0,
    },
    'Men': {
        'Henderson State University': 1056.0,
        'Ouachita Baptist University': 1029.5,
        'Delta State University': 875.5,
    }
}

# Run parser
proc = subprocess.run([sys.executable, 'pdf_parser.py', pdf], capture_output=True, text=True)
try:
    parsed = json.loads(proc.stdout)
except Exception as e:
    print('Failed to parse parser output:', e)
    print(proc.stdout[:1000])
    sys.exit(1)

# Run scorer
proc2 = subprocess.run([sys.executable, 'point_calculator.py'], input=json.dumps(parsed), capture_output=True, text=True)
try:
    scored = json.loads(proc2.stdout)
except Exception as e:
    print('Failed to parse scorer output:', e)
    print(proc2.stdout[:1000])
    sys.exit(1)

# Aggregate per team/gender/event
team_event = {}  # team_event[(team,gender,event)] = {'points': float} or {'relay_shares': [...], 'relay_rank': rank}
team_totals = defaultdict(lambda: defaultdict(float))  # team_totals[team][gender]
# Need SCORING defaults
import point_calculator as pc
SC = pc._resolve_scoring_settings().get('scoringPoints')
relay_mult = pc._resolve_scoring_settings().get('relayMultiplier')

for a in scored:
    team = a.get('team') or 'UNKNOWN'
    gender = a.get('gender') or 'Women'
    event = a.get('event')
    is_relay = a.get('is_relay')
    pts = a.get('calculated_points')
    rank = a.get('rank')
    key = (team, gender, event)
    if is_relay:
        if key not in team_event:
            team_event[key] = {'relay_shares': [], 'relay_rank': None}
        if isinstance(pts, (int, float)):
            team_event[key]['relay_shares'].append(float(pts))
        if rank and not team_event[key].get('relay_rank'):
            team_event[key]['relay_rank'] = rank
    else:
        if isinstance(pts, (int, float)):
            if key not in team_event:
                team_event[key] = {'points': 0.0}
            team_event[key]['points'] += float(pts)
            team_totals[team][gender] += float(pts)

# Now finalize relay team points
for (team, gender, event), vals in list(team_event.items()):
    if 'relay_shares' in vals:
        shares = vals['relay_shares']
        if not shares:
            continue
        # Prefer the actual relay shares sum so A/B finals and swim-off contributions are preserved.
        team_pts = sum(shares)
        if team_pts == 0:
            rnk = vals.get('relay_rank')
            if rnk and str(rnk).isdigit():
                idx = int(rnk) - 1
                if 0 <= idx < len(SC):
                    team_pts = SC[idx] * relay_mult
        team_event[(team, gender, event)] = team_pts
        team_totals[team][gender] += team_pts

# Print per-team comparison
import difflib

# Normalize parsed team names to map to official team names when possible
official_names = set(list(official['Women'].keys()) + list(official['Men'].keys()))

def norm_key(s):
    return re.sub(r'[^a-z0-9]', '', (s or '').lower())

# Build mapping from parsed team to canonical official name when close
name_map = {}
for parsed_name in list(team_totals.keys()):
    if parsed_name in official_names:
        name_map[parsed_name] = parsed_name
        continue
    matches = difflib.get_close_matches(parsed_name, list(official_names), n=1, cutoff=0.5)
    if matches:
        name_map[parsed_name] = matches[0]
    else:
        # try more aggressive normalization
        nk = norm_key(parsed_name)
        for off in official_names:
            if norm_key(off) == nk:
                name_map[parsed_name] = off
                break
        if parsed_name not in name_map:
            name_map[parsed_name] = parsed_name

# Merge team_totals into mapped names
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
    rows.append((t, our_w, off_w, our_m, off_m, our_w-off_w, our_m-off_m))

print('Team | OurW | OffW | DeltaW | OurM | OffM | DeltaM')
for r in sorted(rows, key=lambda x: -(abs(x[5]) + abs(x[6]))):
    print(f"{r[0]:40.40} | {r[1]:6.1f} | {r[2]:6.1f} | {r[5]:7.1f} | {r[3]:6.1f} | {r[4]:6.1f} | {r[6]:7.1f}")

print('\nPer-event contributions for teams with largest deltas:')
# find top teams by abs delta
for team, our_w, off_w, our_m, off_m, dw, dm in sorted(rows, key=lambda x: -(abs(x[5]) + abs(x[6])))[:5]:
    print('\nTeam:', team)
    for gender in ['Women', 'Men']:
        print(' ', gender)
        items = []
        for (tm, g, ev), val in team_event.items():
            if tm == team and g == gender and not isinstance(val, dict):
                items.append((ev, val))
        items.sort(key=lambda x: -x[1])
        for ev, val in items[:10]:
            print(f"    {ev[:60]:60} -> {val:6.1f}")

print('\nSummary: Our totals vs Official totals:')
print('Our Women total:', sum([v.get('Women',0) for v in team_totals.values()]))
print('Official Women total:', sum(official['Women'].values()))
print('Our Men total:', sum([v.get('Men',0) for v in team_totals.values()]))
print('Official Men total:', sum(official['Men'].values()))
