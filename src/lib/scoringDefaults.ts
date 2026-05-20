/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScoringSettings } from '../types';
import { SCORING_POINTS } from '../constants';

const TOP16 = [...SCORING_POINTS];

/** Neutral default: configurable unlimited caps, per-event scope. */
export const GENERIC_TOP16_SETTINGS: ScoringSettings = {
  scoringPoints: TOP16,
  relayMultiplier: 2,
  halfRateRelaySwimmer: true,
  maxIndividualScorersPerTeam: 999,
  maxRelaysScoringPerTeam: 999,
  aFinalBracketSize: 8,
  scorerCapScope: 'event',
  diverScorerWeight: 1,
  relayEligibleFromScorerPool: false,
  diverEventPattern: ['DIVING', 'DIVE'],
};

/** Optional conference preset (apply via UI or workspace settings). */
export const NSISC_PRESET_SETTINGS: ScoringSettings = {
  scoringPoints: TOP16,
  relayMultiplier: 2,
  halfRateRelaySwimmer: true,
  maxIndividualScorersPerTeam: 18,
  maxRelaysScoringPerTeam: 2,
  aFinalBracketSize: 8,
  scorerCapScope: 'meet',
  diverScorerWeight: 1 / 3,
  relayEligibleFromScorerPool: true,
  diverEventPattern: ['DIVING', 'DIVE'],
};

export const DEFAULT_SCORING_SETTINGS: ScoringSettings = GENERIC_TOP16_SETTINGS;

export const SCORING_PRESET_BY_ID: Record<string, ScoringSettings> = {
  'generic-top16': GENERIC_TOP16_SETTINGS,
  nsisc: NSISC_PRESET_SETTINGS,
};

export function presetIdForConference(conference?: string): string | null {
  if (!conference) return null;
  const u = conference.toUpperCase();
  if (u.includes('NSISC')) return 'nsisc';
  return null;
}

export function mergeScoringSettings(settings?: Partial<ScoringSettings>): ScoringSettings {
  return { ...DEFAULT_SCORING_SETTINGS, ...settings };
}

export function settingsFromPresetPayload(raw: Record<string, unknown>): ScoringSettings {
  const { id: _id, label: _label, description: _desc, ...rest } = raw;
  return mergeScoringSettings(rest as Partial<ScoringSettings>);
}
