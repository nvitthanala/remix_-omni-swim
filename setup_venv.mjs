import { execSync } from 'child_process';

try {
  console.log('setup');
  execSync('python3 -m venv venv', { stdio: 'inherit' });
  execSync('venv/bin/pip install pdfplumber', { stdio: 'inherit' });
} catch (e) {
  console.error(e);
}
