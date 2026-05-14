import json, subprocess, sys, os

pdf = '2026_NSISC_Championships_Final_Results.pdf'
base = os.getcwd()
path = os.path.join(base, pdf)

out = subprocess.check_output([sys.executable, 'pdf_parser.py', path], cwd=base, timeout=120000)
parsed = json.loads(out)
proc = subprocess.Popen([sys.executable, 'point_calculator.py'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=base, text=True)
stdout, stderr = proc.communicate(json.dumps(parsed), timeout=120000)
calc = json.loads(stdout)

# group by event
from collections import defaultdict
events = defaultdict(list)
for a in calc:
    events[a['event']].append(a)

# print first 10 events with details
count=0
for ev, lst in events.items():
    print('\n=== EVENT:', ev, '===')
    for a in sorted(lst, key=lambda x:(x.get('rank') or 'ZZZ')):
        print(f"{a.get('rank'):>4} | {a['name'][:25]:25} | {a['team'][:25]:25} | {a.get('round_swam'):10} | finals:{a.get('finals_time'):8} | exh:{a.get('is_exhibition')} | pts:{a.get('calculated_points')}")
    count+=1
    if count>9: break

print('\nDone')
