import { execSync } from 'child_process';
console.log(execSync('python3 test_pdfplumber.py').toString());
