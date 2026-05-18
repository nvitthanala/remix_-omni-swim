import json
from collections import defaultdict

with open('meets.json','r',encoding='utf-8') as f:
    workspaces = json.load(f)

for ws in workspaces:
    totals = defaultdict(float)
    athletes = ws.get('menResults', []) + ws.get('womenResults', [])
    for a in athletes:
        pts = a.get('points')
        try:
            pts_val = float(pts) if pts != 'N/A' else 0.0
        except Exception:
            try:
                pts_val = float(a.get('points',0))
            except Exception:
                pts_val = 0.0
        totals[a.get('team','UNKNOWN')] += pts_val

    print('Workspace:', ws.get('name'))
    for team, pts in sorted(totals.items(), key=lambda x: -x[1]):
        print(f"{team}: {pts}")
    print()
