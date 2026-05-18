#!/usr/bin/env python3
import sys, json, subprocess
from collections import defaultdict

if len(sys.argv) < 2:
    print('Usage: python analyze_parsed.py <pdf>')
    sys.exit(1)

pdf=sys.argv[1]
proc = subprocess.run([sys.executable, 'pdf_parser.py', pdf], capture_output=True, text=True)
parsed = json.loads(proc.stdout)

team_counts = defaultdict(int)
samples = defaultdict(list)
for a in parsed:
    t = a.get('team') or 'UNKNOWN'
    team_counts[t] += 1
    if len(samples[t]) < 6:
        samples[t].append(a)

print('Parsed team counts:')
for t, c in sorted(team_counts.items(), key=lambda x: -x[1])[:30]:
    print(f"{t:40} : {c}")

check = 'University of West Florida'
print('\nSample entries for', check)
for t in sorted(samples.keys()):
    if any(x in t.lower() for x in ['west', 'delta', 'henderson', 'ouachita']):
        print('\nSamples for team:', t)
        for s in samples.get(t, [])[:10]:
            print(s)

# also print teams that look like variants
print('\nTeams with variants sample:')
for t in sorted(team_counts.keys()):
    if 'west' in t.lower() or 'delta' in t.lower() or 'henderson' in t.lower() or 'ouachita' in t.lower():
        print(t)

# Run scorer to analyze awarded points
proc2 = subprocess.run([sys.executable, 'point_calculator.py'], input=json.dumps(parsed), capture_output=True, text=True)
scored = json.loads(proc2.stdout)

team_stats = defaultdict(lambda: {'points':0.0,'scored':0,'na':0,'relays':0})
for a in scored:
    t = a.get('team') or 'UNKNOWN'
    pts = a.get('calculated_points')
    if isinstance(pts,(int,float)):
        team_stats[t]['points'] += float(pts)
        if a.get('is_relay'):
            team_stats[t]['relays'] += 1
        else:
            team_stats[t]['scored'] += 1
    else:
        team_stats[t]['na'] += 1

print('\nScoring summary by team (points, scored_individuals, relays_count, N/As):')
for t, s in sorted(team_stats.items(), key=lambda x: -x[1]['points']):
    print(f"{t:40} : {s['points']:6.1f} pts, {s['scored']} inds, {s['relays']} relays, {s['na']} NAs")
