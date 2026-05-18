#!/usr/bin/env python3
import sys, json, subprocess, re
from collections import defaultdict
import pdfplumber

if len(sys.argv) < 2:
    print('Usage: python compare_all_teams.py <pdf>')
    sys.exit(1)
pdf=sys.argv[1]
# parse pdf
proc = subprocess.run([sys.executable,'pdf_parser.py',pdf], capture_output=True, text=True)
parsed=json.loads(proc.stdout)
from point_calculator import calculate_points
scored = calculate_points(parsed)
# compute our totals per team per gender (use team-level relay points once)
team_totals = defaultdict(lambda: {'men':0.0,'women':0.0})
seen_relay=set()
for a in scored:
    team=a.get('team') or 'UNKNOWN'
    gender=(a.get('gender') or '').lower()
    if a.get('is_relay'):
        key=(a.get('event'),team,a.get('rank'))
        if key in seen_relay: continue
        seen_relay.add(key)
        rank=a.get('rank')
        team_pts=None
        if rank and str(rank).isdigit():
            idx=int(rank)-1
            import point_calculator as pc
            SC = pc._resolve_scoring_settings().get('scoringPoints')
            if 0<=idx<len(SC):
                team_pts=SC[idx]*2
        if team_pts is None:
            # fallback sum swimmer points
            team_pts=sum([x.get('calculated_points') for x in scored if x.get('event')==a.get('event') and x.get('team')==team and x.get('is_relay') and isinstance(x.get('calculated_points'),(int,float))])
        if gender.startswith('m'):
            team_totals[team]['men']+=team_pts
        elif gender.startswith('w'):
            team_totals[team]['women']+=team_pts
        else:
            team_totals[team]['women']+=team_pts
    else:
        pts=a.get('calculated_points')
        if isinstance(pts,(int,float)):
            if gender.startswith('m'):
                team_totals[team]['men']+=pts
            elif gender.startswith('w'):
                team_totals[team]['women']+=pts
            else:
                team_totals[team]['women']+=pts

# extract official totals from last pages
with pdfplumber.open(pdf) as pdfobj:
    pages='\n'.join([p.extract_text() or '' for p in pdfobj.pages[-8:]])
# find women block
women_block_match=re.search(r'Team Rankings[\s\S]*?Women - Team Scores[\s\S]*?Total\s+([0-9,\.]+)', pages)
official_women={}
official_men={}
if women_block_match:
    start=women_block_match.start()
    block=pages[start:start+800]
    lines=[l.strip() for l in block.splitlines() if re.search(r'\d{1,3}(?:,\d{3})?(?:\.\d+)?$',l)]
    for l in lines:
        m=re.match(r'\d+\s+(.*?)\s+(\d{1,3}(?:,\d{3})?)(?:\.\d+)?$', l)
        if m:
            name=m.group(1).strip(); pts=int(m.group(2).replace(',',''))
            official_women[name]=pts
# find men block after women total
men_block_match=re.search(r'Women - Team Scores[\s\S]*?Total[\s\S]*?Men - Team Scores[\s\S]*?Total\s+([0-9,\.]+)', pages)
if men_block_match:
    # crude extraction of lines after 'Men - Team Scores'
    men_idx=pages.find('Men - Team Scores')
    block=pages[men_idx:men_idx+800]
    lines=[l.strip() for l in block.splitlines() if re.search(r'\d{1,3}(?:,\d{3})?(?:\.\d+)?$',l)]
    for l in lines:
        m=re.match(r'\d+\s+(.*?)\s+(\d{1,3}(?:,\d{3})?)(?:\.\d+)?$', l)
        if m:
            name=m.group(1).strip(); pts=float(m.group(2).replace(',',''))
            official_men[name]=pts

# Now compare
import difflib

# Attempt to align official names to our parsed team keys using fuzzy matching to reduce duplicates
aligned_team_totals = dict(team_totals)
parsed_keys = list(team_totals.keys())

def try_map_official(official_map):
    mapped = {}
    for off_name, off_pts in official_map.items():
        # try exact first
        if off_name in aligned_team_totals:
            mapped[off_name] = off_pts
            continue
        # fuzzy match to parsed keys
        matches = difflib.get_close_matches(off_name, parsed_keys, n=1, cutoff=0.6)
        if matches:
            mk = matches[0]
            # prefer mapping to existing parsed key
            mapped[mk] = off_pts
        else:
            mapped[off_name] = off_pts
    return mapped

official_women_mapped = try_map_official(official_women)
official_men_mapped = try_map_official(official_men)

all_names=set(list(aligned_team_totals.keys())+list(official_women_mapped.keys())+list(official_men_mapped.keys()))
rows=[]
for n in sorted(all_names):
    ours_w=team_totals.get(n,{}).get('women',0)
    ours_m=team_totals.get(n,{}).get('men',0)
    off_w=official_women_mapped.get(n,0)
    off_m=official_men_mapped.get(n,0)
    rows.append((n,ours_w,off_w,ours_m,off_m,(ours_w-off_w),(ours_m-off_m)))

print('team | our_w | off_w | delta_w | our_m | off_m | delta_m')
for r in sorted(rows, key=lambda x: -(abs(x[5])+abs(x[6])) )[:30]:
    print(f"{r[0]:40.40} | {r[1]:6.1f} | {r[2]:6} | {r[5]:6.1f} | {r[3]:6.1f} | {r[4]:6} | {r[6]:6.1f}")

print('\nSummary totals:')
print('Our women total:', sum([v['women'] for v in team_totals.values()]))
print('Official women total:', sum(official_women.values()))
print('Our men total:', sum([v['men'] for v in team_totals.values()]))
print('Official men total:', sum(official_men.values()))
