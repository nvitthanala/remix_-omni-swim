import pdfplumber
import re
import sys
import os

PDFS = [
    '2026_acc_championship_full_meet_results_1col.pdf',
    '2026_NSISC_Championships_Final_Results.pdf',
    'glvc_results26.pdf',
    'Big_12_S_D_Champ_Results_pdf.pdf'
]

for pdf in PDFS:
    path = os.path.join(os.getcwd(), pdf)
    if not os.path.exists(path):
        print(pdf, 'NOT FOUND')
        continue
    print('\n===', pdf, '===')
    with pdfplumber.open(path) as pdfobj:
        lines = []
        for page in pdfobj.pages:
            tx = page.extract_text()
            if not tx: continue
            for l in tx.split('\n'):
                lines.append(l.strip())
    # find candidate team score lines blocks: look for consecutive lines like '1 Team Name 123'
    rank_line = re.compile(r'^\s*(\d{1,2})\s+(.{2,120}?)\s+(\d{1,4})$')
    blocks = []
    cur_block = []
    for l in lines:
        m = rank_line.match(l)
        if m:
            cur_block.append((int(m.group(1)), m.group(2).strip(), int(m.group(3))))
        else:
            if len(cur_block) >= 3:
                blocks.append(cur_block)
            cur_block = []
    if len(cur_block) >= 3:
        blocks.append(cur_block)

    if not blocks:
        print('No ranking blocks found')
        continue

    for b in blocks:
        print('\n--- Ranking block ---')
        for rank, team, pts in b:
            print(f"{rank}. {team} -> {pts}")

print('\nDone')
