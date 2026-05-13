import { execSync } from 'child_process';
import path from 'path';

const BASE = 'C:\\Users\\nihar\\Desktop\\remix_-omni-swim';
const pythonCmd = 'C:\\Users\\nihar\\AppData\\Local\\Programs\\Python\\Python311\\python.exe';

// Dump first 100 lines from each PDF
const pyScript = `
import pdfplumber

with pdfplumber.open(r'${BASE}\\2026_NSISC_Championships_Final_Results.pdf') as pdf:
    text = pdf.pages[0].extract_text(layout=True)
    lines = text.split('\\n')
    print("=== NSISC PAGE 0 (first 50 lines) ===")
    for i, line in enumerate(lines[:50]):
        print(f"{i}: [{repr(line)}]")
    
    # Also try without layout
    text2 = pdf.pages[0].extract_text()
    lines2 = text2.split('\\n')
    print("\\n=== NSISC PAGE 0 NO LAYOUT (first 30 lines) ===")
    for i, line in enumerate(lines2[:30]):
        print(f"{i}: [{repr(line)}]")

with pdfplumber.open(r'${BASE}\\2026_acc_championship_full_meet_results_1col.pdf') as pdf:
    text = pdf.pages[0].extract_text(layout=True)
    lines = text.split('\\n')
    print("\\n=== ACC PAGE 0 LAYOUT (first 50 lines) ===")
    for i, line in enumerate(lines[:50]):
        print(f"{i}: [{repr(line)}]")
    
    # Also try without layout
    text2 = pdf.pages[0].extract_text()
    lines2 = text2.split('\\n')
    print("\\n=== ACC PAGE 0 NO LAYOUT (first 30 lines) ===")
    for i, line in enumerate(lines2[:30]):
        print(f"{i}: [{repr(line)}]")
`;

try {
  const result = execSync(`"${pythonCmd}" -c "${pyScript.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`, {
    encoding: 'utf8',
    timeout: 30000,
    cwd: BASE
  });
  console.log(result);
} catch (e) {
  console.error('Error:', e.message);
  console.log('stdout:', e.stdout);
  console.log('stderr:', e.stderr);
}