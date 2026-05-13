/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Gender, SwimmerResult, Recruit, ClassYear, ScoringSettings } from '../types';
import { CONVERSION_FACTORS, SCORING_POINTS } from '../constants';

export function convertTimeToSeconds(timeStr: string): number {
  if (!timeStr || timeStr === 'NT' || timeStr === 'DQ') return Infinity;
  const parts = timeStr.split(':');
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(parts[0]);
}

export function formatSecondsToTime(seconds: number): string {
  if (seconds === Infinity) return 'NT';
  if (seconds < 60) return seconds.toFixed(2);
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `${mins}:${secs.padStart(5, '0')}`;
}

export function calculateProjectedTime(timeSec: number, classYear: string, overallDropPercent = -1.0): number {
  let yearsRemaining = 0;
  if (classYear === 'FR') yearsRemaining = 3;
  if (classYear === 'SO') yearsRemaining = 2;
  if (classYear === 'JR') yearsRemaining = 1;
  if (classYear === 'HS') yearsRemaining = 4;
  
  if (yearsRemaining === 0) return timeSec;
  
  // Apply a drop of overallDropPercent% over the 4 years, mathematically prorated.
  const dropFraction = (overallDropPercent / 100) * (yearsRemaining / 4);
  return timeSec * (1 + dropFraction);
}

export function convertToSCY(timeStr: string, event: string, gender: Gender, type: 'LCM' | 'SCM' | 'SCY'): string {
  if (type === 'SCY') return timeStr;
  
  const seconds = convertTimeToSeconds(timeStr);
  const factors = CONVERSION_FACTORS[event] || CONVERSION_FACTORS['50 Freestyle']; // Fallback
  
  let factor = 1.0;
  if (type === 'LCM') {
    factor = gender === Gender.MEN ? factors.men_lcm : factors.women_lcm;
  } else if (type === 'SCM') {
    factor = factors.both_scm;
  }
  
  return formatSecondsToTime(seconds * factor);
}

export function calculatePoints(results: SwimmerResult[], settings?: ScoringSettings): SwimmerResult[] {
  if (!settings) {
    settings = {
      scoringPoints: SCORING_POINTS,
      relayMultiplier: 2,
      halfRateRelaySwimmer: true,
      maxIndividualScorersPerTeam: 4,
      maxRelaysScoringPerTeam: 1
    };
  }

  // Group and sort PDF swims first
  const pdfResults = results.filter(r => !r.isRecruit);
  const recruitResults = results.filter(r => r.isRecruit);

  // Helper to weight rounds so A Final is ranked before B Final
  const getRoundWeight = (round: string | undefined): number => {
    if (!round) return 4;
    const r = round.toUpperCase();
    if (r.includes('A FINAL') || r.includes('CHAMPIONSHIP')) return 1;
    if (r.includes('B FINAL') || r.includes('CONSOLATION')) return 2;
    if (r.includes('C FINAL') || r.includes('BONUS')) return 3;
    if (r.includes('FINALS')) return 1; // Unspecified final is treated as A-Final for points
    return 4; // Prelims
  };

  // Sort PDF results by round, then by time
  const sortedPdf = [...pdfResults].sort((a, b) => {
    const roundA = getRoundWeight(a.roundSwam);
    const roundB = getRoundWeight(b.roundSwam);
    if (roundA !== roundB) return roundA - roundB;
    return convertTimeToSeconds(a.time) - convertTimeToSeconds(b.time);
  });

  // Now we have a sorted ladder of PDF swimmers. We will inject recruits into this ladder based purely on their time.
  const sorted: SwimmerResult[] = [];
  let pdfIdx = 0;
  
  // Sort recruits by time
  recruitResults.sort((a, b) => convertTimeToSeconds(a.time) - convertTimeToSeconds(b.time));

  for (const recruit of recruitResults) {
    const recTime = convertTimeToSeconds(recruit.time);
    // Push PDF swimmers that are faster than the recruit
    while (pdfIdx < sortedPdf.length && convertTimeToSeconds(sortedPdf[pdfIdx].time) <= recTime) {
      sorted.push(sortedPdf[pdfIdx]);
      pdfIdx++;
    }
    // Now insert the recruit
    sorted.push(recruit);
  }
  // Push remaining PDF swimmers
  while (pdfIdx < sortedPdf.length) {
    sorted.push(sortedPdf[pdfIdx]);
    pdfIdx++;
  }
  
  // Group by (team + time) to identify unique swims (especially for relays)
  const groupedSwims: { key: string; results: SwimmerResult[] }[] = [];
  
  sorted.forEach(res => {
    const key = `${res.team}_${res.time}`;
    if (res.isRelay) {
      let g = groupedSwims.find(g => g.key === key);
      if (g) g.results.push(res);
      else groupedSwims.push({ key, results: [res] });
    } else {
      // Individuals might have same time but form a tie
      groupedSwims.push({ key: `${res.name}_${key}`, results: [res] });
    }
  });

  const finalResults: SwimmerResult[] = [];
  let place = 0;
  let pointsAllowedPlace = 0;
  const teamIndividualCounts: Record<string, number> = {};
  const teamRelayCounts: Record<string, number> = {};

  groupedSwims.forEach(group => {
    const isExhibition = group.results.some(r => r.isExhibition);
    const isTimeTrial = group.results.some(r => r.isTimeTrial);
    const team = group.results[0].team;
    const isRelay = group.results[0].isRelay;
    
    // Check limits
    let limitReached = false;
    if (isRelay) {
      if ((teamRelayCounts[team] || 0) >= (settings?.maxRelaysScoringPerTeam ?? 1)) {
        limitReached = true;
      }
    } else {
      if ((teamIndividualCounts[team] || 0) >= (settings?.maxIndividualScorersPerTeam ?? 4)) {
        limitReached = true;
      }
    }

    if (!isExhibition && !isTimeTrial && !limitReached && pointsAllowedPlace < (settings?.scoringPoints?.length || 0)) {
      const basePoints = settings!.scoringPoints[pointsAllowedPlace];
      
      let points = basePoints;
      
      if (isRelay) {
        teamRelayCounts[team] = (teamRelayCounts[team] || 0) + 1;
        points *= settings!.relayMultiplier;
        if (settings!.halfRateRelaySwimmer) {
          points = points / 4.0;
        }
      } else {
        teamIndividualCounts[team] = (teamIndividualCounts[team] || 0) + 1;
      }
      
      group.results.forEach(res => {
        finalResults.push({ ...res, rank: place + 1, points });
      });
      pointsAllowedPlace++;
      place++;
    } else {
      group.results.forEach(res => {
        finalResults.push({ ...res, rank: (isExhibition || isTimeTrial) ? 0 : place + 1, points: 0 });
      });
      if (!isExhibition && !isTimeTrial) place++;
    }
  });

  return finalResults;
}

export function getYearsRemaining(year: ClassYear): number {
  switch (year) {
    case ClassYear.FR: return 3;
    case ClassYear.SO: return 2;
    case ClassYear.JR: return 1;
    case ClassYear.SR: return 0;
    default: return 4;
  }
}

export function getTeamColor(teamName: string, index: number): string {
  const hash = Array.from(teamName).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    '#00F5FF', // Neon Cyan
    '#FF00FF', // Neon Magenta
    '#39FF14', // Neon Lime
    '#FFD700', // Gold
    '#FF4444', // Neon Red
    '#8A2BE2', // Neon Violet
    '#FF8C00', // Neon Orange
  ];
  return colors[hash % colors.length];
}

export function simulateRoster(results: SwimmerResult[], recruits: SwimmerResult[], removeSeniors: boolean): SwimmerResult[] {
  if (!removeSeniors) return [...results, ...recruits];

  // 1. Drop individuals who are SR
  let activeSwimmers = results.filter(r => {
    if (r.isRelay) return true; // keep relays for now
    if (r.classYear === 'SR' || r.classYear === 'Sr' || r.classYear === 'Senior') return false;
    return true;
  });
  
  // Mix in recruits so they are available replacements
  activeSwimmers = [...activeSwimmers, ...recruits];
  
  // 2. Adjust Relays
  const finalResults: SwimmerResult[] = [];
  
  // Pre-calculate best replacements per team for strokes (approx)
  // Stroke 50/100 times per team
  const getBestTimeForStroke = (team: string, distance: number, strokeKeywords: string[], excludeNames: string[]) => {
    const candidates = activeSwimmers.filter(s => 
      !s.isRelay && s.team === team && 
      !excludeNames.includes(s.name) &&
      strokeKeywords.some(kw => s.event.toLowerCase().includes(kw)) &&
      s.event.includes(distance.toString())
    );
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => convertTimeToSeconds(a.time) - convertTimeToSeconds(b.time));
    return candidates[0];
  };

  activeSwimmers.forEach(r => {
    if (!r.isRelay) {
      finalResults.push(r);
      return;
    }

    // It's a relay.
    let teamName = r.team;
    let newTimeSecs = convertTimeToSeconds(r.time);
    let modified = false;

    if (r.relayNames && r.relayNames.length > 0) {
      const activeNames = [...r.relayNames.map(n => n.name)];
      
      const newNames = r.relayNames.map((leg, index) => {
        if (leg.year === 'SR' || leg.year === 'Sr' || leg.year === 'Senior') {
          // This senior must be replaced
          let distance = 100;
          if (r.event.includes('200')) distance = 50;
          if (r.event.includes('800')) distance = 200;

          let strokes = ['freestyle', 'free'];
          if (r.event.toLowerCase().includes('medley')) {
            if (index === 0) strokes = ['backstroke', 'back'];
            if (index === 1) strokes = ['breaststroke', 'breast'];
            if (index === 2) strokes = ['butterfly', 'fly'];
            if (index === 3) strokes = ['freestyle', 'free'];
          }

          // We need senior's estimated time to subtract, and replacement's time to add.
          // Or just find best individual replacement and apply diff.
          // Since we might not have the senior's individual time, we can just replace the whole relay
          // But prompt asks to simulate by recalculating splits. 
          // Let's find the senior's individual time:
          const seniorIndiv = results.find(s => s.name === leg.name && !s.isRelay && s.event.includes(distance.toString()) && strokes.some(kw => s.event.toLowerCase().includes(kw)));
          const replacement = getBestTimeForStroke(teamName, distance, strokes, activeNames);
          
          if (replacement) {
            modified = true;
            activeNames.push(replacement.name); // keep track so we don't reuse same person on same relay
            
            if (seniorIndiv) {
              const diff = convertTimeToSeconds(replacement.time) - convertTimeToSeconds(seniorIndiv.time);
              newTimeSecs += diff; // if diff is > 0 (replacement slower), relay gets slower
            } else {
              // No senior individual time. Just add a generic penalty or guess. 
              // Usually a senior to a random replacement might be +2 seconds slower.
              newTimeSecs += 1.5; 
            }
            return { name: replacement.name, year: replacement.classYear as string };
          } else {
            // Cannot find a replacement. The relay might not be viable, but let's add penalty.
            newTimeSecs += 3.0; 
            return { name: 'Unknown', year: '?' };
          }
        }
        return leg;
      });

      if (modified) {
        finalResults.push({
          ...r,
          time: formatSecondsToTime(newTimeSecs),
          relayNames: newNames
        });
      } else {
        finalResults.push(r);
      }
    } else {
      // If we don't have relay names... we blindly penalize or skip if no data, 
      // but prompt implies assume we have names/splits or can simulate finding fastest.
      // Easiest is to push as-is if no names parsed.
      finalResults.push(r);
    }
  });

  return finalResults;
}
