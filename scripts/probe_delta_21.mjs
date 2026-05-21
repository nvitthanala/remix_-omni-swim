import { readFileSync } from 'fs';
import {
  calculatePoints,
  mergeScoringSettings,
  isRelayResult,
  isDivingEvent,
  classifyRoundTier,
  parseRankInt,
} from '../src/lib/utils.ts';

const meets = JSON.parse(readFileSync('data/meets.json', 'utf8'));
const ws = meets.find(m => m.conference === 'NSISC');
const settings = mergeScoringSettings(ws.scoringSettings, { conference: ws.conference });
const men = ws.menResults ?? [];
const scored = calculatePoints(men, settings, { scorerRosterOverrides: ws.scorerRosterOverrides });
const team = 'Delta State University';
const pts = settings.scoringPoints;
const mult = settings.relayMultiplier ?? 2;
const bracket = settings.aFinalBracketSize ?? 8;

function expectedPoints(r) {
  const rk = parseRankInt(r.rank);
  if (!rk) return null;
  const tier = classifyRoundTier(r.roundSwam);
  if (isRelayResult(r)) {
    let idx = rk - 1;
    if (tier === 'B' && rk <= bracket) idx = bracket + (rk - 1);
    return (pts[idx] ?? 0) * mult;
  }
  if (tier === 'B' && rk <= bracket) return pts[bracket + rk - 1] ?? null;
  return pts[rk - 1] ?? null;
}

let shortfall = 0;
for (const r of scored) {
  if (r.team !== team) continue;
  const got = typeof r.points === 'number' ? r.points : 0;
  if (got === 0) continue;
  const exp = expectedPoints(r);
  if (exp == null) continue;
  const gotTeam = isRelayResult(r) ? got * 4 : got;
  const diff = exp - gotTeam;
  if (diff > 0.01) {
    shortfall += diff;
    console.log('short', diff.toFixed(2), 'got', gotTeam, 'exp', exp, r.name, r.roundSwam, 'rk', r.rank, (r.event || '').slice(-35));
  }
}

console.log('Total shortfall from ties:', shortfall.toFixed(2));

// Time trials with rank
let ttSum = 0;
for (const r of men) {
  if (r.team !== team || !r.isTimeTrial) continue;
  const rk = parseRankInt(r.rank);
  if (!rk || rk > 16) continue;
  const got = scored.find(s => s.id === r.id)?.points ?? 0;
  if (got === 0) {
    const would = pts[rk - 1] ?? 0;
    ttSum += would;
    console.log('TT zero', r.name, would, (r.event || '').slice(-40));
  }
}
console.log('TT would add', ttSum);

// Diving prelim only (no A final same event)
function hasAFinalDive(name, eventNum) {
  return men.some(
    m =>
      m.name === name &&
      m.team === team &&
      isDivingEvent(m.event, settings.diverEventPattern) &&
      classifyRoundTier(m.roundSwam) === 'A' &&
      m.event?.includes(eventNum)
  );
}

let divePrelim = 0;
for (const r of men) {
  if (r.team !== team) continue;
  if (!isDivingEvent(r.event, settings.diverEventPattern)) continue;
  if (classifyRoundTier(r.roundSwam) !== 'PRE') continue;
  const rk = parseRankInt(r.rank);
  if (!rk || rk > 16) continue;
  const m = r.event?.match(/Event (\d+)/);
  const evNum = m?.[1];
  if (evNum && hasAFinalDive(r.name, `Event ${evNum}`)) continue;
  const would = pts[rk - 1] ?? 0;
  divePrelim += would;
  console.log('dive prelim only', r.name, would, r.event);
}
console.log('dive prelim only sum', divePrelim);
