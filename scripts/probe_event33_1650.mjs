import { readFileSync } from 'fs';
import { calculatePoints, mergeScoringSettings, parseRankInt } from '../src/lib/utils.ts';
import { buildScorerRosterLookup } from '../src/lib/scorerRoster.ts';

const ws = JSON.parse(readFileSync('data/meets.json', 'utf8')).find(m => m.conference === 'NSISC');
const settings = mergeScoringSettings(ws.scoringSettings, { conference: ws.conference });
const men = ws.menResults ?? [];
const scored = calculatePoints(men, settings, { scorerRosterOverrides: ws.scorerRosterOverrides });
const lookup = buildScorerRosterLookup(men, settings, ws.scorerRosterOverrides);
const pts = settings.scoringPoints;

const ev33 = men.filter(r => (r.event || '').includes('Event 33'));
console.log(`Event 33 rows: ${ev33.length}`);
console.log('--- per swimmer (raw → scored) ---');
for (const r of ev33.sort((a, b) => (parseRankInt(a.rank) ?? 99) - (parseRankInt(b.rank) ?? 99))) {
  const s = scored.find(x => x.id === r.id);
  const rk = parseRankInt(r.rank);
  const ladder = rk && rk <= pts.length ? pts[rk - 1] : null;
  console.log(
    JSON.stringify({
      rank: r.rank,
      name: r.name,
      team: r.team,
      round: r.roundSwam,
      exhibition: r.isExhibition,
      timeTrial: r.isTimeTrial,
      ladderPts: ladder,
      scoredPts: s?.points ?? null,
      rosterScorer: lookup.isScorer(r.name, r.team, r.gender),
    })
  );
}

const team = 'Delta State University';
const delta1650 = scored.filter(r => r.team === team && (r.event || '').includes('1650'));
console.log('\n--- Delta 1650 (any event label) ---');
for (const r of delta1650) {
  console.log(
    JSON.stringify({
      event: r.event,
      name: r.name,
      rank: r.rank,
      round: r.roundSwam,
      pts: r.points,
      scorer: lookup.isScorer(r.name, team, r.gender),
    })
  );
}
