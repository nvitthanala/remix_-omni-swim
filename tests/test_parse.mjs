import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.join(__dirname, '..');

function resolvePython() {
  const win = process.platform === 'win32';
  const venvPy = win
    ? path.join(BASE, 'venv', 'Scripts', 'python.exe')
    : path.join(BASE, 'venv', 'bin', 'python3');
  if (fs.existsSync(venvPy)) return venvPy;
  return win ? 'python' : 'python3';
}

function runPython(pdfFile) {
  try {
    const pythonCmd = resolvePython();
    const scriptPath = path.join(BASE, 'backend', 'pdf_parser.py');
    const pdfPath = path.join(BASE, pdfFile);
    const result = execSync(`"${pythonCmd}" "${scriptPath}" "${pdfPath}"`, {
      encoding: 'utf8',
      timeout: 60000,
      cwd: BASE,
      env: { ...process.env, OMNI_PROJECT_ROOT: BASE, OMNI_DATA_DIR: path.join(BASE, 'data') },
    });
    return JSON.parse(result.trim());
  } catch (e) {
    console.error(`Failed on ${pdfFile}:`, e.message?.substring(0, 200));
    if (e.stdout) console.error('stdout:', e.stdout.substring(0, 500));
    if (e.stderr) console.error('stderr:', e.stderr.substring(0, 500));
    return null;
  }
}

const pdfs = [
  '2026_acc_championship_full_meet_results_1col.pdf',
  '2026_NSISC_Championships_Final_Results.pdf',
  'glvc_results26.pdf',
  'Big_12_S_D_Champ_Results_pdf.pdf',
  '2026_sec_complete_results.pdf',
];

for (const pdf of pdfs) {
  if (!fs.existsSync(path.join(BASE, pdf))) {
    console.log(`=== ${pdf} ===`);
    console.log('FILE NOT FOUND, SKIPPING');
    console.log();
    continue;
  }

  console.log(`=== ${pdf} ===`);
  const result = runPython(pdf);
  if (result && result.length > 0) {
    const teams = new Set(result.map((r) => r.team));
    const genders = {};
    result.forEach((r) => {
      genders[r.gender] = (genders[r.gender] || 0) + 1;
    });
    const events = new Set(result.map((r) => r.event));

    console.log(`Total athletes: ${result.length}`);
    console.log(`Events: ${events.size}`);
    console.log(`Teams (${teams.size}):`, Array.from(teams).sort());
    console.log(`Genders:`, JSON.stringify(genders));

    for (const g of ['Men', 'Women']) {
      const swimmers = result.filter((r) => r.gender === g);
      if (swimmers.length > 0) {
        console.log(`\n${g} swimmers (first 5):`);
        swimmers.slice(0, 5).forEach((s) =>
          console.log(`  ${s.name} - ${s.team} - ${s.event} - ${s.finals_time || s.prelims_time || 'NT'}`),
        );
      }
    }
  } else if (result) {
    console.log('No athletes parsed (empty result)');
    console.log('Result:', JSON.stringify(result));
  } else {
    console.log('Failed to parse');
  }
  console.log();
}
