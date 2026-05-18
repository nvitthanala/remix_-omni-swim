import json, sys, io
sys.path.insert(0, '.')
from collections import defaultdict
from point_calculator import calculate_points

# Override stdout to capture
old_out = sys.stdout
sys.stdout = io.StringIO()

data = json.load(open('parsed_nsisc.json'))
scored = calculate_points(data)

sys.stdout = old_out

print(f'Input: {len(data)} athletes')
print(f'Output: {len(scored)} scored entries')

# Show first 5 scored
for a in scored[:5]:
    pts = a.get('calculated_points', 'N/A')
    print(f'  {a["name"]:20} {a["team"]:30} {a["event"][:35]:35} rnd={a["round_swam"]:15} pts={pts}')

# Team totals
tt = defaultdict(lambda: [0.0, 0.0])
for a in scored:
    p = a.get('calculated_points')
    if isinstance(p, (int, float)):
        tt[a['team']][0 if a['gender']=='Women' else 1] += p

print('\nTeam Totals:')
for t in sorted(tt):
    w,m = tt[t]
    print(f'  {t:40} W:{w:>8.1f} M:{m:>8.1f}')
tw = sum(v[0] for v in tt.values())
tm = sum(v[1] for v in tt.values())
print(f'\nTotal W: {tw:.1f} (off: 3167)')
print(f'Total M: {tm:.1f} (off: 2961)')