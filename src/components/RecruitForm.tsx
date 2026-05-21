/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { Gender, ClassYear, Recruit } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  gender: Gender;
  teams: string[];
  onSubmit: (recruit: Recruit) => void;
  disabled?: boolean;
}

const EVENTS = [
  '50 Freestyle', '100 Freestyle', '200 Freestyle', '500 Freestyle', '1000 Freestyle', '1650 Freestyle',
  '100 Backstroke', '200 Backstroke', '100 Breaststroke', '200 Breaststroke',
  '100 Butterfly', '200 Butterfly', '200 IM', '400 IM',
  '50 Freestyle (Relay split)', '100 Freestyle (Relay split)',
  '50 Breaststroke (Relay split)', '100 Breaststroke (Relay split)',
  '50 Butterfly (Relay split)', '100 Butterfly (Relay split)',
];

export default function RecruitForm({ gender, teams, onSubmit, disabled = false }: Props) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    team: teams[0] || 'Unassigned',
    event: EVENTS[0],
    time: '',
    timeType: 'SCY' as 'SCY' | 'LCM' | 'SCM',
    classYear: ClassYear.FR
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    if (!formData.firstName || !formData.lastName || !formData.time) return;

    const recruit: Recruit = {
      id: uuidv4(),
      name: `${formData.lastName}, ${formData.firstName}`,
      team: formData.team,
      event: formData.event,
      time: formData.time,
      gender: gender,
      classYear: formData.classYear,
      timeType: formData.timeType
    };

    onSubmit(recruit);
    setFormData({ ...formData, firstName: '', lastName: '', time: '' });
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <div>
        <label className="block text-[10px] uppercase text-theme-muted font-bold mb-1.5">Athlete Name</label>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={formData.firstName}
            onChange={e => setFormData({ ...formData, firstName: e.target.value })}
            className="glass-input w-full"
            placeholder="First"
          />
          <input
            type="text"
            value={formData.lastName}
            onChange={e => setFormData({ ...formData, lastName: e.target.value })}
            className="glass-input w-full"
            placeholder="Last"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase text-theme-muted font-bold mb-1.5">Committed Team</label>
          <select
            value={formData.team}
            onChange={e => setFormData({ ...formData, team: e.target.value })}
            className="glass-input w-full appearance-none"
          >
            {teams.length > 0 ? (
              teams.map(t => <option key={t} value={t}>{t}</option>)
            ) : (
              <option value="Unassigned">Unassigned</option>
            )}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase text-theme-muted font-bold mb-1.5">Course</label>
          <select
            value={formData.timeType}
            onChange={e => setFormData({ ...formData, timeType: e.target.value as any })}
            className="glass-input w-full appearance-none"
          >
            <option value="SCY">SCY (Yards)</option>
            <option value="LCM">LCM (Meters)</option>
            <option value="SCM">SCM (Meters)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase text-theme-muted font-bold mb-1.5">Event Selection</label>
        <div className="grid grid-cols-2 gap-3">
          <select
            value={formData.event}
            onChange={e => setFormData({ ...formData, event: e.target.value })}
            className="glass-input w-full appearance-none"
          >
            {EVENTS.map(ev => <option key={ev} value={ev}>{ev}</option>)}
          </select>
          <select
            value={formData.classYear}
            onChange={e => setFormData({ ...formData, classYear: e.target.value as ClassYear })}
            className="glass-input w-full appearance-none"
          >
            <option value={ClassYear.FR}>Freshman (FR)</option>
            <option value={ClassYear.SO}>Sophomore (SO)</option>
            <option value={ClassYear.JR}>Junior (JR)</option>
            <option value={ClassYear.SR}>Senior (SR)</option>
            <option value={ClassYear.HS}>High School (HS)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] uppercase text-theme-muted font-bold mb-1.5">Time Entry (Auto-Convert Enabled)</label>
        <input
          type="text"
          value={formData.time}
          onChange={e => setFormData({ ...formData, time: e.target.value })}
          className="glass-input w-full font-mono text-[var(--text-primary)]"
          placeholder="00:00.00"
        />
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="w-full py-3 mt-2 btn-recruit font-black text-[10px] uppercase tracking-[0.2em] rounded transition-all flex items-center justify-center gap-2"
      >
        <Play size={12} fill="currentColor" />
        <span>Inject Recruit Into Matrix</span>
      </button>
    </form>
  );
}
