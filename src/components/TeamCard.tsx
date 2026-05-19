/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  User, 
  Award,
  BarChart3,
  List
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { TeamScore, SwimmerResult, ClassYear, Gender } from '../types';
import { getYearsRemaining, convertTimeToSeconds, formatSecondsToTime } from '../lib/utils';
import { cutlines } from '../cutlines';

interface Props {
  team: TeamScore;
  index: number;
  gender: Gender;
  eventsList?: string[];
  key?: string | number;
  searchQuery?: string;
  onUpdateTime?: (id: string, newTime: string) => void;
}

export default function TeamCard({ team, index, gender, eventsList = [], searchQuery, onUpdateTime }: Props) {
  const [isExpanded, setIsExpanded] = useState(index === 0);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [viewMode, setViewMode] = useState<'swimmer'|'event'>('event');
  const [sortMode, setSortMode] = useState<'chrono'|'eventDesc'|'eventAsc'|'swimmerDesc'|'swimmerAsc'>('eventDesc');
  
  // Custom Tooltip State
  const [activeTooltip, setActiveTooltip] = useState<any>(null);
  const [pinnedTooltip, setPinnedTooltip] = useState<any>(null);
  const [activeClassTooltip, setActiveClassTooltip] = useState<any>(null);
  const [pinnedClassTooltip, setPinnedClassTooltip] = useState<any>(null);

  // Group points by event and class
  const eventPointsMap: Record<string, number> = {};
  const classData = [
    { name: 'FR', points: 0, color: '#39FF14', swimmers: [] as SwimmerResult[] },
    { name: 'SO', points: 0, color: '#00F5FF', swimmers: [] as SwimmerResult[] },
    { name: 'JR', points: 0, color: '#FF00FF', swimmers: [] as SwimmerResult[] },
    { name: 'SR', points: 0, color: '#FFD700', swimmers: [] as SwimmerResult[] },
  ];

  // Filter out time trials from event map logic
  const filteredSwimmers = team.swimmers.filter(s => !s.isTimeTrial);

  filteredSwimmers.forEach(s => {
    if (!eventPointsMap[s.event]) eventPointsMap[s.event] = 0;
    eventPointsMap[s.event] += typeof s.points === 'number' ? s.points : 0;
    const entry = classData.find(d => d.name === s.classYear);
    if (entry) {
      entry.points += typeof s.points === 'number' ? s.points : 0;
      entry.swimmers.push(s);
    }
  });

  const eventData = Object.entries(eventPointsMap)
    .map(([name, points]) => {
      const swimmers = filteredSwimmers.filter(s => s.event === name);
      return { 
        name: name.replace(' Freestyle', ' Free').replace('Individual Medley', 'IM').replace('Backstroke', 'Back').replace('Breaststroke', 'Breast').replace('Butterfly', 'Fly').substring(0, 12), 
        fullEvent: name, 
        points,
        swimmers 
      };
    });

  // Always sort chronological for the line chart if eventsList is provided
  if (eventsList.length > 0) {
    eventData.sort((a, b) => eventsList.indexOf(a.fullEvent) - eventsList.indexOf(b.fullEvent));
  } else {
    eventData.sort((a, b) => b.points - a.points);
  }

  // Group by swimmer for drill-down
  let topSwimmers = Object.values(
    filteredSwimmers.reduce((acc, s) => {
      if (!acc[s.name]) {
        acc[s.name] = { 
          name: s.name, 
          points: 0, 
          swimmers: [],
          classYear: s.classYear
        };
      }
      acc[s.name].points += typeof s.points === 'number' ? s.points : 0;
      acc[s.name].swimmers.push(s);
      return acc;
    }, {} as Record<string, any>)
  ).sort((a, b) => b.points - a.points);
  
  if (searchQuery) {
    const lowerQ = searchQuery.toLowerCase();
    topSwimmers = topSwimmers.filter((s: any) => s.name.toLowerCase().includes(lowerQ));
  }

  // Group by event for drill-down
  let topEvents = Object.values(
    filteredSwimmers.reduce((acc, s) => {
      if (!acc[s.event]) {
        acc[s.event] = { 
          event: s.event, 
          points: 0, 
          swimmers: [],
        };
      }
      acc[s.event].points += typeof s.points === 'number' ? s.points : 0;
      acc[s.event].swimmers.push(s);
      return acc;
    }, {} as Record<string, any>)
  ).sort((a, b) => b.points - a.points);
  
  if (searchQuery) {
    const lowerQ = searchQuery.toLowerCase();
    topEvents = topEvents.filter((e: any) => e.event.toLowerCase().includes(lowerQ));
  }

  // Apply sorting suboptions
  if (viewMode === 'swimmer') {
    topSwimmers.sort((a, b) => sortMode === 'swimmerAsc' ? a.points - b.points : b.points - a.points);
  } else {
    if (sortMode === 'chrono' && eventsList.length > 0) {
      topEvents.sort((a, b) => eventsList.indexOf(a.event) - eventsList.indexOf(b.event));
    } else if (sortMode === 'eventAsc') {
      topEvents.sort((a, b) => a.points - b.points);
    } else {
      topEvents.sort((a, b) => b.points - a.points); // eventDesc (default)
    }
  }

  // Custom tooltips renderer logic to avoid recharts z-index and positioning issues
  const renderTooltipContent = (data: any, isPinned = false, isClass = false) => {
    let topPerformers: [string, number][] = [];
    if (isClass && data.swimmers) {
      const swimmerPts: Record<string, number> = {};
      data.swimmers.forEach((s: SwimmerResult) => {
        if (!swimmerPts[s.name]) swimmerPts[s.name] = 0;
        swimmerPts[s.name] += typeof s.points === 'number' ? s.points : 0;
      });
      topPerformers = Object.entries(swimmerPts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    }

    return (
      <div 
        className="bg-[#0c0f16] border border-gray-800 p-3 shadow-xl shadow-black/50 z-[999] pointer-events-auto h-full flex flex-col"
        style={{ 
          resize: isPinned ? 'both' : 'none', 
          overflow: 'hidden',
          minWidth: '220px',
          minHeight: '120px',
          containerType: 'size', // Container queries for dynamic resizing
        }}
      >
        {isPinned && (
          <div className="absolute top-1 right-1 cursor-pointer text-gray-500 hover:text-white" onClick={() => isClass ? setPinnedClassTooltip(null) : setPinnedTooltip(null)}>
            ✕
          </div>
        )}
        <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-800 shrink-0">
          <h4 className="font-bold text-rose-400 uppercase tracking-widest" style={{ fontSize: 'clamp(8px, 5cqi, 12px)' }}>
            {isClass ? `Class of ${data.name}` : data.fullEvent}
          </h4>
          <span className="font-mono font-black" style={{ fontSize: 'clamp(9px, 6cqi, 14px)' }}>{data.points.toFixed(1)} PTS</span>
        </div>
        
        <div className="space-y-1 mt-2 flex-1 overflow-y-auto custom-scrollbar">
          {isClass ? (
            <>
              <div className="text-gray-500 font-bold uppercase mb-1" style={{ fontSize: 'clamp(7px, 4cqi, 10px)' }}>Top Performers</div>
              {topPerformers.length > 0 ? topPerformers.map(([name, pts], idx) => (
                <div key={idx} className="flex items-center justify-between py-0.5 border-b border-gray-800/30 last:border-0 swimmer-row" style={{ fontSize: 'clamp(8px, 4.5cqi, 11px)' }}>
                  <span className="font-medium text-gray-200 truncate pr-2 max-w-[150px]">{name}</span>
                  <span className="font-mono text-emerald-400 font-bold">{pts.toFixed(1)}</span>
                </div>
              )) : (
                <div className="text-gray-500 text-[9px] italic">No scoring swimmers</div>
              )}
            </>
          ) : (
            data.swimmers && data.swimmers.length > 0 ? data.swimmers.map((s: any, idx: number) => {
              // Compute Cutlines dynamically
              const timeSec = convertTimeToSeconds(s.finalsTime || s.time);
              const cleanEvent = s.event.replace(" (Avg Split)", "").replace(/ Yard /i, " ").replace(/ Meter /i, " ").trim();
              const cutsForEvent = cutlines.filter(c => c.gender.toUpperCase() === (gender === Gender.MEN ? 'MEN' : 'WOMEN') && c.event.toUpperCase() === cleanEvent.toUpperCase());
              
              const aCut = cutsForEvent.find(c => c.standard === 'A');
              const bCut = cutsForEvent.find(c => c.standard === 'B');
              
              const aCutSec = aCut ? convertTimeToSeconds(aCut.time_25_26) : 0;
              const bCutSec = bCut ? convertTimeToSeconds(bCut.time_25_26) : 0;
              
              const isACut = aCutSec > 0 && timeSec <= aCutSec;
              const isBCut = !isACut && bCutSec > 0 && timeSec <= bCutSec;

              return (
                <div key={idx} className="flex items-center justify-between py-1 border-b border-gray-800/50 last:border-0 swimmer-row" style={{ fontSize: 'clamp(7px, 4.5cqi, 11px)' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-4 font-mono text-gray-500">{s.rank || '-'}</span>
                    {s.podium === 'gold' && <span className="text-yellow-400" title="Gold">🥇</span>}
                    {s.podium === 'silver' && <span className="text-gray-300" title="Silver">🥈</span>}
                    {s.podium === 'bronze' && <span className="text-orange-400" title="Bronze">🥉</span>}
                    <span className="font-medium text-gray-200 truncate max-w-[120px]">{s.name}</span>
                    {isACut && <span className="text-[7px] bg-rose-400/10 text-rose-400 px-1 border border-rose-400/30 rounded-sm ml-1" title="A CUT">A CUT</span>}
                    {isBCut && <span className="text-[7px] bg-amber-400/10 text-amber-400 px-1 border border-amber-400/30 rounded-sm ml-1" title="B CUT">B CUT</span>}
                  </div>
                  <div className="flex gap-3 text-right">
                    <span className="font-mono text-gray-500">{s.prelimsTime ? `P:${s.prelimsTime}` : ''}</span>
                    <span className="font-mono text-gray-300">{s.finalsTime ? `F:${s.finalsTime}` : s.time}</span>
                    <span className="font-mono text-emerald-400 font-bold">{typeof s.points === 'number' ? s.points.toFixed(1) : s.points}</span>
                  </div>
                </div>
              );
            }) : (
              <div className="text-gray-500 text-[9px] italic">No scoring swimmers</div>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`neon-card rounded-md overflow-hidden mb-4`} style={{ borderLeftColor: team.color }}>
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/2 transition-colors"
      >
        <div className="flex flex-col items-start gap-1">
          <h3 className="text-sm font-black uppercase tracking-tighter text-[var(--text-primary)]">{team.teamName}</h3>
          <div className="flex gap-2">
            <span className="text-[9px] text-theme-secondary uppercase tracking-widest font-medium">NSISC • {topSwimmers.length} Athletes</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="block text-2xl font-black text-rose-400 font-mono tracking-tighter leading-none">
              {team.totalPoints.toFixed(1)}
            </span>
            <span className="text-[9px] text-theme-secondary uppercase tracking-widest font-medium font-mono">Projected Points</span>
          </div>
          {isExpanded ? <ChevronUp size={16} className="text-theme-secondary" /> : <ChevronDown size={16} className="text-theme-secondary" />}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-theme-soft surface-overlay"
          >
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Stats & Charts */}
              <div className="lg:col-span-8 space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 size={14} className="text-rose-400" />
                  <span className="text-[10px] font-medium uppercase tracking-widest text-theme-secondary">Total Points by Event & Class</span>
                </div>
                
                <div className="space-y-4">
                  {/* Event Chart */}
                  <div className="h-48 w-full surface-overlay p-2 rounded border border-theme-soft relative group/chart">
                    {/* Hover Tooltip (Absolute relative to chart) */}
                    {!pinnedTooltip && activeTooltip && (
                      <div 
                        className="absolute pointer-events-none rounded-lg overflow-hidden transition-all duration-100"
                        style={{ 
                          left: `${Math.min(Math.max(10, activeTooltip.x - 125), activeTooltip.containerWidth - 260)}px`, 
                          top: `${Math.max(10, activeTooltip.y - 140)}px`,
                          width: '250px',
                          zIndex: 999 
                        }}
                      >
                        {renderTooltipContent(activeTooltip.payload)}
                      </div>
                    )}
                    
                    {/* Pinned Tooltip (Draggable, Resizable) */}
                    {pinnedTooltip && (
                      <motion.div 
                        drag
                        dragConstraints={{ left: -100, right: 300, top: -50, bottom: 200 }}
                        className="absolute z-[1000] rounded-lg shadow-2xl shadow-black/80 overflow-hidden"
                        style={{ 
                          left: `${Math.min(Math.max(10, pinnedTooltip.x - 125), pinnedTooltip.containerWidth - 260)}px`, 
                          top: `${Math.max(10, pinnedTooltip.y - 140)}px`
                        }}
                      >
                        {renderTooltipContent(pinnedTooltip.payload, true)}
                      </motion.div>
                    )}

                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={eventData} onMouseLeave={() => setActiveTooltip(null)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 8, fontStyle: 'bold', fontFamily: 'JetBrains Mono' }} interval="preserveStartEnd" />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 8, fontStyle: 'bold', fontFamily: 'JetBrains Mono' }} width={30} />
                        {/* We use a hidden tooltip just to ensure chart layout behaves, but disable its rendering */}
                        <Tooltip content={<></>} cursor={{ stroke: 'rgba(255,255,255,0.05)', strokeWidth: 1 }} />
                        <Line 
                          type="monotone" 
                          dataKey="points" 
                          stroke="#F43F5E" 
                          strokeWidth={2} 
                          dot={{ r: 4, fill: '#0c0f16', stroke: '#F43F5E', strokeWidth: 2 }} 
                          activeDot={(props: any) => {
                            const { cx, cy, payload } = props;
                            return (
                              <g>
                                <circle cx={cx} cy={cy} r={6} fill="#F43F5E" stroke="#fff" strokeWidth={2} />
                                <circle 
                                  cx={cx} cy={cy} r={20} fill="transparent"
                                  style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                                  onMouseEnter={(e) => {
                                    const rect = (e.target as Element).closest('.recharts-wrapper')?.getBoundingClientRect();
                                    setActiveTooltip({ x: cx, y: cy, payload, containerWidth: rect?.width || 500 });
                                  }}
                                  onMouseLeave={() => setActiveTooltip(null)}
                                  onClick={(e) => {
                                    const rect = (e.target as Element).closest('.recharts-wrapper')?.getBoundingClientRect();
                                    setPinnedTooltip({ x: cx, y: cy, payload, containerWidth: rect?.width || 500 });
                                    setActiveTooltip(null);
                                  }}
                                />
                              </g>
                            );
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Class Chart */}
                  <div className="h-40 w-full surface-overlay p-2 rounded border border-theme-soft relative group/chart">
                    {/* Hover Tooltip (Absolute relative to chart) */}
                    {!pinnedClassTooltip && activeClassTooltip && (
                      <div 
                        className="absolute pointer-events-none rounded-lg overflow-hidden transition-all duration-100"
                        style={{ 
                          left: `${Math.min(Math.max(10, activeClassTooltip.x - 110), activeClassTooltip.containerWidth - 230)}px`, 
                          top: `${Math.max(10, activeClassTooltip.y - 120)}px`,
                          width: '220px',
                          zIndex: 999 
                        }}
                      >
                        {renderTooltipContent(activeClassTooltip.payload, false, true)}
                      </div>
                    )}
                    
                    {/* Pinned Tooltip (Draggable, Resizable) */}
                    {pinnedClassTooltip && (
                      <motion.div 
                        drag
                        dragConstraints={{ left: -100, right: 300, top: -100, bottom: 200 }}
                        className="absolute z-[1000] rounded-lg shadow-2xl shadow-black/80 overflow-hidden"
                        style={{ 
                          left: `${Math.min(Math.max(10, pinnedClassTooltip.x - 110), pinnedClassTooltip.containerWidth - 230)}px`, 
                          top: `${Math.max(10, pinnedClassTooltip.y - 120)}px`
                        }}
                      >
                        {renderTooltipContent(pinnedClassTooltip.payload, true, true)}
                      </motion.div>
                    )}

                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={classData} onMouseLeave={() => setActiveClassTooltip(null)}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10, fontStyle: 'bold', fontFamily: 'JetBrains Mono' }} />
                        <Tooltip content={<></>} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                        <Bar 
                          dataKey="points" 
                          radius={[2, 2, 0, 0]}
                          onClick={(data, index, e) => {
                            const rect = (e.target as Element).closest('.recharts-wrapper')?.getBoundingClientRect();
                            setPinnedClassTooltip({ 
                              x: (e as any).clientX - (rect?.left || 0), 
                              y: (e as any).clientY - (rect?.top || 0), 
                              payload: data, 
                              containerWidth: rect?.width || 500 
                            });
                            setActiveClassTooltip(null);
                          }}
                          onMouseEnter={(data, index, e) => {
                            const rect = (e.target as Element).closest('.recharts-wrapper')?.getBoundingClientRect();
                            setActiveClassTooltip({ 
                              x: (e as any).clientX - (rect?.left || 0), 
                              y: (e as any).clientY - (rect?.top || 0), 
                              payload: data, 
                              containerWidth: rect?.width || 500 
                            });
                          }}
                          onMouseLeave={() => setActiveClassTooltip(null)}
                          style={{ cursor: 'pointer' }}
                        >
                          {classData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} opacity={0.8} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="flex justify-between mt-2 px-2 text-[10px] text-theme-secondary font-mono border-t border-theme-soft pt-2 italic uppercase">
                  <span>Chronological Event Scoring Timeline</span>
                  <span>{eventData.reduce((acc, d) => acc + d.points, 0).toFixed(1)} PTS TOTAL</span>
                </div>
              </div>

              {/* Individual/Event Matrix */}
              <div className="lg:col-span-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <List size={14} className="text-rose-400" />
                    <span className="text-[10px] font-medium uppercase tracking-widest text-theme-secondary">Team Matrix</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select 
                      className="bg-[#0c0f16] border border-theme-soft text-[9px] uppercase tracking-widest text-theme-secondary rounded p-1 outline-none"
                      value={sortMode}
                      onChange={(e) => setSortMode(e.target.value as any)}
                    >
                      {viewMode === 'event' && <option value="chrono">Chronological</option>}
                      {viewMode === 'event' && <option value="eventDesc">High to Low</option>}
                      {viewMode === 'event' && <option value="eventAsc">Low to High</option>}
                      {viewMode === 'swimmer' && <option value="swimmerDesc">High to Low</option>}
                      {viewMode === 'swimmer' && <option value="swimmerAsc">Low to High</option>}
                    </select>

                    <div className="flex items-center surface-overlay border border-theme-soft rounded p-0.5">
                      <button 
                        onClick={() => { setViewMode('event'); setSortMode('eventDesc'); }}
                        className={`text-[9px] px-2 py-1 uppercase tracking-widest rounded ${viewMode === 'event' ? 'bg-[var(--surface-strong)]/60 text-[var(--text-primary)]' : 'text-theme-secondary hover:text-[var(--text-primary)]'}`}
                      >
                        By Event
                      </button>
                      <button 
                        onClick={() => { setViewMode('swimmer'); setSortMode('swimmerDesc'); }}
                        className={`text-[9px] px-2 py-1 uppercase tracking-widest rounded ${viewMode === 'swimmer' ? 'bg-[var(--surface-strong)]/60 text-[var(--text-primary)]' : 'text-theme-secondary hover:text-[var(--text-primary)]'}`}
                      >
                        By Swimmer
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {(viewMode === 'swimmer' ? topSwimmers : topEvents).map((group: any) => (
                    <div key={group.name || group.event} className="p-3 rounded surface-overlay border border-theme-soft group transition-all hover:border-[var(--border)]">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <h4 className="text-xs font-medium text-[var(--text-primary)] uppercase group-hover:text-[var(--text-accent)] transition-colors">
                            {viewMode === 'swimmer' ? group.name : group.event}
                          </h4>
                          {viewMode === 'swimmer' && (
                            <span className="px-1.5 py-0.5 rounded surface-overlay border border-theme-soft text-[9px] font-mono font-medium text-theme-secondary">
                              {group.classYear}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-black text-[var(--text-primary)] text-xs">{group.points.toFixed(1)} <span className="text-[8px] text-theme-secondary">PTS</span></span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {group.swimmers.map((res: SwimmerResult, i: number) => {
                          const timeSec = convertTimeToSeconds(res.time);
                          const cleanEvent = res.event.replace(" (Avg Split)", "").replace(/ Yard /i, " ").replace(/ Meter /i, " ").trim();
                          const cutsForEvent = cutlines.filter(c => c.gender.toUpperCase() === (gender === Gender.MEN ? 'MEN' : 'WOMEN') && c.event.toUpperCase() === cleanEvent.toUpperCase());
                          
                          const aCut = cutsForEvent.find(c => c.standard === 'A');
                          const bCut = cutsForEvent.find(c => c.standard === 'B');
                          
                          const aCutSec = aCut ? convertTimeToSeconds(aCut.time_25_26) : 0;
                          const bCutSec = bCut ? convertTimeToSeconds(bCut.time_25_26) : 0;
                          
                          const isACut = aCutSec > 0 && timeSec <= aCutSec;
                          const isBCut = !isACut && bCutSec > 0 && timeSec <= bCutSec;

                          const yearsRemaining = getYearsRemaining(res.classYear as ClassYear);
                          const targetProp = yearsRemaining === 1 ? 'proj_26_27' : yearsRemaining === 2 ? 'proj_27_28' : yearsRemaining >= 3 ? 'proj_28_29' : null;
                          let willMakeFutureCut = null;
                          if (targetProp && !res.isRelay) {
                             const futureACutSec = aCut ? convertTimeToSeconds((aCut as any)[targetProp]) : 0;
                             const futureBCutSec = bCut ? convertTimeToSeconds((bCut as any)[targetProp]) : 0;
                             if (futureACutSec > 0 && timeSec <= futureACutSec) willMakeFutureCut = 'A';
                             else if (futureBCutSec > 0 && timeSec <= futureBCutSec) willMakeFutureCut = 'B';
                          }

                          return (
                            <div key={i} className="flex items-center justify-between text-[10px] py-1.5 border-t border-theme-soft">
                              <div className="flex items-center gap-2 text-theme-secondary font-mono w-1/3">
                                <span className="w-4 font-medium text-theme-secondary">{res.rank || '-'}</span>
                                <span className="truncate max-w-[150px]" title={viewMode === 'swimmer' ? res.event : res.name}>
                                  {viewMode === 'swimmer' ? res.event : res.name}
                                </span>
                                {res.roundSwam && <span className="text-[8px] surface-overlay px-1 rounded truncate max-w-[60px]">{res.roundSwam}</span>}
                              </div>
                              <div className="flex flex-col items-end gap-0.5 justify-center w-1/3 text-right">
                                {res.prelimsTime && (
                                  <div className="text-[9px] text-theme-secondary font-mono">
                                    Prelim: {res.prelimsTime}
                                  </div>
                                )}
                                {res.finalsTime && (
                                  <div 
                                    className={`font-mono font-medium cursor-pointer hover:underline ${isACut ? 'text-rose-400' : isBCut ? 'text-amber-400' : 'text-theme-secondary'}`}
                                    onClick={() => { if(onUpdateTime && res.id) { setEditingResultId(res.id); setEditValue(res.time); } }}
                                  >
                                    Final: {res.finalsTime}
                                  </div>
                                )}
                                {!res.finalsTime && !res.prelimsTime && (
                                  <div 
                                    className={`font-mono font-medium cursor-pointer hover:underline ${isACut ? 'text-rose-400' : isBCut ? 'text-amber-400' : 'text-theme-secondary'}`}
                                    onClick={() => { if(onUpdateTime && res.id) { setEditingResultId(res.id); setEditValue(res.time); } }}
                                  >
                                    {res.time}
                                  </div>
                                )}
                                {willMakeFutureCut && (
                                  <div className="text-[8px] text-[var(--text-accent)] font-mono mt-0.5">
                                    Beats Future {willMakeFutureCut}-Cut ({targetProp?.replace('proj_', "'").replace('_', "-'")})
                                  </div>
                                )}
                                {editingResultId === res.id && (
                                  <form 
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      if(onUpdateTime && res.id) onUpdateTime(res.id, editValue);
                                      setEditingResultId(null);
                                    }}
                                    className="flex w-full mt-1 border border-theme-soft rounded overflow-hidden"
                                  >
                                    <input 
                                      type="text" 
                                      autoFocus
                                      value={editValue} 
                                      onChange={e => setEditValue(e.target.value)} 
                                      className="surface-muted-bg text-[10px] px-1 py-0.5 outline-none font-mono flex-1 text-[var(--text-primary)]" 
                                      onBlur={() => setEditingResultId(null)}
                                    />
                                  </form>
                                )}
                              </div>
                              <div className="flex items-center justify-end gap-2 w-1/3">
                                {isACut && <span title="Current A Cut Achieved" className="text-[8px] bg-rose-400/10 text-rose-400 px-1 border border-rose-400/30 rounded-sm">A CUT</span>}
                                {isBCut && <span title="Current B Cut Achieved" className="text-[8px] bg-amber-400/10 text-amber-400 px-1 border border-amber-400/30 rounded-sm">B CUT</span>}
                                <span className={`font-mono font-medium w-8 text-right ${res.points === 'N/A' || res.points === 0 ? 'text-theme-secondary' : 'text-emerald-500'}`}>
                                  {res.points === 'N/A' ? 'N/A' : `+${res.points}`}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
