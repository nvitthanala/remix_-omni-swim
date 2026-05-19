/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Trophy, Users, Plus, ChevronDown, TrendingUp, Clock, Briefcase, Search, UserMinus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Gender, Workspace, SwimmerResult, Recruit, ClassYear, TeamScore, ScoringSettings } from '../types';
import { calculatePoints, convertToSCY, getTeamColor, simulateRoster } from '../lib/utils';
import TeamCard from './TeamCard';
import RecruitForm from './RecruitForm';
import ScoringSettingsPanel from './ScoringSettingsPanel';

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

  // Filter results and recruits by gender
  const currentResults = gender === Gender.MEN ? workspace.menResults : workspace.womenResults;
  const currentRecruits = workspace.recruits.filter(r => r.gender === gender);

  // Transform recruits into results for scoring
  const recruitResults: SwimmerResult[] = currentRecruits.map(r => ({
    id: r.id,
    rank: 0,
    name: r.name,
    classYear: r.classYear,
    team: r.team,
    time: convertToSCY(r.time, r.event, r.gender, r.timeType),
    points: 0,
    event: r.event,
    isRecruit: true
  }));

  // Group by event for re-ranking
  const allResults = simulateRoster(currentResults, recruitResults, removeSeniors);
  const events = Array.from(new Set(allResults.map(r => r.event)));

  // Calculate scores per event and aggregate by team
  const teamsMap: Record<string, TeamScore> = {};
  const timelineData: any[] = [];
  const runningTotals: Record<string, number> = {};

  events.forEach(event => {
    const eventResults = allResults.filter(r => r.event === event);
    const isTimeTrial = eventResults.some(r => r.isTimeTrial);
    const scored = calculatePoints(eventResults, workspace.scoringSettings);
    
    scored.forEach(res => {
      if (!teamsMap[res.team]) {
        teamsMap[res.team] = {
          teamName: res.team,
          totalPoints: 0,
          swimmers: [],
          color: getTeamColor(res.team, Object.keys(teamsMap).length)
        };
        runningTotals[res.team] = 0;
      }
      const pts = typeof res.points === 'number' ? res.points : 0;
      teamsMap[res.team].totalPoints += pts;
      teamsMap[res.team].swimmers.push(res);
      runningTotals[res.team] += pts;
    });

    if (!isTimeTrial) {
      const timelinePoint: any = { 
          name: event.replace(' Freestyle', ' Free').replace('Individual Medley', 'IM').replace('Backstroke', 'Back').replace('Breaststroke', 'Breast').replace('Butterfly', 'Fly').substring(0, 15), 
          fullEvent: event 
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

  const handleAddRecruit = (recruit: Recruit) => {
    onUpdate({
      recruits: [...workspace.recruits, recruit]
    });
    setIsAddingRecruit(false);
  };

  const topIndividuals = useMemo(() => {
    let combinedResults: SwimmerResult[] = [];
    events.forEach(event => {
      const eventResults = allResults.filter(r => r.event === event);
      combinedResults = [...combinedResults, ...calculatePoints(eventResults, workspace.scoringSettings)];
    });
    // Deduplicate or just take top points? These are individual swims.
    return combinedResults
      .filter(r => !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.team.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
      const ptsA = typeof a.points === 'number' ? a.points : 0;
      const ptsB = typeof b.points === 'number' ? b.points : 0;
      return ptsB - ptsA;
    });
  }, [allResults, events, workspace.scoringSettings, searchQuery]);

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
        
        onUpdate({ 
          menResults: [...workspace.menResults, ...parsedMen],
          womenResults: [...workspace.womenResults, ...parsedWomen]
        });
      } finally {
        setIsParsingPdf(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const scoringSettingsObj = workspace.scoringSettings || { scoringPoints: [20,17,16,15,14,13,12,11,9,7,6,5,4,3,2,1], relayMultiplier: 2, halfRateRelaySwimmer: true, maxIndividualScorersPerTeam: 4, maxRelaysScoringPerTeam: 1 };

  return (
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
                  contentStyle={{ background: '#0c0f16', border: '1px solid #1f2937', fontSize: '10px', color: '#fff', borderRadius: '8px', padding: '10px' }}
                  labelStyle={{ color: '#F43F5E', fontWeight: 'bold', marginBottom: '8px', display: 'block' }}
                  itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'medium' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                {sortedTeams.map(team => (
                  <Line 
                    key={team.teamName}
                    type="monotone" 
                    dataKey={team.teamName} 
                    name={team.teamName}
                    stroke={team.color} 
                    strokeWidth={2} 
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
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
            {sortedTeams.length > 0 ? (
              sortedTeams
                .filter(t => !searchQuery || t.teamName.toLowerCase().includes(searchQuery.toLowerCase()) || Object.values(t.swimmers).some(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())))
                .map((team, index) => (
                <TeamCard 
                  key={team.teamName} 
                  team={team} 
                  index={index} 
                  gender={gender} 
                  eventsList={events}
                  searchQuery={searchQuery}
                  onUpdateTime={(id, newTime) => {
                    const field = gender === Gender.MEN ? 'menResults' : 'womenResults';
                    const newArr = workspace[field].map(r => r.id === id ? { ...r, time: newTime } : r);
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
            teams={sortedTeams.map(t => t.teamName)} 
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

        <ScoringSettingsPanel 
          settings={scoringSettingsObj} 
          onSave={sets => onUpdate({ scoringSettings: sets })} 
        />
      </div>
    </div>
  );
}
