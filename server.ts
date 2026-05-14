/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { v4 as uuidv4 } from 'uuid';
import { spawn, execSync } from 'child_process';
import { Gender, ClassYear, SwimmerResult, Workspace } from './src/types';

const PORT = 3000;
const MEETS_FILE = path.join(process.cwd(), 'meets.json');

async function runPythonScript(scriptPath: string, args: string[], stdin?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const venvPython = process.platform === 'win32' ? path.join(process.cwd(), 'venv', 'Scripts', 'python') : path.join(process.cwd(), 'venv', 'bin', 'python');
    const pythonCmd = fs.existsSync(venvPython) ? venvPython : (process.platform === 'win32' ? 'python' : 'python3');
    const proc = spawn(pythonCmd, [scriptPath, ...args]);
    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed with code ${code}\nError: ${errorOutput}`));
      } else {
        resolve(output);
      }
    });

    if (stdin) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    }
  });
}

const defaultScoringSettings = {
  scoringPoints: [20, 17, 16, 15, 14, 13, 12, 11, 9, 7, 6, 5, 4, 3, 2, 1],
  relayMultiplier: 2,
  halfRateRelaySwimmer: true,
  maxIndividualScorersPerTeam: 4,
  maxRelaysScoringPerTeam: 1,
};

async function startServer() {
  // Ensure pdfplumber is installed in a venv
  try {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const venvPath = path.join(process.cwd(), 'venv');
    if (!fs.existsSync(venvPath)) {
      console.log('Creating virtual environment...');
      execSync(`${pythonCmd} -m venv venv`, { stdio: 'ignore' });
    }
    
    const venvPython = process.platform === 'win32' ? path.join(venvPath, 'Scripts', 'python') : path.join(venvPath, 'bin', 'python');
    try {
      execSync(`${venvPython} -c "import pdfplumber"`, { stdio: 'ignore' });
    } catch (e) {
      console.log('Installing pdfplumber in venv...');
      const pipCmd = process.platform === 'win32' ? path.join(venvPath, 'Scripts', 'pip') : path.join(venvPath, 'bin', 'pip');
      execSync(`${pipCmd} install pdfplumber`, { stdio: 'inherit' });
    }
  } catch (err) {
    console.error('Warning: Could not set up Python virtual environment.', err);
  }

  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Ensure meets.json exists
  if (!fs.existsSync(MEETS_FILE)) {
    const initialWorkspace = {
      id: uuidv4(),
      name: 'Blank Workspace 1',
      menResults: [],
      womenResults: [],
      recruits: [],
      createdAt: Date.now(),
      scoringSettings: defaultScoringSettings,
    };
    fs.writeFileSync(MEETS_FILE, JSON.stringify([initialWorkspace], null, 2));
  }

  // API Routes
  app.get('/api/workspaces', (req, res) => {
    const data = JSON.parse(fs.readFileSync(MEETS_FILE, 'utf-8'));
    res.json(data);
  });

  app.post('/api/workspaces', (req, res) => {
    const workspaces = JSON.parse(fs.readFileSync(MEETS_FILE, 'utf-8'));
    const newWorkspace: Workspace = {
      id: uuidv4(),
      name: req.body.name || 'New Workspace',
      menResults: [],
      womenResults: [],
      recruits: [],
      createdAt: Date.now(),
      scoringSettings: defaultScoringSettings,
    };
    workspaces.push(newWorkspace);
    fs.writeFileSync(MEETS_FILE, JSON.stringify(workspaces, null, 2));
    res.json(newWorkspace);
  });

  app.put('/api/workspaces/:id', (req, res) => {
    const workspaces = JSON.parse(fs.readFileSync(MEETS_FILE, 'utf-8'));
    const index = workspaces.findIndex((w: Workspace) => w.id === req.params.id);
    if (index !== -1) {
      workspaces[index] = { ...workspaces[index], ...req.body };
      fs.writeFileSync(MEETS_FILE, JSON.stringify(workspaces, null, 2));
      res.json(workspaces[index]);
    } else {
      res.status(404).json({ error: 'Workspace not found' });
    }
  });

  app.delete('/api/workspaces/:id', (req, res) => {
    const workspaces = JSON.parse(fs.readFileSync(MEETS_FILE, 'utf-8'));
    const filtered = workspaces.filter((w: Workspace) => w.id !== req.params.id);
    fs.writeFileSync(MEETS_FILE, JSON.stringify(filtered, null, 2));
    res.json({ success: true });
  });

  app.post('/api/parse-pdf', async (req, res) => {
    const tempFile = path.join(process.cwd(), `temp_${Date.now()}.pdf`);
    try {
      const { base64 } = req.body;
      const buffer = Buffer.from(base64, 'base64');
      fs.writeFileSync(tempFile, buffer);

      // Run pdf parser
      const parserOutput = await runPythonScript('pdf_parser.py', [tempFile]);
      
      // Check if parser returned an error object
      try {
        const parsedJson = JSON.parse(parserOutput.trim());
        if (!Array.isArray(parsedJson) && parsedJson.error) {
          throw new Error(parsedJson.error); // Will be caught by outer block
        }
      } catch(e: any) {
        if (e instanceof SyntaxError) {
          console.warn("Parser output was not valid JSON:", parserOutput.substring(0, 100));
        } else {
          throw e; // Rethrow to outer block
        }
      }

      // Write current scoring settings for Python calculator to read
      try {
        const workspaces = JSON.parse(fs.readFileSync(MEETS_FILE, 'utf-8'));
        const ws = workspaces && workspaces[0] ? workspaces[0] : null;
        const scoring = ws && ws.scoringSettings ? ws.scoringSettings : defaultScoringSettings;
        fs.writeFileSync(path.join(process.cwd(), 'scoring_settings.json'), JSON.stringify(scoring, null, 2));
      } catch (e) {
        console.warn('Could not write scoring_settings.json, using defaults.');
      }

      // Run point calculator
      const calcOutput = await runPythonScript('point_calculator.py', [], parserOutput);

      const athletes = JSON.parse(calcOutput);
      
      // Map to frontend structure
      const results: SwimmerResult[] = athletes.map((a: any) => ({
        id: uuidv4(),
        rank: a.rank ? parseInt(a.rank) || 0 : 0,
        name: a.name,
        classYear: a.year || 'UNKNOWN',
        team: a.team,
        time: a.finals_time || a.prelims_time || 'NT',
        prelimsTime: a.prelims_time,
        finalsTime: a.finals_time,
        roundSwam: a.round_swam,
        points: a.calculated_points === 'N/A' ? 'N/A' : (a.calculated_points || 0),
        event: a.event,
        gender: a.gender === 'Women' ? Gender.WOMEN : Gender.MEN,
        isRelay: a.is_relay,
        isExhibition: a.is_exhibition,
        isTimeTrial: a.is_time_trial,
        relayNames: a.relay_names || []
      }));

      res.json({ results });
    } catch (error: any) {
      console.error('PDF Parse Error:', error);
      res.status(500).json({ error: 'Failed to parse PDF', details: error.message });
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
