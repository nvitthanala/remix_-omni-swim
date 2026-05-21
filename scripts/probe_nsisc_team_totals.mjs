import { readFileSync } from 'fs';
import {
  calculatePoints,
  mergeScoringSettings,
  isRelayResult,
  looksLikeInstitutionTeamName,
  swimResultClock,
  isScoringSwimTime,
  isFinalsRound,
} from '../src/lib/utils.ts';
import { buildScorerRosterLookup } from '../src/lib/scorerRoster.ts';

const meets = JSON.parse(readFileSync('data/meets.json', 'utf8'));
const ws = meets.find(m => m.conference === 'NSISC');
const settings = mergeScoringSettings(ws.scoringSettings, { conference: ws.conference });

function analyzeTeam(genderLabel, results, team) {
  const scored = calculatePoints(results, settings, { scorerRosterOverrides: ws.scorerRosterOverrides });
  const lookup = buildScorerRosterLookup(results, settings, ws.scorerRosterOverrides);

  const missed = [];
  for (const r of scored) {
    if (r.team !== team) continue;
    const rk = parseInt(String(r.rank), 10);
    if (!rk || rk > 16) continue;
    if (r.isExhibition || r.isTimeTrial) continue;
    if (!(r.roundSwam || '').match(/Final/i)) continue;
    const pts = typeof r.points === 'number' ? r.points : 0;
    if (pts > 0) continue;

    const clock = swimResultClock(r);
    const isScorer = lookup.isScorer(r.name, team, r.gender);
    missed.push({
      name: r.name,
      event: (r.event || '').replace(/^Event \d+ (Men|Women) /, ''),
      round: r.roundSwam,
      rank: rk,
      relay: isRelayResult(r),
      clock,
      finalsOnlyBad: isFinalsRound(r.roundSwam) && !isScoringSwimTime(clock),
      isScorer,
    });
  }

  console.log(`\n--- ${genderLabel} ${team} (${missed.length} zero-pt finalists) ---`);
  let est = 0;
  const pts = settings.scoringPoints;
  const mult = settings.relayMultiplier ?? 2;
  for (const m of missed.sort((a, b) => b.rank - a.rank)) {
    let would = 0;
    if (m.relay) {
      const tier = (m.round || '').includes('B') ? 'B' : 'A';
      let idx = m.rank - 1;
      if (tier === 'B' && m.rank <= 8) idx = 8 + (m.rank - 1);
      if (m.rank > 8 && tier === 'B') idx = m.rank - 1;
      would = (pts[idx] ?? 0) * mult; // team relay pts
    } else {
      let idx = m.rank - 1;
      if ((m.round || '').includes('B') && m.rank <= 8) idx = 8 + (m.rank - 1);
      would = pts[idx] ?? 0;
    }
    if (m.finalsOnlyBad) est += m.relay ? would : would;
    console.log(
      m.relay ? 'RELAY' : 'INDIV',
      would.toFixed(1),
      'rk',
      m.rank,
      m.round,
      m.clock,
      m.finalsOnlyBad ? 'NON_SCORING_CLOCK' : '',
      !m.isScorer ? 'NOT_SCORER' : '',
      m.event.slice(0, 35)
    );
  }
  console.log('Rough pts if all missed counted (ignoring caps):', est);
}

analyzeTeam('Men', ws.menResults ?? [], 'Ouachita Baptist University');
analyzeTeam('Men', ws.menResults ?? [], 'Delta State University');

// Ouachita +18: find relays scoring 0
const scored = calculatePoints(ws.menResults ?? [], settings, { scorerRosterOverrides: ws.scorerRosterOverrides });
const ouRelay = scored.filter(
  r => r.team === 'Ouachita Baptist University' && isRelayResult(r) && r.points > 0
);
const ouRelayZero = scored.filter(
  r =>
    r.team === 'Ouachita Baptist University' &&
    isRelayResult(r) &&
    r.points === 0 &&
    (r.roundSwam || '').match(/Final/i) &&
    parseInt(String(r.rank), 10) <= 16
);
console.log('\nOuachita relay legs with points:', ouRelay.length / 4, 'units approx');
console.log('Ouachita zero relays in finals:', ouRelayZero.length / 4, 'units approx');
const units = new Map();
for (const r of ouRelay) {
  const k = `${r.event}|${r.roundSwam}|${r.rank}|${r.relayTeamTime}`;
  units.set(k, (units.get(k) ?? 0) + r.points * 4);
}
console.log('Ouachita relay team pts:', [...units.values()].sort((a, b) => b - a));

const zeroUnits = new Map();
for (const r of ouRelayZero) {
  const k = `${r.event}|${r.roundSwam}|${r.rank}|${r.relayTeamTime}`;
  if (!zeroUnits.has(k)) zeroUnits.set(k, r);
}
for (const [k, r] of zeroUnits) {
  const rk = parseInt(String(r.rank), 10);
  const tier = (r.roundSwam || '').includes('B') ? 'B' : 'A';
  let idx = rk - 1;
  if (tier === 'B' && rk <= 8) idx = 8 + (rk - 1);
  const teamPts = (settings.scoringPoints[idx] ?? 0) * (settings.relayMultiplier ?? 2);
  console.log('ZERO relay unit', teamPts, k.split('|')[0].slice(0, 45), r.roundSwam, 'rk', rk, swimResultClock(r));
}
