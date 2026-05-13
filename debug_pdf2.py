import pdfplumber
import os

base = r"C:\Users\nihar\Desktop\remix_-omni-swim"
os.chdir(base)

with pdfplumber.open("2026_acc_championship_full_meet_results_1col.pdf") as pdf:
    # Page 6 has Event 5 (Women 200 Medley Relay) - swimming event
    text = pdf.pages[5].extract_text()
    lines = text.split("\n")
    with open("debug_acc_page6.txt", "w") as f:
        f.write(f"=== ACC PAGE 6 (first 60 lines, no layout) ===\n")
        for i, line in enumerate(lines[:60]):
            f.write(f"{i}: [{repr(line)}]\n")

    # Page 17 has Event 13 (Women 500 Free) - swimming individual event  
    text = pdf.pages[16].extract_text()
    lines = text.split("\n")
    f = open("debug_acc_page17.txt", "w")
    f.write(f"=== ACC PAGE 17 (first 60 lines, no layout) ===\n")
    for i, line in enumerate(lines[:60]):
        f.write(f"{i}: [{repr(line)}]\n")
    f.close()

with pdfplumber.open("2026_NSISC_Championships_Final_Results.pdf") as pdf:
    # Page for individual swimming event (Event 5 Women 200 IM)
    text = pdf.pages[7].extract_text()
    lines = text.split("\n")
    with open("debug_nsisc_page8.txt", "w") as f:
        f.write(f"=== NSISC PAGE 8 (first 60 lines, no layout) ===\n")
        for i, line in enumerate(lines[:60]):
            f.write(f"{i}: [{repr(line)}]\n")

print("Done")