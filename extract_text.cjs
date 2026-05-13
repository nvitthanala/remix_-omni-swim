const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('2026_NSISC_Championships_Final_Results.pdf');

pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('nsisc_text.txt', data.text);
    console.log('NSISC done');
});

let dataBuffer2 = fs.readFileSync('2026_acc_championship_full_meet_results_1col.pdf');
pdf(dataBuffer2).then(function(data) {
    fs.writeFileSync('acc_text.txt', data.text);
    console.log('ACC done');
});
