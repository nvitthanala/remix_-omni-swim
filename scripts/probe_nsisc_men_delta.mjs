import { readFileSync } from 'fs';
import { calculatePoints, mergeScoringSettings, isRelayResult } from '../src/lib/utils.ts';

const meets = JSON.parse(readFileSync('data/meets.json', 'utf8'));
const ws = meets.find(m => m.conference === 'NSISC');
const base = mergeScoringSettings(ws.scoringSettings, { conference: ws.conference });
const men = ws.menResults ?? [];

function sumTeam(scored, team) {
  let t = 0;
  for (const r of scored) {
    if (r.team !== team) continue;
    const n = String(r.name ?? '').toLowerCase();
    const tm = String(r.team ?? '').toLowerCase();
    if (n && n === tm) continue;
    t += typeof r.points === 'number' ? r.points : 0;
  }
  return t;
}

const variants = [
  ['roster + overrides', base, ws.scorerRosterOverrides],
  ['roster no overrides', base, []],
  [
    'no caps',
    { ...base, maxIndividualScorersPerTeam: 999, maxRelaysScoringPerTeam: 999 },
    ws.scorerRosterOverrides,
  ],
  ['points_pool', { ...base, scorerEligibilityMode: 'points_pool' }, []],
];

for (const team of ['Ouachita Baptist University', 'Delta State University']) {
  const off = team.includes('Ouachita') ? 1029.5 : 875.5;
  console.log(`\n${team} (official ${off})`);
  for (const [label, settings, ov] of variants) {
    const scored = calculatePoints(men, settings, { scorerRosterOverrides: ov });
    console.log(`  ${label}: ${sumTeam(scored, team).toFixed(2)}`);
  }
}

const scored = calculatePoints(men, base, { scorerRosterOverrides: ws.scorerRosterOverrides });
for (const team of ['Ouachita Baptist University', 'Delta State University']) {
  const zeros = scored.filter(r => {
    if (r.team !== team) return false;
    const rk = parseInt(String(r.rank), 10);
    if (!rk || rk > 16) return false;
    if (r.isExhibition || r.isTimeTrial) return false;
    return (r.points ?? 0) === 0;
  });
  console.log(`\n${team}: ${zeros.length} ranked<=16 with 0 pts (sample)`);
  for (const r of zeros.slice(0, 15)) {
    console.log(
      ' ',
      isRelayResult(r) ? 'R' : 'I',
      'rk',
      r.rank,
      r.roundSwam,
      (r.event || '').replace(/^Event \d+ Men /, '').slice(0, 30),
      'time',
      r.time
    );
  }
}
