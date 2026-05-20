import React, { useEffect, useMemo, useState } from 'react';
import { Users, RotateCcw } from 'lucide-react';
import { Gender, ScorerRosterOverride, ScoringSettings, SwimmerResult } from '../types';
import {
  buildScorerRosterLookup,
  scorerRosterKey,
  usesScorerRoster,
} from '../lib/scorerRoster';
import { mergeScoringSettings } from '../lib/scoringDefaults';
import { isRelayResult } from '../lib/utils';

type Props = {
  results: SwimmerResult[];
  settings: ScoringSettings;
  gender: Gender;
  overrides: ScorerRosterOverride[];
  onChangeOverrides: (next: ScorerRosterOverride[]) => void;
};

export default function ScorerRosterPanel({
  results,
  settings,
  gender,
  overrides,
  onChangeOverrides,
}: Props) {
  const merged = mergeScoringSettings(settings);
  const rosterMode = usesScorerRoster(merged);

  const genderResults = useMemo(
    () => results.filter(r => !r.isRecruit && r.gender === gender),
    [results, gender]
  );

  const teams = useMemo(() => {
    const set = new Set<string>();
    for (const r of genderResults) {
      const t = String(r.team ?? '').trim();
      if (t && !(isRelayResult(r) && r.name === r.team)) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [genderResults]);

  const [selectedTeam, setSelectedTeam] = useState('');

  useEffect(() => {
    if (!teams.length) {
      setSelectedTeam('');
      return;
    }
    if (!selectedTeam || !teams.includes(selectedTeam)) {
      setSelectedTeam(teams[0]);
    }
  }, [teams, selectedTeam]);

  const { rows, autoLookup } = useMemo(() => {
    const autoLookup = buildScorerRosterLookup(genderResults, merged, [], gender);
    const lookup = buildScorerRosterLookup(genderResults, merged, overrides, gender);
    return { rows: lookup.rows, autoLookup };
  }, [genderResults, merged, overrides, gender]);

  const teamRows = useMemo(
    () => rows.filter(r => r.team === selectedTeam).sort((a, b) => a.name.localeCompare(b.name)),
    [rows, selectedTeam]
  );

  const setScorer = (row: (typeof rows)[0], isScorer: boolean) => {
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
        <button
          type="button"
          onClick={() => onChangeOverrides([])}
          className="text-[10px] text-theme-secondary hover:text-[var(--text-accent)] flex items-center gap-1 uppercase"
          title="Revert all manual edits for this gender"
        >
          <RotateCcw size={10} />
          Reset manual
        </button>
      </div>
      <p className="text-[10px] text-theme-secondary mb-3 leading-relaxed">
        Select a team to review every athlete from the current meet matrix. Auto marks A/B finalists and
        relay legs; toggle to override scorer status for the {merged.maxIndividualScorersPerTeam}-scorer cap.
      </p>

      <label className="block text-[10px] text-theme-secondary uppercase mb-1">Team</label>
      <select
        className="glass-input w-full text-xs mb-3"
        value={selectedTeam}
        onChange={e => setSelectedTeam(e.target.value)}
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

      <div className="max-h-64 overflow-y-auto rounded border border-theme-soft">
        <table className="w-full">
          <thead>
            <tr className="text-[9px] uppercase text-theme-secondary border-b border-theme-soft">
              <th className="text-left py-1 px-2 font-medium">Athlete</th>
              <th className="text-center py-1 px-2 font-medium w-16">Scorer</th>
              <th className="text-right py-1 px-2 font-medium w-12">Src</th>
            </tr>
          </thead>
          <tbody>
            {!selectedTeam || teamRows.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-center text-[10px] text-gray-500 italic">
                  {teams.length ? 'No athletes for this team' : 'Upload results to populate teams'}
                </td>
              </tr>
            ) : (
              teamRows.map(row => (
                <tr key={row.key} className="border-b border-theme-soft/50 text-[11px]">
                  <td className="py-1.5 px-2 truncate" title={row.name}>
                    {row.name}
                    {row.classYear ? (
                      <span className="text-theme-secondary ml-1 text-[9px]">{row.classYear}</span>
                    ) : null}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.isScorer}
                      onChange={e => setScorer(row, e.target.checked)}
                      className="accent-cyan-500"
                      aria-label={`${row.name} scorer`}
                    />
                  </td>
                  <td className="py-1.5 px-2 text-right text-[9px] uppercase text-theme-secondary">
                    {row.source === 'manual' ? 'edit' : 'auto'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {selectedTeam ? (
        <p className="text-[9px] text-theme-secondary mt-2">
          {teamRows.filter(r => r.isScorer).length} of {teamRows.length} marked as scorers on{' '}
          <span className="text-[var(--text-accent)]">{selectedTeam}</span>
        </p>
      ) : null}
    </div>
  );
}
