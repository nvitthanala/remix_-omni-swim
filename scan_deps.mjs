import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import module from 'module';

console.log('===================================================');
console.log('[!] SCANNING CODEBASE FOR DEPENDENCIES...');
console.log('===================================================');

const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
const pipCmd = process.platform === 'win32' ? path.join('venv', 'Scripts', 'pip') : path.join('venv', 'bin', 'pip');

const builtinModules = new Set(module.builtinModules);

let pythonStdlib = new Set();
try {
  const output = execSync(`${pyCmd} -c "import sys; print(','.join(sys.stdlib_module_names))"`, { encoding: 'utf-8' });
  output.trim().split(',').forEach(m => pythonStdlib.add(m));
} catch (e) {
  const fallback = ['os', 'sys', 're', 'math', 'json', 'collections', 'datetime', 'time', 'subprocess', 'argparse', 'io', 'difflib', 'logging', 'tempfile', 'shutil', 'functools', 'importlib', 'pathlib', 'platform', 'types', 'concurrent', 'multiprocessing', 'warnings', 'traceback', 'colorsys', 'enum'];
  fallback.forEach(m => pythonStdlib.add(m));
}

function walkSync(dir, filelist = []) {
  if (dir.includes('node_modules') || dir.includes('venv') || dir.includes('.venv') || dir.includes('dist') || dir.includes('.git') || dir.includes('checkpoints')) {
    return filelist;
  }
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return filelist;
  }
  for (const file of files) {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      walkSync(filepath, filelist);
    } else {
      if (filepath.match(/\.(js|mjs|cjs|ts|tsx|jsx|py)$/)) {
        filelist.push(filepath);
      }
    }
  }
  return filelist;
}

const allFiles = walkSync(process.cwd());

const nodeDeps = new Set();
const pythonDeps = new Set();

const jsRegexes = [
  /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
  /import\s+['"]([^'"]+)['"]/g,
  /require\(['"]([^'"]+)['"]\)/g,
];

const pyRegexes = [
  /^import\s+([a-zA-Z0-9_]+)/gm,
  /^from\s+([a-zA-Z0-9_]+)/gm,
];

allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  if (file.endsWith('.py')) {
    pyRegexes.forEach(regex => {
      let match;
      while ((match = regex.exec(content)) !== null) {
        const mod = match[1].split('.')[0];
        if (!pythonStdlib.has(mod) && !fs.existsSync(path.join(process.cwd(), mod + '.py')) && !fs.existsSync(path.join(process.cwd(), mod))) {
          pythonDeps.add(mod);
        }
      }
    });
  } else {
    jsRegexes.forEach(regex => {
      let match;
      while ((match = regex.exec(content)) !== null) {
        let mod = match[1];
        if (!mod.startsWith('.') && !mod.startsWith('/')) {
          if (mod.startsWith('@')) {
            mod = mod.split('/').slice(0, 2).join('/');
          } else {
            mod = mod.split('/')[0];
          }
          if (!builtinModules.has(mod) && !mod.startsWith('node:')) {
            nodeDeps.add(mod);
          }
        }
      }
    });
  }
});

const pyDepsArray = Array.from(pythonDeps).filter(dep => {
  const isLocal = allFiles.some(f => f.endsWith(`/${dep}.py`) || f.endsWith(`\\${dep}.py`));
  return !isLocal && dep !== 'utils' && dep !== 'constants'; 
});

console.log('[OK] Scanned files. Found Node dependencies:', Array.from(nodeDeps));
console.log('[OK] Scanned files. Found Python dependencies:', pyDepsArray);

// Check node_modules and package.json
if (!fs.existsSync('node_modules')) {
  console.log('[!] node_modules not found. Running initial npm install...');
  execSync('npm install', { stdio: 'inherit' });
}

const pkgPath = path.join(process.cwd(), 'package.json');
let pkg = { dependencies: {}, devDependencies: {} };
if (fs.existsSync(pkgPath)) {
  pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
}

const missingNodeDeps = Array.from(nodeDeps).filter(dep => !pkg.dependencies[dep] && !pkg.devDependencies[dep]);

if (missingNodeDeps.length > 0) {
  console.log('[!] Installing missing Node dependencies:', missingNodeDeps);
  execSync(`npm install ${missingNodeDeps.join(' ')}`, { stdio: 'inherit' });
}

// Check venv and requirements.txt
if (!fs.existsSync('venv')) {
  console.log('[!] Python venv not found. Creating virtual environment...');
  execSync(`${pyCmd} -m venv venv`, { stdio: 'inherit' });
}

const reqPath = path.join(process.cwd(), 'requirements.txt');
let reqs = [];
if (fs.existsSync(reqPath)) {
  reqs = fs.readFileSync(reqPath, 'utf-8').split('\n').map(line => line.trim().split('==')[0].split('>')[0].split('<')[0]);
}

// Internal modules from some packages might leak, like pdfium_c, filter them out safely or assume pip handles ignores
const missingPyDeps = pyDepsArray.filter(dep => !reqs.includes(dep) && dep !== 'pdfium_c'); 

if (missingPyDeps.length > 0) {
  console.log('[!] Installing missing Python dependencies:', missingPyDeps);
  const appendStr = (reqs.length > 0 && fs.readFileSync(reqPath, 'utf-8').slice(-1) !== '\n' ? '\n' : '') + missingPyDeps.join('\n') + '\n';
  fs.appendFileSync(reqPath, appendStr);
}

console.log('[!] Syncing Python dependencies from requirements.txt...');
try {
  execSync(`${pipCmd} install -r requirements.txt`, { stdio: 'inherit' });
  console.log('[OK] Environment is fully synced and ready.');
} catch (e) {
  console.error('[Error] Failed to install python dependencies.', e.message);
}
