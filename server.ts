/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { v4 as uuidv4 } from 'uuid';
import { spawn, execSync } from 'child_process';
import { Gender, ClassYear, SwimmerResult, Workspace, ScoringSettings } from './src/types';

const PORT = 3000;
const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.dirname(__filename);
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const MEETS_FILE = path.join(DATA_DIR, 'meets.json');
const SCORING_PRESETS_DIR = path.join(DATA_DIR, 'scoring_presets');
const SCORING_SETTINGS_FILE = path.join(DATA_DIR, 'scoring_settings.json');
const PDF_PARSER_SCRIPT = path.join(PROJECT_ROOT, 'backend', 'pdf_parser.py');
const POINT_CALCULATOR_SCRIPT = path.join(PROJECT_ROOT, 'backend', 'point_calculator.py');

const PRESET_META_KEYS = new Set(['id', 'label', 'description']);

function loadScoringPresetFile(presetId: string): Record<string, unknown> | null {
  const safeId = presetId.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(SCORING_PRESETS_DIR, `${safeId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
}

function stripPresetMeta(raw: Record<string, unknown>) {
  const settings: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!PRESET_META_KEYS.has(k)) settings[k] = v;
  }
  return settings;
}

function loadDefaultScoringSettings(): ScoringSettings {
  const generic = loadScoringPresetFile('generic-top16');
  if (generic) return stripPresetMeta(generic) as unknown as ScoringSettings;
  if (fs.existsSync(SCORING_SETTINGS_FILE)) {
    return JSON.parse(fs.readFileSync(SCORING_SETTINGS_FILE, 'utf-8')) as ScoringSettings;
  }
  return {
    scoringPoints: [20, 17, 16, 15, 14, 13, 12, 11, 9, 7, 6, 5, 4, 3, 2, 1],
    relayMultiplier: 2,
    halfRateRelaySwimmer: true,
    maxIndividualScorersPerTeam: 999,
    maxRelaysScoringPerTeam: 999,
    aFinalBracketSize: 8,
    scorerCapScope: 'event',
    diverScorerWeight: 1,
    relayEligibleFromScorerPool: false,
  };
}

const defaultScoringSettings = loadDefaultScoringSettings();

function migrateLegacyDataPaths() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const legacyMeets = path.join(PROJECT_ROOT, 'meets.json');
    if (fs.existsSync(legacyMeets)) {
      fs.renameSync(legacyMeets, MEETS_FILE);
    }
    const legacyScoring = path.join(PROJECT_ROOT, 'scoring_settings.json');
    const scoringInData = path.join(DATA_DIR, 'scoring_settings.json');
    if (fs.existsSync(legacyScoring) && !fs.existsSync(scoringInData)) {
      fs.renameSync(legacyScoring, scoringInData);
    }
  } catch (e) {
    console.warn('Legacy data path migration skipped:', e);
  }
}

async function runPythonScript(scriptPath: string, args: string[], stdin?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const venvPython =
      process.platform === 'win32'
        ? path.join(PROJECT_ROOT, 'venv', 'Scripts', 'python')
        : path.join(PROJECT_ROOT, 'venv', 'bin', 'python');
    const pythonCmd = fs.existsSync(venvPython) ? venvPython : process.platform === 'win32' ? 'python' : 'python3';
    const spawnEnv = {
      ...process.env,
      OMNI_PROJECT_ROOT: PROJECT_ROOT,
      OMNI_DATA_DIR: DATA_DIR,
    };

    let proc;
    try {
      proc = spawn(pythonCmd, [scriptPath, ...args], {
        cwd: PROJECT_ROOT,
        env: spawnEnv,
      });
    } catch (err) {
      return reject(new Error(`Failed to spawn Python process: ${err}`));
    }

    let output = '';
    let errorOutput = '';
    let resolved = false;

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Python process error: ${err.message}`));
      }
    });

    proc.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        // Include partial stdout/stderr in error message even on non-zero exit
        const errMsg = errorOutput || output.substring(0, 500);
        if (code !== 0) {
          reject(new Error(`Python script failed with code ${code}\nError: ${errMsg}`));
        } else {
          resolve(output);
        }
      }
    });

    if (stdin) {
      // Handle stdin errors (e.g. write EOF when python process exits early)
      proc.stdin.on('error', (err) => {
        console.error('Python stdin error:', err.message);
      });
      // Write stdin with proper backpressure handling to avoid "write EOF" errors
      // on large payloads.  This is critical because Node's pipe can overflow if the
      // Python process isn't ready to consume data immediately.
      const writeStdin = () => {
        try {
          const canContinue = proc.stdin.write(stdin, 'utf-8', (writeErr) => {
            if (writeErr) {
              if (!resolved) {
                resolved = true;
                reject(new Error(`Failed to write to Python stdin: ${writeErr.message}`));
              }
              return;
            }
            // After write completes successfully, end the stream.
            proc.stdin.end();
          });
          if (!canContinue) {
            // If the internal buffer is full, wait for drain event before ending.
            proc.stdin.once('drain', () => {
              proc.stdin.end();
            });
          }
        } catch (e) {
          console.error('Error during proc.stdin.write:', e);
        }
      };
      // Use setImmediate to ensure the process event loop is ready before writing
      setImmediate(writeStdin);
    }
  });
}

async function startServer() {
  migrateLegacyDataPaths();

  // Ensure pdfplumber is installed in a venv
  try {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const venvPath = path.join(PROJECT_ROOT, 'venv');
    if (!fs.existsSync(venvPath)) {
      console.log('Creating virtual environment...');
      execSync(`${pythonCmd} -m venv venv`, { stdio: 'ignore', cwd: PROJECT_ROOT });
    }

    const venvPython = process.platform === 'win32' ? path.join(venvPath, 'Scripts', 'python') : path.join(venvPath, 'bin', 'python');
    try {
      execSync(`${venvPython} -c "import pdfplumber"`, { stdio: 'ignore', cwd: PROJECT_ROOT });
    } catch (e) {
      console.log('Installing pdfplumber in venv...');
      const pipCmd = process.platform === 'win32' ? path.join(venvPath, 'Scripts', 'pip') : path.join(venvPath, 'bin', 'pip');
      execSync(`${pipCmd} install pdfplumber`, { stdio: 'inherit', cwd: PROJECT_ROOT });
    }
  } catch (err) {
    console.error('Warning: Could not set up Python virtual environment.', err);
  }

  const app = express();
  app.use(express.json({ limit: '50mb' }));

  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Ensure meets.json exists
  if (!fs.existsSync(MEETS_FILE)) {
    const initialWorkspace = {
      id: uuidv4(),
      name: 'Blank Workspace 1',
      menResults: [],
      womenResults: [],
      recruits: [],
      deletedSwimmers: [],
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
      deletedSwimmers: [],
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

  app.get('/api/scoring-presets', (_req, res) => {
    try {
      if (!fs.existsSync(SCORING_PRESETS_DIR)) {
        return res.json([]);
      }
      const files = fs.readdirSync(SCORING_PRESETS_DIR).filter(f => f.endsWith('.json'));
      const list = files.map(f => {
        const raw = JSON.parse(fs.readFileSync(path.join(SCORING_PRESETS_DIR, f), 'utf-8')) as Record<
          string,
          unknown
        >;
        const id = (raw.id as string) || f.replace(/\.json$/, '');
        return {
          id,
          label: (raw.label as string) || id,
          description: (raw.description as string) || undefined,
        };
      });
      res.json(list);
    } catch (err) {
      res.status(500).json({ error: 'Failed to list scoring presets', details: String(err) });
    }
  });

  app.get('/api/scoring-presets/:id', (req, res) => {
    try {
      const raw = loadScoringPresetFile(req.params.id);
      if (!raw) return res.status(404).json({ error: 'Preset not found' });
      res.json(stripPresetMeta(raw));
    } catch (err) {
      res.status(500).json({ error: 'Failed to load preset', details: String(err) });
    }
  });

  app.delete('/api/workspaces/:id', (req, res) => {
    const workspaces = JSON.parse(fs.readFileSync(MEETS_FILE, 'utf-8'));
    const filtered = workspaces.filter((w: Workspace) => w.id !== req.params.id);
    fs.writeFileSync(MEETS_FILE, JSON.stringify(filtered, null, 2));
    res.json({ success: true });
  });

  app.post('/api/parse-pdf', async (req, res) => {
    const tempFile = path.join(PROJECT_ROOT, `temp_${Date.now()}.pdf`);
    let responseSent = false;

    try {
      const { base64, format } = req.body;
      if (!base64) {
        responseSent = true;
        return res.status(400).json({ error: 'No base64 PDF data provided' });
      }

      let buffer;
      try {
        buffer = Buffer.from(base64, 'base64');
      } catch (err) {
        responseSent = true;
        return res.status(400).json({ error: 'Invalid base64 encoding' });
      }

      try {
        fs.writeFileSync(tempFile, buffer);
      } catch (err) {
        responseSent = true;
        return res.status(500).json({ error: 'Failed to save PDF file', details: String(err) });
      }

      // Run pdf parser
      let parserOutput;
      try {
        parserOutput = await runPythonScript(PDF_PARSER_SCRIPT, [tempFile, format || 'auto']);
      } catch (err) {
        responseSent = true;
        return res.status(500).json({ error: 'PDF parsing failed', details: String(err) });
      }

      // Check if parser returned an error object
      try {
        const parsedJson = JSON.parse(parserOutput.trim());
        if (!Array.isArray(parsedJson) && parsedJson.error) {
          responseSent = true;
          return res.status(500).json({ error: 'PDF parsing failed', details: parsedJson.error });
        }
      } catch (e: any) {
        if (!(e instanceof SyntaxError)) {
          responseSent = true;
          return res.status(500).json({ error: 'PDF parsing failed', details: String(e) });
        }
        console.warn("Parser output was not valid JSON:", parserOutput.substring(0, 100));
      }

      // Write current scoring settings for Python calculator to read
      try {
        const workspaces = JSON.parse(fs.readFileSync(MEETS_FILE, 'utf-8'));
        const ws = workspaces && workspaces[0] ? workspaces[0] : null;
        const scoring = ws && ws.scoringSettings ? ws.scoringSettings : defaultScoringSettings;
        const scoringPayload = {
          ...scoring,
          scorerRosterOverrides: (ws && ws.scorerRosterOverrides) || [],
        };
        fs.writeFileSync(SCORING_SETTINGS_FILE, JSON.stringify(scoringPayload, null, 2));
      } catch (e) {
        console.warn('Could not write data/scoring_settings.json, using defaults.');
      }

      // Run point calculator
      let calcOutput;
      try {
        calcOutput = await runPythonScript(POINT_CALCULATOR_SCRIPT, [], parserOutput);
      } catch (err) {
        responseSent = true;
        return res.status(500).json({ error: 'Points calculation failed', details: String(err) });
      }

      let athletes;
      try {
        athletes = JSON.parse(calcOutput);
      } catch (err) {
        responseSent = true;
        return res.status(500).json({ error: 'Invalid calculation output', details: String(err) });
      }

      if (!Array.isArray(athletes)) {
        const errMsg =
          athletes && typeof athletes === 'object' && 'error' in athletes
            ? String((athletes as { error: unknown }).error)
            : 'Points calculator did not return an athlete list';
        responseSent = true;
        return res.status(500).json({ error: 'Points calculation failed', details: errMsg });
      }

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
        isRelay: Boolean(a.is_relay) || /\brelay\b/i.test(String(a.event || '')),
        isExhibition: a.is_exhibition,
        isTimeTrial: a.is_time_trial,
        relayNames: a.relay_names || [],
        relayLegIndex: a.relay_leg_index,
        relayLegStroke: a.relay_leg_stroke,
        relayLegSplit: a.relay_leg_split,
        relayTeamTime: a.relay_team_time,
      }));

      const conference =
        athletes.length > 0 && typeof athletes[0].conference === 'string'
          ? athletes[0].conference
          : undefined;

      responseSent = true;
      res.json({ results, conference });
    } catch (error: any) {
      console.error('PDF Parse Error:', error);
      if (!responseSent) {
        responseSent = true;
        res.status(500).json({ error: 'Failed to parse PDF', details: error.message });
      }
    } finally {
      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
      } catch (err) {
        console.warn('Failed to clean up temp PDF file:', err);
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      root: PROJECT_ROOT,
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(PROJECT_ROOT, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Express Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', details: err.message });
    }
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Handle server errors
  server.on('error', (err) => {
    console.error('Server error:', err);
  });

  // Handle socket errors
  server.on('clientError', (err, socket) => {
    console.error('Client error:', err);
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
  });
}

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

startServer();
