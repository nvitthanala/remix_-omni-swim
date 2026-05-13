import React, { useState } from 'react';
import { Settings, Save } from 'lucide-react';
import { ScoringSettings } from '../types';

export default function ScoringSettingsPanel({ settings, onSave }: { settings: ScoringSettings, onSave: (s: ScoringSettings) => void }) {
  const [localSettings, setLocalSettings] = useState<ScoringSettings>(settings);
  const [pointsStr, setPointsStr] = useState(settings.scoringPoints.join(', '));

  return (
    <div className="bg-[#0c0f16] border border-[#1f2937] rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[10px] font-medium text-gray-500 uppercase tracking-widest flex items-center gap-2">
          <Settings size={12} />
          Custom Scoring Logic
        </h4>
        <button 
          onClick={() => {
            const arr = pointsStr.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
            onSave({ ...localSettings, scoringPoints: arr });
          }}
          className="text-[10px] bg-cyan-900/30 text-cyan-400 px-2 py-1 rounded hover:bg-cyan-900/50 transition-colors uppercase font-medium flex items-center gap-1"
        >
          <Save size={10} /> Save
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[10px] text-gray-500 uppercase mb-1">Points Distribution (comma separated)</label>
          <input 
            value={pointsStr}
            onChange={e => setPointsStr(e.target.value)}
            className="w-full bg-[#131823] border border-[#1f2937] text-xs text-white p-2 rounded outline-none focus:border-cyan-500/50 font-mono"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Relay Multiplier</label>
            <input 
              type="number"
              value={localSettings.relayMultiplier}
              onChange={e => setLocalSettings({...localSettings, relayMultiplier: parseFloat(e.target.value) || 1})}
              className="w-full bg-[#131823] border border-[#1f2937] text-xs text-white p-2 rounded outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Half Points for Relay Only</label>
            <select
              value={localSettings.halfRateRelaySwimmer ? "yes" : "no"}
              onChange={e => setLocalSettings({...localSettings, halfRateRelaySwimmer: e.target.value === "yes"})}
              className="w-full bg-[#131823] border border-[#1f2937] text-xs text-white p-2 rounded outline-none focus:border-cyan-500/50 uppercase"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Max Individual Scorers / Team</label>
            <input 
              type="number"
              value={localSettings.maxIndividualScorersPerTeam}
              onChange={e => setLocalSettings({...localSettings, maxIndividualScorersPerTeam: parseInt(e.target.value) || 4})}
              className="w-full bg-[#131823] border border-[#1f2937] text-xs text-white p-2 rounded outline-none focus:border-cyan-500/50"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase mb-1">Max Relays Scorers / Team</label>
            <input 
              type="number"
              value={localSettings.maxRelaysScoringPerTeam}
              onChange={e => setLocalSettings({...localSettings, maxRelaysScoringPerTeam: parseInt(e.target.value) || 1})}
              className="w-full bg-[#131823] border border-[#1f2937] text-xs text-white p-2 rounded outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
