import pdfplumber
import os
import re

base = r"C:\Users\nihar\Desktop\remix_-omni-swim"
os.chdir(base)

YEAR_PATTERN = r'\b(FR|SO|JR|SR|5Y|FY|GS|GR)\b'

with pdfplumber.open("glvc_results26.pdf") as pdf:
    # Check pages that have individual swimming events (not just relays)
    # Let's find pages with year markers (FR, SO, JR, SR)
    for pg in range(min(10, len(pdf.pages))):
        text = pdf.pages[pg].extract_text(layout=True)
        lines = text.split("\n")
        has_year = any(re.search(YEAR_PATTERN, l) for l in lines)
        if has_year:
            print(f"\n=== Page {pg} (layout=True, first 40 lines with year markers) ===")
            count = 0
            for line in lines:
                if re.search(YEAR_PATTERN, line) or re.match(r'^\d+\s+[A-Z]', line):
                    print(f"  [{repr(line.strip())}]")
                    count += 1
                    if count >= 25:
                        break

    # Also check what the "no layout" output looks like for individual events
    print("\n\n=== Page with individual events (no layout) ===")
    for pg in range(3, min(8, len(pdf.pages))):
        text = pdf.pages[pg].extract_text()
        lines = text.split("\n")
        has_yr = any(re.search(YEAR_PATTERN, l) for l in lines[:30])
        if has_yr:
            print(f"\n--- Page {pg} no-layout (first 25 lines) ---")
            for line in lines[:25]:
                print(f"  [{repr(line.strip())}]")
            break

print("\nTotal pages:", len(pdf.pages))