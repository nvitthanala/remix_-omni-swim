import pdfplumber
import os

base = r"C:\Users\nihar\Desktop\remix_-omni-swim"
os.chdir(base)

with pdfplumber.open("2026_NSISC_Championships_Final_Results.pdf") as pdf:
    text = pdf.pages[0].extract_text(layout=True)
    lines = text.split("\n")
    with open("debug_nsisc.txt", "w") as f:
        f.write("=== NSISC PAGE 0 LAYOUT (first 50 lines) ===\n")
        for i, line in enumerate(lines[:50]):
            f.write(f"{i}: [{repr(line)}]\n")
    
    # Also without layout
    text2 = pdf.pages[0].extract_text()
    lines2 = text2.split("\n")
    f = open("debug_nsisc.txt", "a")
    f.write("\n=== NSISC PAGE 0 NO LAYOUT (first 30 lines) ===\n")
    for i, line in enumerate(lines2[:30]):
        f.write(f"{i}: [{repr(line)}]\n")
    f.close()

with pdfplumber.open("2026_acc_championship_full_meet_results_1col.pdf") as pdf:
    text = pdf.pages[0].extract_text(layout=True)
    lines = text.split("\n")
    with open("debug_acc.txt", "w") as f:
        f.write("=== ACC PAGE 0 LAYOUT (first 50 lines) ===\n")
        for i, line in enumerate(lines[:50]):
            f.write(f"{i}: [{repr(line)}]\n")
    
    # Also without layout
    text2 = pdf.pages[0].extract_text()
    lines2 = text2.split("\n")
    f = open("debug_acc.txt", "a")
    f.write("\n=== ACC PAGE 0 NO LAYOUT (first 30 lines) ===\n")
    for i, line in enumerate(lines2[:30]):
        f.write(f"{i}: [{repr(line)}]\n")
    f.close()

print("Done writing debug files")