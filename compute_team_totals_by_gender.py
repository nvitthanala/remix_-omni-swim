import json
from collections import defaultdict

with open('meets.json','r',encoding='utf-8') as f:
    workspaces = json.load(f)

for ws in workspaces:
    men = ws.get('menResults', [])
    women = ws.get('womenResults', [])
    def sum_by_team(records):
        totals = defaultdict(float)
        for a in records:
            pts = a.get('points')
            if pts == 'N/A' or pts is None:
                pts_val = 0.0
            else:
                try:
                    pts_val = float(pts)
                except Exception:
                    try:
                        pts_val = float(a.get('points',0))
                    except Exception:
                        pts_val = 0.0
            totals[a.get('team','UNKNOWN')] += pts_val
        return totals

    men_totals = sum_by_team(men)
    women_totals = sum_by_team(women)

    combined = defaultdict(float)
    for t, p in men_totals.items():
        combined[t] += p
    for t, p in women_totals.items():
        combined[t] += p

    print('Workspace:', ws.get('name'))
    print('\nMen totals:')
    for team, pts in sorted(men_totals.items(), key=lambda x: -x[1]):
        print(f"  {team}: {pts}")
    print('\nWomen totals:')
    for team, pts in sorted(women_totals.items(), key=lambda x: -x[1]):
        print(f"  {team}: {pts}")
    print('\nCombined totals:')
    for team, pts in sorted(combined.items(), key=lambda x: -x[1]):
        print(f"  {team}: {pts}")
    print('\nChecked sum: men+women == combined? ', sum(men_totals.values())+sum(women_totals.values()) == sum(combined.values()))
    print('\n---\n')
