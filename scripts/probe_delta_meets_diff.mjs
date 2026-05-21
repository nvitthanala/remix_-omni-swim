import { readFileSync } from 'fs';
import { calculatePoints, mergeScoringSettings } from '../src/lib/utils.ts';

const ws = JSON.parse(readFileSync('data/meets.json', 'utf8')).find(m => m.conference === 'NSISC');
const settings = mergeScoringSettings(ws.scoringSettings, { conference: ws.conference });
const men = ws.menResults ?? [];
const scored = calculatePoints(men, settings, { scorerRosterOverrides: ws.scorerRosterOverrides });
const team = 'Delta State University';

const scoredById = new Map(scored.map(r => [r.id, r]));
let calcTotal = 0;
let storedTotal = 0;
const diffs = [];

for (const r of men.filter(x => x.team === team)) {
  const n = String(r.name ?? '').toLowerCase();
  const tm = String(r.team ?? '').toLowerCase();
  if (n && n === tm) continue;

  const got = typeof scoredById.get(r.id)?.points === 'number' ? scoredById.get(r.id).points : 0;
  const off = typeof r.points === 'number' ? r.points : 0;
  calcTotal += got;
  storedTotal += off;

  if (Math.abs(got - off) > 0.01) {
    diffs.push({
      got,
      stored: off,
      delta: got - off,
      name: r.name,
      rank: r.rank,
      round: r.roundSwam,
      event: (r.event || '').replace(/^Event \d+ Men /, '').slice(0, 45),
    });
  }
}

console.log('Delta men — calculated total:', calcTotal.toFixed(2));
console.log('Delta men — stored in meets.json:', storedTotal.toFixed(2));
console.log('Official target: 875.5');
console.log('Row diffs (calc vs stored):', diffs.length);
diffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
for (const d of diffs.slice(0, 20)) {
  console.log(JSON.stringify(d));
}
if (diffs.length > 20) console.log(`... and ${diffs.length - 20} more`);
