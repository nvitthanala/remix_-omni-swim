import json, sys, io
sys.path.insert(0, '.')
from collections import defaultdict
from point_calculator import calculate_points

# Load parsed data
data = json.load(open('parsed_nsisc.json'))
print(f'Loaded {len(data)} athletes')

# Calculate points
scored = calculate_points(data)
print(f'Scored {len(scored)} entries')

# Compute team totals
team_totals = defaultdict(lambda: [0.0, 0.0])  # [women, men]
for a in scored:
    pts = a.get('calculated_points')
    if isinstance(pts, (int, float)):
        idx = 0 if a.get('gender') == 'Women' else 1
        team_totals[a['team']][idx] += pts

print('\nOur Computed Team Scores:')
for team in sorted(team_totals):
    w, m = team_totals[team]
    print(f'{team:40} W: {w:>8.1f}  M: {m:>8.1f}')

total_w = sum(v[0] for v in team_totals.values())
total_m = sum(v[1] for v in team_totals.values())
print(f'\nTotal Women: {total_w:.1f} (Official: 3167)')
print(f'Total Men: {total_m:.1f} (Official: 2961)')

# Compute per-team deltas
print('\n--- Comparison to Official ---')
official_w = {
    'University of West Florida': 1239,
    'Delta State University': 916,
    'Ouachita Baptist University': 536,
    'Henderson State University': 476
}
official_m = {
    'Henderson State University': 1056,
    'Ouachita Baptist University': 1029.5,
    'Delta State University': 875.5,
}

for team in sorted(team_totals):
    w, m = team_totals[team]
    ow = official_w.get(team, 0)
    om = official_m.get(team, 0)
    dw = w - ow
    dm = m - om
    status = '✓' if abs(dw) < 5 and abs(dm) < 5 else '✗'
    print(f'{status} {team:40} W: {w:>8.1f} vs {ow:>4} (d={dw:>+6.1f})  M: {m:>8.1f} vs {om:>6} (d={dm:>+6.1f})')