/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Trophy, Users, Plus, ChevronDown, TrendingUp, Clock, Briefcase, Search, UserMinus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Gender, Workspace, SwimmerResult, Recruit, ClassYear, TeamScore, ScoringSettings } from '../types';
import {
  calculatePoints,
  convertToSCY,
  getTeamColors,
  assignTeamLineStyles,
  simulateRoster,
  looksLikeInstitutionTeamName,
  normalizeSwimmerName,
  sortEventsByMeetOrder,
  mergeScoringSettings,
} from '../lib/utils';
import { presetIdForConference } from '../lib/scoringDefaults';
import TeamCard from './TeamCard';
import RecruitForm from './RecruitForm';
import ScoringSettingsPanel from './ScoringSettingsPanel';
import ScorerRosterPanel from './ScorerRosterPanel';
import SwimmerDeleteConfirmModal from './SwimmerDeleteConfirmModal';

type TimelineTooltipContentProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string; dataKey?: string; value?: unknown; color?: string }>;
  label?: string;
  teamsWithLineStyles: TeamScore[];
};

function TimelineTooltipContent({ active, payload, label, teamsWithLineStyles }: TimelineTooltipContentProps) {
  if (!active || !payload?.length) return null;
  const dashByTeam = Object.fromEntries(teamsWithLineStyles.map(t => [t.teamName, t.strokeDasharray]));
  const rows = [...payload]
    .map(p => ({
      name: String(p.name ?? p.dataKey ?? ''),
      value: typeof p.value === 'number' ? p.value : Number(p.value),
      color: String(p.color ?? ''),
      strokeDasharray: dashByTeam[String(p.name ?? p.dataKey ?? '')] as string | undefined,
    }))
    .filter(r => !Number.isNaN(r.value))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  return (
    <div className="bg-[#0c0f16] border border-gray-700 rounded-lg p-2.5 shadow-xl max-w-xs">
      <div className="text-rose-400 font-bold mb-2 text-[10px] uppercase tracking-wide border-b border-gray-800 pb-1">
        {label}
      </div>
      <ul className="space-y-1 font-mono text-[10px]">
        {rows.map(r => (
          <li key={r.name} className="flex items-center justify-between gap-4 text-gray-200">
            <span className="flex items-center gap-2 min-w-0">
              <svg width="22" height="8" className="shrink-0" aria-hidden>
                <line
                  x1="0"
                  y1="4"
                  x2="22"
                  y2="4"
                  stroke={r.color}
                  strokeWidth="2"
                  strokeDasharray={r.strokeDasharray}
                />
              </svg>
              <span className="truncate">{r.name}</span>
            </span>
            <span className="text-emerald-400 font-bold shrink-0">{r.value.toFixed(1)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface Props {
  workspace: Workspace;
  gender: Gender;
  onUpdate: (updated: Partial<Workspace>) => void;
}

export default function OpsModule({ workspace, gender, onUpdate }: Props) {
  const [isAddingRecruit, setIsAddingRecruit] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [removeSeniors, setRemoveSeniors] = useState(false);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [pdfFormat, setPdfFormat] = useState('auto');
  const [swimmerDeleteCandidate, setSwimmerDeleteCandidate] = useState<{ name: string } | null>(null);
  const [suggestedPresetId, setSuggestedPresetId] = useState<string | null>(() =>
    presetIdForConference(workspace.conference)
  );

  const scoringBundle = useMemo(() => {
    const menResults = workspace.menResults ?? [];
    const womenResults = workspace.womenResults ?? [];
    const currentResults = gender === Gender.MEN ? menResults : womenResults;
    const currentRecruits = (workspace.recruits ?? []).filter(r => r.gender === gender);

    const recruitResults: SwimmerResult[] = currentRecruits.map(r => ({
      id: r.id,
      rank: 0,
      name: r.name,
      classYear: r.classYear,
      team: r.team,
      time: convertToSCY(r.time, r.event, r.gender, r.timeType),
      points: 0,
      event: r.event,
      isRecruit: true,
    }));

    const excluded = new Set(
      (workspace.deletedSwimmers ?? [])
        .filter(d => d.gender === gender)
        .map(d => normalizeSwimmerName(d.name))
    );
    const allResults = simulateRoster(currentResults, recruitResults, removeSeniors, excluded);
    const scoringSettings = mergeScoringSettings(workspace.scoringSettings);
    const allScored = calculatePoints(allResults, scoringSettings, {
      scorerRosterOverrides: workspace.scorerRosterOverrides,
    });
    const scoredById = new Map(allScored.map(r => [r.id, r]));
    const events = sortEventsByMeetOrder(Array.from(new Set(allResults.map(r => r.event))));

    const teamsMap: Record<string, TeamScore> = {};
    const timelineData: any[] = [];
    const runningTotals: Record<string, number> = {};

    events.forEach(event => {
      const eventResults = allResults.filter(r => r.event === event);
      const isTimeTrial = eventResults.some(r => r.isTimeTrial);
      const scored = eventResults.map(r => scoredById.get(r.id) ?? { ...r, points: 0 });

      scored.forEach(res => {
        const tName = String(res.name ?? '')
          .trim()
          .toLowerCase();
        const tTeam = String(res.team ?? '')
          .trim()
          .toLowerCase();
        if (tName && tTeam === tName && !looksLikeInstitutionTeamName(res.team)) {
          return;
        }
        const teamKey = String(res.team ?? 'Unknown').trim() || 'Unknown';
        if (!teamsMap[teamKey]) {
          teamsMap[teamKey] = {
            teamName: teamKey,
            totalPoints: 0,
            swimmers: [],
            color: getTeamColors(teamKey).primary,
          };
          runningTotals[teamKey] = 0;
        }
        const pts = typeof res.points === 'number' ? res.points : 0;
        teamsMap[teamKey].totalPoints += pts;
        teamsMap[teamKey].swimmers.push(res);
        runningTotals[teamKey] += pts;
      });

      if (!isTimeTrial) {
        const timelinePoint: any = {
          name: event
            .replace(' Freestyle', ' Free')
            .replace('Individual Medley', 'IM')
            .replace('Backstroke', 'Back')
            .replace('Breaststroke', 'Breast')
            .replace('Butterfly', 'Fly')
            .substring(0, 15),
          fullEvent: event,
        };
        Object.keys(runningTotals).forEach(team => {
          timelinePoint[team] = runningTotals[team];
        });
        if (Object.keys(runningTotals).length > 0) {
          timelineData.push(timelinePoint);
        }
      }
    });

    const sortedTeams = Object.values(teamsMap).sort((a, b) => b.totalPoints - a.totalPoints);
    const teamStyleSignature = sortedTeams.map(t => `${t.teamName}:${t.totalPoints}:${t.color}`).join('|');

    return {
      allResults,
      events,
      sortedTeams,
      timelineData,
      teamStyleSignature,
    };
  }, [
    workspace.menResults,
    workspace.womenResults,
    workspace.recruits,
    workspace.deletedSwimmers,
    workspace.scoringSettings,
    gender,
    removeSeniors,
  ]);

  const confirmDeleteSwimmer = () => {
    if (!swimmerDeleteCandidate) return;
    const name = swimmerDeleteCandidate.name;
    const key = normalizeSwimmerName(name);
    const field = gender === Gender.MEN ? 'menResults' : 'womenResults';
    const arr = workspace[field] ?? [];
    const filtered = arr.filter(r => !(normalizeSwimmerName(r.name) === key && !r.isRelay));
    const nextDeleted = [...(workspace.deletedSwimmers ?? [])];
    if (!nextDeleted.some(d => d.gender === gender && normalizeSwimmerName(d.name) === key)) {
      nextDeleted.push({ name, gender });
    }
    const recruitsFiltered = (workspace.recruits ?? []).filter(
      r => !(r.gender === gender && normalizeSwimmerName(r.name) === key)
    );
    onUpdate({ [field]: filtered, recruits: recruitsFiltered, deletedSwimmers: nextDeleted });
    setSwimmerDeleteCandidate(null);
  };

  const teamsWithLineStyles = useMemo(
    () => assignTeamLineStyles(scoringBundle.sortedTeams),
    [scoringBundle.teamStyleSignature]
  );

  const topIndividuals = useMemo(() => {
    const combinedResults = calculatePoints(
      scoringBundle.allResults,
      mergeScoringSettings(workspace.scoringSettings),
      { scorerRosterOverrides: workspace.scorerRosterOverrides }
    );
    return combinedResults
      .filter(
        r =>
          !searchQuery ||
          String(r.name ?? '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          String(r.team ?? '')
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        const ptsA = typeof a.points === 'number' ? a.points : 0;
        const ptsB = typeof b.points === 'number' ? b.points : 0;
        return ptsB - ptsA;
      });
  }, [scoringBundle.allResults, workspace.scoringSettings, searchQuery]);

  const { allResults, events, timelineData } = scoringBundle;

  const handleAddRecruit = (recruit: Recruit) => {
    onUpdate({
      recruits: [...(workspace.recruits ?? []), recruit],
    });
    setIsAddingRecruit(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      setIsParsingPdf(true);
      try {
        const base64 = (event.target?.result as string).split(',')[1];
        const res = await fetch('/api/parse-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64, format: pdfFormat }),
        });
        const data = await res.json();
        
        if (data.error) {
          alert(data.error + '\n' + (data.details || ''));
          return;
        }

        const parsedMen = data.results.filter((r: any) => r.gender === 'Men');
        const parsedWomen = data.results.filter((r: any) => r.gender === 'Women');
        
        const conference = data.conference ?? workspace.conference;
        const presetHint = presetIdForConference(conference);
        if (presetHint) setSuggestedPresetId(presetHint);

        onUpdate({
          menResults: [...(workspace.menResults ?? []), ...parsedMen],
          womenResults: [...(workspace.womenResults ?? []), ...parsedWomen],
          conference,
        });
      } finally {
        setIsParsingPdf(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const scoringSettingsObj = mergeScoringSettings(workspace.scoringSettings);
  const meetConference = workspace.conference;

  return (
    <>
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-8 space-y-6">
        {/* Timeline Graph */}
        <div className="surface-card rounded-lg p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-rose-400" />
            <h3 className="text-[12px] font-bold text-[var(--text-primary)] uppercase tracking-tight">Chronological Team Score Timeline</h3>
          </div>
          
          <div className="h-64 w-full surface-overlay p-2 rounded border border-theme-soft">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 9, fontStyle: 'bold', fontFamily: 'JetBrains Mono' }} interval="preserveStartEnd" />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10, fontStyle: 'bold', fontFamily: 'JetBrains Mono' }} />
                <Tooltip
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                  content={props => (
                    <TimelineTooltipContent
                      active={props.active}
                      label={props.label != null ? String(props.label) : undefined}
                      payload={props.payload as TimelineTooltipContentProps['payload']}
                      teamsWithLineStyles={teamsWithLineStyles}
                    />
                  )}
                />
                {teamsWithLineStyles.map(team => (
                  <Line
                    key={team.teamName}
                    type="monotone"
                    dataKey={team.teamName}
                    name={team.teamName}
                    stroke={team.lineColor ?? team.color}
                    strokeWidth={2}
                    strokeDasharray={team.strokeDasharray}
                    dot={false}
                    isAnimationActive={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div
            className="mt-3 flex flex-wrap gap-x-4 gap-y-2 justify-center pointer-events-none select-none border-t border-theme-soft pt-3"
            aria-hidden
          >
            {teamsWithLineStyles.map(t => (
              <span
                key={t.teamName}
                className="inline-flex items-center gap-2 text-[10px] text-theme-secondary font-mono uppercase tracking-tight max-w-[200px]"
              >
                <svg width="28" height="10" className="shrink-0 overflow-visible">
                  <line
                    x1="0"
                    y1="5"
                    x2="28"
                    y2="5"
                    stroke={t.lineColor ?? t.color}
                    strokeWidth="2"
                    strokeDasharray={t.strokeDasharray}
                  />
                </svg>
                <span className="truncate" title={t.teamName}>
                  {t.teamName}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Performance Matrix: Chart Area */}
        <div className="surface-card rounded-lg p-5">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h3 className="text-lg font-medium text-[var(--text-primary)] uppercase tracking-tight">Performance Matrix: Overall Standing</h3>
              <p className="text-xs text-theme-secondary">Current projection based on custom scoring model ({scoringSettingsObj.scoringPoints.slice(0, 3).join('-')}...)</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center surface-overlay border border-theme-soft rounded px-3 py-1.5 focus-within:border-[var(--text-accent)]/50 transition-colors">
                <Search size={12} className="text-theme-secondary mr-2" />
                <input 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter swimmer or team..."
                  className="bg-transparent border-none outline-none text-[10px] uppercase placeholder:text-theme-secondary text-[var(--text-primary)] w-40"
                />
              </div>
              <button 
                onClick={() => setRemoveSeniors(!removeSeniors)}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded text-[10px] uppercase font-medium transition-all ${
                  removeSeniors 
                    ? 'bg-[var(--text-accent)]/20 border-[var(--text-accent)]/40 text-[var(--text-accent)]' 
                    : 'surface-muted-bg border-theme-soft text-theme-secondary hover:text-[var(--text-primary)]'
                }`}
                title="Remove graduating seniors and simulate relay replacements"
              >
                <UserMinus size={12} />
                <span>- Class of SR</span>
              </button>
              {isParsingPdf ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-900/20 border border-rose-400/30 rounded text-[10px] uppercase font-medium text-rose-400">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                    <Plus size={12} className="opacity-50" />
                  </motion.div>
                  <span>Parsing PDF...</span>
                  <div className="w-16 h-1 bg-rose-900/50 rounded overflow-hidden ml-2">
                    <motion.div 
                      className="h-full bg-rose-400"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 15, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 border border-theme-soft rounded p-1">
                  <select 
                    value={pdfFormat}
                    onChange={(e) => setPdfFormat(e.target.value)}
                    className="bg-transparent text-[10px] uppercase tracking-widest text-theme-secondary outline-none py-1 pl-2 border-r border-theme-soft pr-2 cursor-pointer"
                    title="PDF Column Format"
                  >
                    <option value="auto">Auto Format</option>
                    <option value="regular">Regular List</option>
                    <option value="divided">Divided (2-Col)</option>
                  </select>
                  <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1 bg-rose-900/20 hover:bg-rose-900/40 border border-rose-400/30 rounded-sm text-[10px] uppercase font-medium text-rose-400 transition-all">
                    <Plus size={12} />
                    <span>Load PDF</span>
                    <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                  </label>
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            {teamsWithLineStyles.length > 0 ? (
              teamsWithLineStyles
                .filter(
                  t =>
                    !searchQuery ||
                    t.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    Object.values(t.swimmers).some(s =>
                      String(s.name ?? '')
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase())
                    )
                )
                .map((team, index) => (
                <TeamCard 
                  key={team.teamName} 
                  team={team} 
                  index={index} 
                  gender={gender} 
                  eventsList={events}
                  conference={meetConference}
                  searchQuery={searchQuery}
                  onRequestDeleteSwimmer={name => setSwimmerDeleteCandidate({ name })}
                  onUpdateTime={(id, newTime) => {
                    const field = gender === Gender.MEN ? 'menResults' : 'womenResults';
                    const arr = workspace[field] ?? [];
                    const newArr = arr.map(r => (r.id === id ? { ...r, time: newTime } : r));
                    onUpdate({ [field]: newArr });
                  }}
                />
              ))
            ) : (
              <div className="p-12 text-center border border-dashed border-theme-soft rounded-lg text-theme-secondary">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-xs uppercase font-medium tracking-widest">No matrix data persistent</p>
              </div>
            )}
          </div>
        </div>

        {/* Individual Performance Breakdown Table */}
        <div className="surface-card rounded-lg overflow-hidden">
          <div className="p-4 border-b border-theme-soft surface-overlay">
            <h4 className="text-[10px] font-medium text-theme-secondary uppercase tracking-widest">Top Individual Contributors</h4>
          </div>
          <table className="w-full text-left border-collapse">
            <thead className="surface-overlay text-[10px] uppercase tracking-widest text-theme-secondary font-medium">
              <tr>
                <th className="p-3">Rank</th>
                <th className="p-3">Athlete Name</th>
                <th className="p-3">Team</th>
                <th className="p-3">Class</th>
                <th className="p-3 text-right">Proj Pts</th>
              </tr>
            </thead>
            <tbody className="text-xs font-mono">
              {topIndividuals.length > 0 ? (
                topIndividuals.slice(0, 10).map((res, i) => (
                  <tr key={res.id || i} className="border-b border-theme-soft hover:bg-white/5 transition-colors">
                    <td className="p-3 text-theme-secondary">{i + 1}</td>
                    <td className="p-3 font-sans font-medium text-[var(--text-primary)]">{res.name}</td>
                    <td className="p-3">{res.team}</td>
                    <td className="p-3"><span className="px-1.5 py-0.5 rounded surface-overlay border border-theme-soft">{res.classYear}</span></td>
                    <td className="p-3 text-right text-[var(--text-accent)] font-medium">{typeof res.points === 'number' ? res.points.toFixed(1) : res.points}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 italic">No athlete data available in current matrix</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Column: Recruit Projection */}
      <div className="col-span-4 space-y-6">
        <div className="surface-card rounded-lg p-5">
          <h3 className="text-sm font-medium text-[var(--text-accent)] uppercase tracking-widest mb-4">Recruit Projection Matrix</h3>
          <RecruitForm 
            gender={gender} 
            teams={teamsWithLineStyles.map(t => t.teamName)} 
            onSubmit={handleAddRecruit} 
          />
          
          <div className="mt-8 pt-6 border-t border-theme-soft">
            <h4 className="text-[10px] font-medium text-theme-secondary uppercase tracking-widest mb-3">Conversion Factors Applied</h4>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="flex justify-between surface-overlay p-2 rounded border border-theme-soft">
                <span className="text-theme-secondary">LCM 50/100</span>
                <span className="text-[var(--text-accent)]">0.873</span>
              </div>
              <div className="flex justify-between surface-overlay p-2 rounded border border-theme-soft">
                <span className="text-theme-secondary">LCM 400/500</span>
                <span className="text-[var(--text-accent)]">1.115</span>
              </div>
              <div className="flex justify-between surface-overlay p-2 rounded border border-theme-soft">
                <span className="text-theme-secondary">SCM Generic</span>
                <span className="text-[var(--text-accent)]">0.906</span>
              </div>
              <div className="flex justify-between surface-overlay p-2 rounded border border-theme-soft">
                <span className="text-theme-secondary">SCM Mile</span>
                <span className="text-[var(--text-accent)]">1.013</span>
              </div>
            </div>
          </div>
        </div>

        <ScorerRosterPanel
          results={scoringBundle.allResults}
          settings={scoringSettingsObj}
          gender={gender}
          overrides={workspace.scorerRosterOverrides ?? []}
          onChangeOverrides={next => onUpdate({ scorerRosterOverrides: next })}
        />

        <ScoringSettingsPanel
          settings={scoringSettingsObj}
          suggestedPresetId={suggestedPresetId}
          onSave={sets => {
            onUpdate({ scoringSettings: sets });
            setSuggestedPresetId(null);
          }}
        />
      </div>
    </div>
    {swimmerDeleteCandidate && (
      <SwimmerDeleteConfirmModal
        swimmerName={swimmerDeleteCandidate.name}
        gender={gender}
        onConfirm={confirmDeleteSwimmer}
        onCancel={() => setSwimmerDeleteCandidate(null)}
      />
    )}
    </>
  );
}
