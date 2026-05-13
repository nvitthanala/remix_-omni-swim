import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function run() {
  const pdfParse = require('pdf-parse');
  const buf1 = fs.readFileSync('2026_NSISC_Championships_Final_Results.pdf');
  const data1 = await pdfParse(buf1);
  fs.writeFileSync('nsisc_text.txt', data1.text);
  console.log('NSISC done');

  const buf2 = fs.readFileSync('2026_acc_championship_full_meet_results_1col.pdf');
  const data2 = await pdfParse(buf2);
  fs.writeFileSync('acc_text.txt', data2.text);
  console.log('ACC done');
}

run().catch(console.error);
