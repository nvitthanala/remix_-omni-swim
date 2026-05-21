import React, { useMemo, useState } from 'react';
import { Users, RotateCcw } from 'lucide-react';
import { Gender, ScorerRosterOverride, ScoringSettings, SwimmerResult } from '../types';
import {
  aggregateSwimmerMeetPoints,
  buildScorerRosterLookup,
  scorerRosterKey,
  usesScorerRoster,
} from '../lib/scorerRoster';
import { mergeScoringSettings } from '../lib/scoringDefaults';
import { isRelayResult } from '../lib/utils';
import type { ScorerRosterAthleteRole } from '../lib/scorerRoster';

function AthleteRoleTag({ role }: { role: ScorerRosterAthleteRole }) {
  const isDiver = role === 'diver';
  return (
    <span
      className={`shrink-0 px-1 py-0.5 rounded text-[8px] font-medium uppercase tracking-wide ${
        isDiver ? 'badge-warning' : 'badge-info'
      }`}
    >
      {isDiver ? 'Diver' : 'Swimmer'}
    </span>
  );
}

type Props = {
  results: SwimmerResult[];
  scoredResults: SwimmerResult[];
  settings: ScoringSettings;
  gender: Gender;
  overrides: ScorerRosterOverride[];
  onChangeOverrides: (next: ScorerRosterOverride[]) => void;
  editable: boolean;
};

export default function ScorerRosterPanel({
  results,
  scoredResults,
  settings,
  gender,
  overrides,
  onChangeOverrides,
  editable,
}: Props) {
  const merged = mergeScoringSettings(settings);
  const rosterMode = usesScorerRoster(merged);

  const genderResults = useMemo(
    () => results.filter(r => !r.isRecruit && (r.gender == null || r.gender === gender)),
    [results, gender]
  );

  const pointTotals = useMemo(
    () => aggregateSwimmerMeetPoints(scoredResults, gender),
    [scoredResults, gender]
  );

  const teams = useMemo(() => {
    const set = new Set<string>();
    for (const r of genderResults) {
      const t = String(r.team ?? '').trim();
      if (t && !(isRelayResult(r) && r.name === r.team)) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [genderResults]);

  const [pickedTeam, setPickedTeam] = useState<string | null>(null);
  const selectedTeam = useMemo(() => {
    if (!teams.length) return '';
    if (pickedTeam && teams.includes(pickedTeam)) return pickedTeam;
    return teams[0];
  }, [teams, pickedTeam]);

  const { rows, autoLookup } = useMemo(() => {
    const autoLookup = buildScorerRosterLookup(genderResults, merged, [], gender);
    const lookup = buildScorerRosterLookup(genderResults, merged, overrides, gender);
    return { rows: lookup.rows, autoLookup };
  }, [genderResults, merged, overrides, gender]);

  const teamRows = useMemo(() => {
    return rows
      .filter(r => r.team === selectedTeam)
      .sort((a, b) => {
        const ptsA = pointTotals.get(a.key) ?? 0;
        const ptsB = pointTotals.get(b.key) ?? 0;
        if (ptsB !== ptsA) return ptsB - ptsA;
        return a.name.localeCompare(b.name);
      });
  }, [rows, selectedTeam, pointTotals]);

  const setScorer = (row: (typeof rows)[0], isScorer: boolean) => {
    if (!editable) return;
    const auto = autoLookup.isScorer(row.name, row.team, row.gender);
    const key = scorerRosterKey(row.team, row.gender, row.name);
    const rest = overrides.filter(
      o => scorerRosterKey(o.team, o.gender, o.name) !== key
    );
    if (isScorer === auto) {
      onChangeOverrides(rest);
    } else {
      onChangeOverrides([
        ...rest,
        { name: row.name, team: row.team, gender: row.gender, isScorer },
      ]);
    }
  };

  if (!rosterMode) {
    return (
      <div className="surface-card rounded-lg p-5">
        <h4 className="text-[10px] font-medium text-theme-secondary uppercase tracking-widest flex items-center gap-2 mb-2">
          <Users size={12} />
          Team scorer roster
        </h4>
        <p className="text-[10px] text-theme-secondary leading-relaxed">
          Team scorer roster is used when scoring settings use roster eligibility (e.g. NSISC preset).
          Load that preset or set scorer eligibility to roster.
        </p>
      </div>
    );
  }

  const genderLabel = gender === Gender.MEN ? "Men's" : "Women's";
  const colSpan = editable ? 3 : 2;

  return (
    <div className="surface-card rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] font-medium text-theme-secondary uppercase tracking-widest flex items-center gap-2">
          <Users size={12} />
          Team scorer roster
          <span className="text-theme-secondary font-normal normal-case tracking-normal">
            ({genderLabel})
          </span>
        </h4>
        {editable ? (
          <button
            type="button"
            onClick={() => onChangeOverrides([])}
            className="text-[10px] text-theme-secondary hover:text-[var(--text-accent)] flex items-center gap-1 uppercase"
            title="Revert all manual edits for this gender"
          >
            <RotateCcw size={10} />
            Reset manual
          </button>
        ) : null}
      </div>
      <p className="text-[10px] text-theme-secondary mb-3 leading-relaxed">
        Full team roster with projected meet points (individual + relay leg share).{' '}
        {editable
          ? `Toggle scorers for the ${merged.maxIndividualScorersPerTeam}-scorer cap.`
          : 'Enable What-if mode to edit scorer toggles.'}
      </p>

      <label className="block text-[10px] text-theme-secondary uppercase mb-1">Team</label>
      <select
        className="glass-input w-full text-xs mb-3"
        value={selectedTeam}
        onChange={e => setPickedTeam(e.target.value)}
        disabled={!teams.length}
      >
        {!teams.length ? (
          <option value="">No teams in matrix</option>
        ) : (
          teams.map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))
        )}
      </select>

      <div className="max-h-64 overflow-y-auto pr-1 rounded border border-theme-soft custom-scrollbar">
        <table className="w-full">
          <thead>
            <tr className="text-[9px] uppercase text-theme-secondary border-b border-theme-soft">
              <th className="text-left py-1 px-2 font-medium">Athlete</th>
              <th className="text-right py-1 px-2 font-medium w-16">Meet pts</th>
              {editable ? (
                <th className="text-center py-1 px-2 font-medium w-16">Scorer</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {!selectedTeam || teamRows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="py-4 text-center text-[10px] text-theme-muted italic">
                  {teams.length ? 'No athletes for this team' : 'Upload results to populate teams'}
                </td>
              </tr>
            ) : (
              teamRows.map(row => {
                const meetPts = pointTotals.get(row.key) ?? 0;
                return (
                  <tr key={row.key} className="border-b border-theme-soft/50 text-[11px]">
                    <td className="py-1.5 px-2" title={row.name}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{row.name}</span>
                        <AthleteRoleTag role={row.athleteRole} />
                      </div>
                    </td>
                    <td
                      className={`py-1.5 px-2 text-right font-mono tabular-nums ${
                        meetPts > 0 ? 'text-[var(--text-accent)]' : 'text-theme-secondary'
                      }`}
                    >
                      {meetPts.toFixed(1)}
                    </td>
                    {editable ? (
                      <td className="py-1.5 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.isScorer}
                          onChange={e => setScorer(row, e.target.checked)}
                          className="accent-[var(--text-accent)]"
                          aria-label={`${row.name} scorer`}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {selectedTeam ? (
        <p className="text-[9px] text-theme-secondary mt-2">
          {editable ? (
            <>
              {teamRows.filter(r => r.isScorer).length} of {teamRows.length} marked as scorers on{' '}
              <span className="text-[var(--text-accent)]">{selectedTeam}</span>
            </>
          ) : (
            <>
              {teamRows.length} athletes on{' '}
              <span className="text-[var(--text-accent)]">{selectedTeam}</span> — enable What-if to edit
              scorers
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
