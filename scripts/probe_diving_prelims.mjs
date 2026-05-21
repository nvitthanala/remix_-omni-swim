import { readFileSync } from 'fs';
import {
  calculatePoints,
  mergeScoringSettings,
  isDivingEvent,
  classifyRoundTier,
  isRelayResult,
} from '../src/lib/utils.ts';

const meets = JSON.parse(readFileSync('data/meets.json', 'utf8'));
const ws = meets.find(m => m.conference === 'NSISC');
const settings = mergeScoringSettings(ws.scoringSettings, { conference: ws.conference });
const men = ws.menResults ?? [];
const scored = calculatePoints(men, settings, { scorerRosterOverrides: ws.scorerRosterOverrides });
const team = 'Delta State University';
const pts = settings.scoringPoints;

console.log('=== Delta: all 0-pt rows with rank 9-16 in scoreable rounds ===');
let sum = 0;
for (const r of men) {
  if (r.team !== team) continue;
  const rk = parseInt(String(r.rank), 10);
  if (!rk || rk < 9 || rk > 16) continue;
  const got = scored.find(s => s.id === r.id)?.points ?? 0;
  if (got !== 0) continue;
  const tier = classifyRoundTier(r.roundSwam);
  if (tier === 'TT' || tier === 'C' || tier === 'D') continue;
  if (tier === 'PRE' && !isDivingEvent(r.event, settings.diverEventPattern)) continue;

  let would = 0;
  if (isRelayResult(r)) {
    const idx = tier === 'B' && rk <= 8 ? 8 + (rk - 1) : rk - 1;
    would = (pts[idx] ?? 0) * (settings.relayMultiplier ?? 2);
  } else if (tier === 'B' && rk <= 8) {
    would = pts[8 + (rk - 1)] ?? 0;
  } else if (tier === 'B' && rk > 8) {
    would = pts[rk - 1] ?? 0;
  } else {
    would = pts[rk - 1] ?? 0;
  }
  sum += would;
  console.log(
    isRelayResult(r) ? 'R' : 'I',
    tier,
    r.roundSwam,
    'rk',
    rk,
    (r.event || '').replace(/^Event \d+ Men /, '').slice(0, 28),
    'would',
    would,
    isDivingEvent(r.event, settings.diverEventPattern) ? 'DIVE' : ''
  );
}
console.log('Total would:', sum);
