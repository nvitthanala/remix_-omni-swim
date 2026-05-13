import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

(async () => {
    try {
        let dataBuffer = fs.readFileSync('2026_NSISC_Championships_Final_Results.pdf');
        let data = await pdfParse(dataBuffer);
        fs.writeFileSync('nsisc_text.txt', data.text);
        console.log('NSISC done');
        
        let dataBuffer2 = fs.readFileSync('2026_acc_championship_full_meet_results_1col.pdf');
        let data2 = await pdfParse(dataBuffer2);
        fs.writeFileSync('acc_text.txt', data2.text);
        console.log('ACC done');
    } catch(e) { console.log(e); }
})();
