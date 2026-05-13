import React, { useState } from 'react';
import { X, Save, RefreshCw } from 'lucide-react';
import { ScoringSettings } from '../types';

interface Props {
  settings: ScoringSettings;
  onSave: (s: ScoringSettings) => void;
  onClose: () => void;
}

export default function ScoringSettingsModal({ settings, onSave, onClose }: Props) {
  const [places, setPlaces] = useState(settings.scoringPoints.length);
  const [points, setPoints] = useState<number[]>([...settings.scoringPoints]);
  const [relayMultiplier, setRelayMultiplier] = useState(settings.relayMultiplier);
  const [halfRate, setHalfRate] = useState(settings.halfRateRelaySwimmer);

  const [maxIndividualScorersPerTeam, setMaxIndividualScorersPerTeam] = useState(settings.maxIndividualScorersPerTeam ?? 4);
  const [maxRelaysScoringPerTeam, setMaxRelaysScoringPerTeam] = useState(settings.maxRelaysScoringPerTeam ?? 1);

  const handlePlacesChange = (p: number) => {
    setPlaces(p);
    const newPoints = [...points];
    while (newPoints.length < p) newPoints.push(0);
    setPoints(newPoints.slice(0, p));
  };

  const handlePointChange = (idx: number, val: number) => {
    const newP = [...points];
    newP[idx] = val;
    setPoints(newP);
  };

  const setDefaults = () => {
    handlePlacesChange(16);
    setPoints([20, 17, 16, 15, 14, 13, 12, 11, 9, 7, 6, 5, 4, 3, 2, 1]);
    setRelayMultiplier(2);
    setHalfRate(true);
  };

  const set24Places = () => {
    handlePlacesChange(24);
    setPoints([32, 28, 27, 26, 25, 24, 23, 22, 20, 17, 16, 15, 14, 13, 12, 11, 9, 7, 6, 5, 4, 3, 2, 1]);
    setRelayMultiplier(2);
    setHalfRate(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0c0f16] border border-[#1f2937] rounded-lg p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium text-white uppercase tracking-tight">Scoring Matrix Configuration</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6 text-sm">
          
          <div className="flex gap-4 border-b border-[#1f2937] pb-6">
             <div>
               <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-medium mb-2">Preset Configurations</label>
               <div className="flex gap-2">
                 <button onClick={setDefaults} className="px-3 py-1.5 bg-[#1f2937] hover:bg-gray-700 text-white rounded text-xs transition-colors border border-transparent">Top 16 (Standard)</button>
                 <button onClick={set24Places} className="px-3 py-1.5 bg-[#1f2937] hover:bg-gray-700 text-white rounded text-xs transition-colors border border-transparent">Top 24</button>
               </div>
             </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[10px] text-gray-500 uppercase tracking-widest font-medium border-b border-[#1f2937] pb-2">Individual Points Setup</h3>
            <div className="flex items-center gap-4">
              <label className="text-gray-300">Scoring Places:</label>
              <select 
                value={places}
                onChange={e => handlePlacesChange(parseInt(e.target.value))}
                className="bg-black border border-[#1f2937] text-white p-1 rounded font-mono"
              >
                <option value={8}>8 Places</option>
                <option value={12}>12 Places</option>
                <option value={16}>16 Places</option>
                <option value={20}>20 Places</option>
                <option value={24}>24 Places</option>
                <option value={30}>30 Places</option>
              </select>
            </div>

            <div className="grid grid-cols-4 md:grid-cols-6 gap-3 pt-2">
              {points.map((pt, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500 font-mono">Place {i + 1}</span>
                  <input 
                    type="number" 
                    value={pt || ''} 
                    onChange={e => handlePointChange(i, parseFloat(e.target.value) || 0)}
                    className="w-full bg-black border border-[#1f2937] p-2 rounded text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-[#1f2937]">
            <h3 className="text-[10px] text-gray-500 uppercase tracking-widest font-medium pb-2 border-b border-[#1f2937]">Relay Constraints</h3>
            <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-300 mb-2">Relay Multiplier</label>
                  <select 
                    value={relayMultiplier}
                    onChange={e => setRelayMultiplier(parseFloat(e.target.value))}
                    className="w-full bg-black border border-[#1f2937] p-2 rounded text-white font-mono focus:outline-none focus:border-cyan-400"
                  >
                    <option value={1}>1x (Same as individual)</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x (Double points)</option>
                    <option value={4}>4x (Quadruple points)</option>
                  </select>
                </div>
                
                <div className="flex flex-col justify-center">
                  <label className="flex items-center gap-3 text-gray-300 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={halfRate}
                      onChange={e => setHalfRate(e.target.checked)}
                      className="accent-cyan-400"
                    />
                    <span>Divide points per athlete (25%)</span>
                  </label>
                  <p className="text-[10px] text-gray-500 mt-2 ml-6">If enabled, a 40pt relay win awards 10pts per individual swimmer. Otherwise it awards 40pts per individual.</p>
                </div>
            </div>
          </div>
          
        </div>

        <div className="pt-6 mt-2 border-t border-[#1f2937] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 hover:bg-white/5 rounded text-gray-400 transition-colors">Cancel</button>
          <button 
            onClick={() => onSave({ scoringPoints: points, relayMultiplier, halfRateRelaySwimmer: halfRate, maxIndividualScorersPerTeam, maxRelaysScoringPerTeam })}
            className="px-6 py-2 bg-cyan-900 border border-cyan-400 text-cyan-400 rounded font-medium shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all flex items-center gap-2"
          >
            <Save size={16} />
            Update Scoring Model
          </button>
        </div>
      </div>
    </div>
  );
}
