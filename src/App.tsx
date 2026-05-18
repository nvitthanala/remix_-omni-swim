/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Trophy, 
  Users, 
  FileText, 
  Settings, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Download,
  AlertCircle,
  BarChart3,
  Waves
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Gender, Workspace, SwimmerResult, Recruit, ClassYear, ScoringSettings } from './types';
import OpsModule from './components/OpsModule';
import ScoringSettingsModal from './components/ScoringSettingsModal';
import DeleteConfirmationModal from './components/DeleteConfirmationModal';

export default function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeGender, setActiveGender] = useState<Gender>(Gender.MEN);
  const [isLoading, setIsLoading] = useState(true);

  const [showSettingsParamsManager, setShowSettingsParamsManager] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<string | null>(null);
  const [deletedWorkspaceBackup, setDeletedWorkspaceBackup] = useState<Workspace | null>(null);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editWorkspaceName, setEditWorkspaceName] = useState('');
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces');
      const data = await res.json();
      setWorkspaces(data);
      if (data.length > 0 && !activeWorkspaceId) {
        setActiveWorkspaceId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch workspaces', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  const createWorkspace = async () => {
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Blank Workspace ${workspaces.length + 1}` }),
    });
    const newData = await res.json();
    setWorkspaces([...workspaces, newData]);
    setActiveWorkspaceId(newData.id);
  };
  
  const handleRenameWorkspace = async (id: string) => {
    if (!editWorkspaceName.trim()) {
      setEditingWorkspaceId(null);
      return;
    }
    const res = await fetch(`/api/workspaces/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editWorkspaceName }),
    });
    const data = await res.json();
    setWorkspaces(workspaces.map(w => w.id === id ? data : w));
    setEditingWorkspaceId(null);
  };

  const updateWorkspace = async (updated: Partial<Workspace>) => {
    if (!activeWorkspaceId) return;
    const res = await fetch(`/api/workspaces/${activeWorkspaceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    const data = await res.json();
    setWorkspaces(workspaces.map(w => w.id === activeWorkspaceId ? data : w));
  };

  const initDeleteWorkspace = (id: string, e: any) => {
    e.stopPropagation();
    setWorkspaceToDelete(id);
  };

  const confirmDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    
    // Backup for undo
    const backup = workspaces.find(w => w.id === workspaceToDelete);
    if (backup) {
      setDeletedWorkspaceBackup(backup);
    }

    // Call API
    await fetch(`/api/workspaces/${workspaceToDelete}`, { method: 'DELETE' });
    
    // Update local state
    setWorkspaces(workspaces.filter(w => w.id !== workspaceToDelete));
    if (activeWorkspaceId === workspaceToDelete) {
      setActiveWorkspaceId(workspaces.filter(w => w.id !== workspaceToDelete)[0]?.id || null);
    }
    setWorkspaceToDelete(null);

    // Set timeout to clear undo buffer
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => {
      setDeletedWorkspaceBackup(null);
    }, 15000); // 15 seconds to undo
  };

  const undoDeleteWorkspace = async () => {
    if (!deletedWorkspaceBackup) return;
    
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = null;
    
    // Post back to create
    // However, the api overrides `id` normally. We should maybe let it create a new ID and just use the old content.
    // Or we update our POST to accept ID if provided
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deletedWorkspaceBackup),
    });
    const newData = await res.json();
    
    setWorkspaces([...workspaces, newData]);
    setActiveWorkspaceId(newData.id);
    setDeletedWorkspaceBackup(null);
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0A0A0A]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Waves className="w-12 h-12 text-[#00F5FF]" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#05070a] text-gray-200 overflow-hidden relative">
      {/* Undo Toast */}
      <AnimatePresence>
        {deletedWorkspaceBackup && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-12 left-1/2 z-50 bg-[#c2410c]/20 border border-orange-500/30 text-orange-400 px-6 py-3 rounded-full shadow-lg shadow-black/50 flex items-center gap-4"
          >
            <span className="text-xs uppercase tracking-widest font-bold">Workspace Deleted</span>
            <button 
              onClick={undoDeleteWorkspace}
              className="bg-orange-500 text-gray-900 px-3 py-1 rounded text-xs font-bold uppercase hover:bg-orange-400 transition-colors"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 bg-[#0c0f16] border-b border-[#1f2937] z-20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 flex items-center justify-center bg-[#51131c] rounded shadow shadow-rose-900/20 border border-rose-500/20 overflow-hidden">
            <img src="/OMNISWIMLOGO.png" alt="Omni Swim Logo" className="w-full h-full object-contain p-1" />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-white">OMNI SWIM <span className="text-rose-400 font-normal">MATRIX</span></h1>
        </div>

        <nav className="flex gap-1 bg-black p-1 rounded-md border border-[#1f2937]">
          <button 
            onClick={() => setActiveGender(Gender.MEN)}
            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all ${
              activeGender === Gender.MEN 
                ? 'bg-[#1f2937] text-rose-400' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Men's Operations
          </button>
          <button 
            onClick={() => setActiveGender(Gender.WOMEN)}
            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all ${
              activeGender === Gender.WOMEN 
                ? 'bg-[#1f2937] text-rose-400' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Women's Operations
          </button>
        </nav>

        <div className="flex items-center gap-3">
          {activeWorkspace && (
            <div className="flex items-center gap-2">
               <button 
                onClick={() => setShowSettingsParamsManager(true)}
                className="p-1.5 hover:bg-white/10 rounded text-rose-400 border border-rose-400/20 bg-rose-900/20 transition-colors"
                title="Configure Scoring Model"
              >
                <Settings size={14} />
              </button>
              <div className="px-3 py-1.5 text-[10px] font-mono bg-rose-900/30 text-rose-400 border border-rose-400/30 rounded-full flex items-center">
                <span className="truncate max-w-[150px]">WORKSPACE: {activeWorkspace.name.toUpperCase().replace(/\s+/g, '_')}</span>
              </div>
            </div>
          )}
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse ml-2"></div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Workspace Sidebar */}
        <aside className="w-64 bg-[#080b11] border-r border-[#1f2937] flex flex-col">
          <div className="p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Active Sessions</h2>
              <button 
                onClick={createWorkspace}
                className="p-1 hover:bg-white/5 rounded text-gray-400 hover:text-white transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            {workspaces.map(w => (
              <div key={w.id} className="relative group">
                <button
                  onClick={() => setActiveWorkspaceId(w.id)}
                  className={`flex flex-col p-3 rounded-r-md border-l-4 transition-all w-full text-left ${
                    activeWorkspaceId === w.id 
                      ? 'bg-[#111622] border-rose-400' 
                      : 'bg-[#111622]/40 border-gray-800 hover:bg-[#111622]/60'
                  }`}
                >
                  <div className="flex justify-between items-start w-full pr-6">
                    {editingWorkspaceId === w.id ? (
                      <input
                        autoFocus
                        value={editWorkspaceName}
                        onChange={e => setEditWorkspaceName(e.target.value)}
                        onBlur={() => handleRenameWorkspace(w.id)}
                        onKeyDown={e => e.key === 'Enter' && handleRenameWorkspace(w.id)}
                        className="bg-black text-rose-400 text-xs font-bold border border-rose-400/50 rounded px-1 outline-none w-full"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span 
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingWorkspaceId(w.id); setEditWorkspaceName(w.name); }}
                        className={`text-xs font-bold truncate ${activeWorkspaceId === w.id ? 'text-white' : 'text-gray-500'}`}
                        title="Double click to rename"
                      >
                        {w.name.toUpperCase()}
                      </span>
                    )}
                    <FileText size={12} className={activeWorkspaceId === w.id ? 'text-rose-400 shrink-0' : 'text-gray-500 shrink-0'} />
                  </div>
                  <div className="text-[9px] text-gray-500 mt-1 uppercase font-mono">
                    {new Date(w.createdAt).toLocaleDateString()}
                  </div>
                </button>
                <button 
                  onClick={(e) => initDeleteWorkspace(w.id, e)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-auto p-4 border-t border-[#1f2937] bg-black/20">
            <button className="w-full flex items-center justify-center gap-2 py-2 bg-gray-800 text-[10px] font-bold rounded border border-gray-700 hover:bg-gray-700 uppercase tracking-widest transition-colors">
              <Download size={14} />
              <span>Export Matrix</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#05070a]">
          {activeWorkspace ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeWorkspaceId}-${activeGender}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-6"
              >
                <OpsModule 
                  workspace={activeWorkspace} 
                  gender={activeGender}
                  onUpdate={updateWorkspace}
                />
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
              <div className="p-6 rounded border border-[#1f2937] bg-[#0c0f16]">
                <AlertCircle size={48} className="text-gray-500" />
              </div>
              <p className="text-xs uppercase tracking-widest font-bold">No Workspace Selected</p>
              <button onClick={createWorkspace} className="px-6 py-2 bg-rose-900 border border-rose-500/50 text-rose-400 uppercase tracking-widest text-[10px] font-bold rounded-sm hover:bg-rose-800 transition-colors">
                Initialize System
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="h-8 bg-black border-t border-[#1f2937] px-4 flex items-center justify-between text-[10px] text-gray-500 font-mono">
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><div className="w-1 h-1 bg-green-500 rounded-full" /> SYSTEM: READY</span>
          <span>PDF ENGINE: active v2.1</span>
          <span>DB: MEETS.JSON</span>
        </div>
        <div className="flex gap-4">
          <span className="text-rose-900 uppercase font-bold tracking-tighter">© 2026 NIHAR VITTHANALA, NOW OMNI SWIM ANALYTICS GROUP</span>
        </div>
      </footer>

      {showSettingsParamsManager && activeWorkspace && (
        <ScoringSettingsModal 
          settings={activeWorkspace.scoringSettings || { scoringPoints: [20,17,16,15,14,13,12,11,9,7,6,5,4,3,2,1], relayMultiplier: 2, halfRateRelaySwimmer: true }}
          onSave={(settings) => {
            updateWorkspace({ scoringSettings: settings });
            setShowSettingsParamsManager(false);
          }}
          onClose={() => setShowSettingsParamsManager(false)}
        />
      )}

      {workspaceToDelete && (
        <DeleteConfirmationModal
          workspaceName={workspaces.find(w => w.id === workspaceToDelete)?.name || 'Unknown Workspace'}
          onConfirm={confirmDeleteWorkspace}
          onCancel={() => setWorkspaceToDelete(null)}
        />
      )}
    </div>
  );
}

