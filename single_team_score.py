#!/usr/bin/env python3
import sys
import json
import subprocess
from collections import defaultdict

if len(sys.argv) < 3:
    print("Usage: python single_team_score.py <pdf_path> <team_name>")
    sys.exit(1)

pdf = sys.argv[1]
team_name = sys.argv[2]

# Run parser
proc = subprocess.run([sys.executable, 'pdf_parser.py', pdf], capture_output=True, text=True)
if proc.returncode != 0:
    print('pdf_parser failed:', proc.stderr)
    sys.exit(1)

athletes = json.loads(proc.stdout)

# Import calculator
from point_calculator import calculate_points
scored = calculate_points(athletes)

# Sum points per event for the given team
per_event = defaultdict(float)
per_event_details = defaultdict(list)

per_event_m = defaultdict(float)
per_event_f = defaultdict(float)
per_event_details_m = defaultdict(list)
per_event_details_f = defaultdict(list)

total_m = 0.0
total_f = 0.0
seen_relay_team_events = set()
for a in scored:
    team = a.get('team')
    pts = a.get('calculated_points')
    if not team or team.strip().lower() != team_name.strip().lower():
        continue
    if not isinstance(pts, (int, float)):
        continue
    gender = (a.get('gender') or '').strip().lower()
    is_relay = a.get('is_relay')
    # For relays, prefer team-level points derived from rank to avoid undercounting when parser
    # missed relay members. Use SCORING by rank index and apply relay multiplier of 2.
    if is_relay:
        rank = a.get('rank')
        team_pts = None
        if rank and str(rank).isdigit():
            idx = int(rank) - 1
            if 0 <= idx < len(__import__('point_calculator').point_calculator.SCORING if hasattr(__import__('point_calculator'), 'point_calculator') else __import__('point_calculator').SCORING):
                # safe import of SCORING
                try:
                    SC = __import__('point_calculator').SCORING
                except Exception:
                    SC = __import__('point_calculator').SCORING
                team_pts = SC[idx] * 2
        # fallback: use swimmer-level sum for the event if rank-based not available
        if team_pts is None:
            team_pts = pts
        # Add team-level points only once per team-event (some relays list multiple members)
        team_event_key = (a['event'], team, rank)
        already = team_event_key in seen_relay_team_events
        if not already:
            per_event[a['event']] += team_pts
            if gender.startswith('m'):
                per_event_m[a['event']] += team_pts
                total_m += team_pts
            elif gender.startswith('w'):
                per_event_f[a['event']] += team_pts
                total_f += team_pts
            else:
                per_event[a['event']] += team_pts
            seen_relay_team_events.add(team_event_key)
        # Store swimmer-level and team-level info for reporting
        per_event_details[a['event']].append((a.get('name'), pts, True, a.get('gender'), team_pts))
        if gender.startswith('m'):
            per_event_details_m[a['event']].append((a.get('name'), pts, True, team_pts))
        elif gender.startswith('w'):
            per_event_details_f[a['event']].append((a.get('name'), pts, True, team_pts))
    else:
        per_event[a['event']] += pts
        per_event_details[a['event']].append((a.get('name'), pts, False, a.get('gender')))
        if gender.startswith('m'):
            per_event_m[a['event']] += pts
            per_event_details_m[a['event']].append((a.get('name'), pts, False))
            total_m += pts
        elif gender.startswith('w'):
            per_event_f[a['event']] += pts
            per_event_details_f[a['event']].append((a.get('name'), pts, False))
            total_f += pts
    

# Print breakdown
print(f"Team: {team_name}")
print(f"Total points (combined): {total_m + total_f}")
print(f"  Men total: {total_m}")
print(f"  Women total: {total_f}")

print('\nPer-event breakdown (Women):')
for ev, pts in sorted(per_event_f.items()):
    print(f"- {ev}: {pts}")
    for entry in per_event_details_f[ev]:
        if len(entry) == 4:
            name, swimmer_pts, is_relay, team_pts = entry
            tag = 'RELAY' if is_relay else 'IND'
            print(f"    {tag}: {name} -> swimmer_pts={swimmer_pts}, team_pts={team_pts}")
        else:
            name, p, is_relay = entry
            tag = 'RELAY' if is_relay else 'IND'
            print(f"    {tag}: {name} -> {p}")

print('\nPer-event breakdown (Men):')
for ev, pts in sorted(per_event_m.items()):
    print(f"- {ev}: {pts}")
    for entry in per_event_details_m[ev]:
        if len(entry) == 4:
            name, swimmer_pts, is_relay, team_pts = entry
            tag = 'RELAY' if is_relay else 'IND'
            print(f"    {tag}: {name} -> swimmer_pts={swimmer_pts}, team_pts={team_pts}")
        else:
            name, p, is_relay = entry
            tag = 'RELAY' if is_relay else 'IND'
            print(f"    {tag}: {name} -> {p}")

# Also print number of scoring entries
print('\nScoring entries counted (women):', sum(len(v) for v in per_event_details_f.values()))
print('Scoring entries counted (men):', sum(len(v) for v in per_event_details_m.values()))
