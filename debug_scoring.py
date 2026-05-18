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

print("=========================================")
print("           SCORE CALCULATION REPORT         ")
print("=========================================\n")

# 1. Event/Round Scoring Summary (The main goal: find the gap!)
event_summary = defaultdict(lambda: {'TotalSwimmers': {}, 'ScoredSwimmers': {}})

for a in data:
    ev = a['event'].split('(')[0].strip()
    rnd = a['round_swam']
    if not a['is_exhibition'] and not a['is_time_trial']:
        # Track total potential scorers
        if rnd not in event_summary[ev]['TotalSwimmers']:
             event_summary[ev]['TotalSwimmers'][rnd] = 0
        event_summary[ev]['TotalSwimmers'][rnd] += 1

for a in scored:
    if isinstance(a.get('calculated_points'), (int, float)):
        ev = a['event'].split('(')[0].strip()
        rnd = a['round_swam']
        if rnd not in event_summary[ev]['ScoredSwimmers']:
            event_summary[ev]['ScoredSwimmers'][rnd] = 0
        event_summary[ev]['ScoredSwimmers'][rnd] += 1

print("--- SCORING DISCREPANCY REPORT (Potential Missing Points) ---")
for ev, data in event_summary.items():
    total_swimmers = list(data['TotalSwimmers'].items())
    scored_swimmers = list(data['ScoredSwimmers'].items())

    print(f"\n--- Event: {ev} ---")

    # Check round by round discrepancy
    all_rounds = set([str(r) for r, c in total_swimmers]) | set([str(r) for r, c in scored_swimmers])
    # Convert all rounds to string keys before sorting and processing
    sorted_round_keys = sorted(list(all_rounds), key=lambda x: (len(x), list(map(ord, x))))
    for rnd in sorted_round_keys:
        total = data['TotalSwimmers'].get(rnd, 0)
        score = data['ScoredSwimmers'].get(rnd, 0)

        print(f"  Round {rnd:<25}: Total Swimmers={total}, Scored Scorers={score} (Gap: {total - score})")

# 2. Team totals
tt = defaultdict(lambda: [0.0, 0.0])
for a in scored:
    p = a.get('calculated_points')
    if isinstance(p, (int, float)):
        tt[a['team']][0 if a['gender']=='Women' else 1] += p

print("\n=========================================")
print("          FINAL TEAM TOTALS              ")
print("=========================================\n")

for t in sorted(tt):
    w,m = tt[t]
    print(f'  {t:40} W:{w:>8.1f} M:{m:>8.1f}')
tw = sum(v[0] for v in tt.values())
tm = sum(v[1] for v in tt.values())
print(f'\nTotal W: {tw:.1f} (official: 3167)')
print(f'Total M: {tm:.1f} (official: 2961)')