import pdfplumber
import re
import json, subprocess, sys, os
from collections import defaultdict
import difflib

PDFS = [
    '2026_acc_championship_full_meet_results_1col.pdf',
    '2026_NSISC_Championships_Final_Results.pdf',
    'glvc_results26.pdf',
    'Big_12_S_D_Champ_Results_pdf.pdf'
]
BASE = os.getcwd()

rank_regexes = [
    re.compile(r'^\s*(\d{1,2})\.\s+(.+?)\s+(\d{1,5})$'),
    re.compile(r'^\s*(\d{1,2})\s+(.+?)\s+(\d{1,5})$')
]

def extract_official_from_last_pages(path, pages_to_scan=3):
    with pdfplumber.open(path) as pdfobj:
        total_pages = len(pdfobj.pages)
        start = max(0, total_pages - pages_to_scan)
        lines = []
        for i in range(start, total_pages):
            tx = pdfobj.pages[i].extract_text()
            if not tx: continue
            lines += [l.strip() for l in tx.split('\n') if l.strip()]
    # find consecutive ranking blocks
    blocks = []
    cur = []
    for l in lines:
        matched = False
        for rx in rank_regexes:
            m = rx.match(l)
            if m:
                rank = int(m.group(1))
                team = m.group(2).strip()
                pts = int(m.group(3))
                cur.append((rank, team, pts))
                matched = True
                break
        if not matched:
            if len(cur) >= 3:
                blocks.append(cur)
            cur = []
    if len(cur) >= 3:
        blocks.append(cur)
    # choose the largest block by length
    if not blocks:
        return []
    best = max(blocks, key=lambda b: len(b))
    return best


def compute_from_parser(path):
    out = subprocess.check_output([sys.executable, 'pdf_parser.py', path], cwd=BASE, timeout=120000)
    parsed = json.loads(out)
    proc = subprocess.Popen([sys.executable, 'point_calculator.py'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=BASE, text=True)
    stdout, stderr = proc.communicate(json.dumps(parsed), timeout=120000)
    if proc.returncode != 0:
        raise RuntimeError('point_calculator failed: ' + stderr)
    calc = json.loads(stdout)
    totals = defaultdict(float)
    for a in calc:
        t = a.get('team','UNKNOWN')
        pts = a.get('calculated_points')
        try:
            val = float(pts) if pts!='N/A' else 0.0
        except Exception:
            val = 0.0
        gender = a.get('gender')
        totals[(t, gender)] += val
    return totals


def match_team_name(computed_name, official_names):
    # exact or substring
    low = computed_name.lower()
    for o in official_names:
        if low == o.lower() or low in o.lower() or o.lower() in low:
            return o
    # fuzzy match via difflib
    matches = difflib.get_close_matches(computed_name, official_names, n=1, cutoff=0.6)
    if matches:
        return matches[0]
    # try token overlap
    comp_tokens = set([t for t in re.split(r'\W+', computed_name.lower()) if t])
    best = None
    best_score = 0
    for o in official_names:
        otoks = set([t for t in re.split(r'\W+', o.lower()) if t])
        score = len(comp_tokens & otoks)
        if score > best_score:
            best_score = score
            best = o
    if best_score >= 2:
        return best
    return None


for pdf in PDFS:
    path = os.path.join(BASE, pdf)
    if not os.path.exists(path):
        print(f"{pdf}: not found, skipping")
        continue
    print('\n===', pdf, '===')
    try:
        official_block = extract_official_from_last_pages(path, pages_to_scan=5)
    except Exception as e:
        print('Failed to read PDF:', e)
        continue
    if not official_block:
        print('No official ranking block found on last pages')
        continue
    official_names = [t for (_, t, _) in official_block]
    official_map = {t:pts for (_,t,pts) in official_block}

    # compute totals
    try:
        computed = compute_from_parser(path)
    except Exception as e:
        print('Computation failed:', e)
        continue

    # aggregate combined per team (both genders)
    comp_combined = defaultdict(float)
    for (team, gender), pts in computed.items():
        comp_combined[team] += pts

    print('\nOfficial (from PDF last pages):')
    for r,t,p in official_block:
        print(f"  {r}. {t} -> {p}")

    print('\nComputed totals (best matches):')
    matched_official = set()
    for team, comp_pts in sorted(comp_combined.items(), key=lambda x:-x[1]):
        match = match_team_name(team, official_names)
        if match:
            matched_official.add(match)
            off_pts = official_map.get(match)
            diff = comp_pts - off_pts
            print(f"  {team:40} | computed {comp_pts:8.1f} | official {off_pts:8} | diff {diff:8.1f} | matched-> {match}")
        else:
            print(f"  {team:40} | computed {comp_pts:8.1f} | official {'(none)':8} | diff {'(n/a)':8} | matched-> (none)")

    # show any official teams not matched
    print('\nOfficial teams not matched:')
    for t in official_names:
        if t not in matched_official:
            print('  ', t)

print('\nDone')
