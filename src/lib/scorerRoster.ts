/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Gender, ScorerAutoRules, ScorerRosterOverride, ScoringSettings, SwimmerResult } from '../types';
import { DEFAULT_SCORER_AUTO_RULES } from './scoringDefaults';
import { classifyRoundTier, isRelayResult, normalizeSwimmerName } from './utils';

export type ScorerRosterRowSource = 'auto' | 'manual';

export interface ScorerRosterRow {
  key: string;
  name: string;
  team: string;
  gender: Gender;
  classYear: string;
  isScorer: boolean;
  source: ScorerRosterRowSource;
}

export type ScorerRosterLookup = {
  isScorer: (name: string, team: string, gender: Gender | string | undefined) => boolean;
  rows: ScorerRosterRow[];
};

export function scorerRosterKey(team: string, gender: Gender | string | undefined, name: string): string {
  return `${String(team).trim()}|||${gender ?? ''}|||${normalizeSwimmerName(name)}`;
}

function isDistanceForRules(event: string | undefined, rules?: ScorerAutoRules): boolean {
  if (!event) return false;
  const patterns = rules?.distanceEventPattern?.length
    ? rules.distanceEventPattern
    : ['1000', '1650', '1500'];
  const u = event.toUpperCase();
  return patterns.some(p => u.includes(p.toUpperCase()));
}

/** Whether this swim row suggests the athlete is a team scorer (config-driven, not conference-specific). */
export function rowSuggestsScorer(swim: SwimmerResult, rules?: ScorerAutoRules): boolean {
  if (!rules) return false;
  const tiers = rules.abFinalTiers ?? ['A', 'B'];
  const tier = classifyRoundTier(swim.roundSwam);
  if (!tiers.includes(tier as 'A' | 'B')) return false;

  if (rules.distanceFinalRequired && isDistanceForRules(swim.event, rules)) {
    // Prelims-only distance swims do not mark a scorer; A/B distance finals do.
    if (tier === 'PRE') return false;
  }

  if (swim.isRelay || isRelayResult(swim)) {
    return rules.includeRelayLegsInFinals !== false;
  }

  return true;
}

function deriveAutoScorerKeys(results: SwimmerResult[], rules?: ScorerAutoRules): Set<string> {
  const keys = new Set<string>();
  if (!rules) return keys;
  for (const r of results) {
    if (r.isRecruit) continue;
    if (rowSuggestsScorer(r, rules)) {
      keys.add(scorerRosterKey(String(r.team ?? '').trim() || 'Unknown', r.gender ?? Gender.MEN, r.name));
    }
  }
  return keys;
}

function overrideMap(overrides?: ScorerRosterOverride[]): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const o of overrides ?? []) {
    m.set(scorerRosterKey(o.team, o.gender, o.name), o.isScorer);
  }
  return m;
}

/** Collect roster rows for display and build lookup for scoring. */
export function buildScorerRosterLookup(
  results: SwimmerResult[],
  settings: ScoringSettings,
  overrides?: ScorerRosterOverride[],
  genderFilter?: Gender
): ScorerRosterLookup {
  const rules = effectiveAutoRules(settings);
  const autoKeys = deriveAutoScorerKeys(results, rules);
  const manual = overrideMap(overrides);

  const meta = new Map<
    string,
    { name: string; team: string; gender: Gender; classYear: string }
  >();

  for (const r of results) {
    if (r.isRecruit) continue;
    if (genderFilter != null && r.gender !== genderFilter) continue;
    if (isRelayResult(r) && r.name === r.team) continue;
    const team = String(r.team ?? '').trim() || 'Unknown';
    const g = (r.gender ?? genderFilter ?? Gender.MEN) as Gender;
    const key = scorerRosterKey(team, g, r.name);
    if (!meta.has(key)) {
      meta.set(key, {
        name: r.name,
        team,
        gender: g,
        classYear: String(r.classYear ?? ''),
      });
    }
  }

  const rows: ScorerRosterRow[] = [];
  for (const [key, info] of meta) {
    const manualVal = manual.get(key);
    const autoVal = autoKeys.has(key);
    const isScorer = manualVal !== undefined ? manualVal : autoVal;
    const source: ScorerRosterRowSource = manualVal !== undefined ? 'manual' : 'auto';
    rows.push({ key, ...info, isScorer, source });
  }

  rows.sort((a, b) => a.team.localeCompare(b.team) || a.name.localeCompare(b.name));

  return {
    rows,
    isScorer: (name, team, gender) => {
      const key = scorerRosterKey(team, gender, name);
      const manualVal = manual.get(key);
      if (manualVal !== undefined) return manualVal;
      return autoKeys.has(key);
    },
  };
}

export function usesScorerRoster(settings: ScoringSettings): boolean {
  return settings.scorerEligibilityMode === 'roster';
}

function effectiveAutoRules(settings: ScoringSettings): ScorerAutoRules {
  return settings.scorerAutoRules ?? DEFAULT_SCORER_AUTO_RULES;
}

/** A/B relay finals: all legs eligible for relay team points (roster mode). */
export function relayEntryRosterEligible(
  group: SwimmerResult[],
  settings: ScoringSettings,
  lookup?: ScorerRosterLookup
): boolean {
  if (!usesScorerRoster(settings)) return true;
  const sample = group[0];
  const rules = effectiveAutoRules(settings);
  const tier = classifyRoundTier(sample.roundSwam);
  const tiers = rules.abFinalTiers ?? ['A', 'B'];
  if (rules.includeRelayLegsInFinals !== false && tiers.includes(tier as 'A' | 'B')) {
    return true;
  }
  if (!lookup) return false;
  const team = String(sample.team ?? '').trim() || 'Unknown';
  return group.every(r => lookup.isScorer(r.name, team, sample.gender));
}

/** True when this swim is an A/B relay leg (used to seed scorer pool before relay scoring). */
export function isAbFinalRelayLeg(swim: SwimmerResult, settings: ScoringSettings): boolean {
  if (!isRelayResult(swim)) return false;
  const rules = effectiveAutoRules(settings);
  return rowSuggestsScorer(swim, rules);
}
