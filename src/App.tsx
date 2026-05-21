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
  Waves,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Gender, Workspace, SwimmerResult, Recruit, ClassYear, ScoringSettings } from './types';
import OpsModule from './components/OpsModule';
import ScoringSettingsModal from './components/ScoringSettingsModal';
import DeleteConfirmationModal from './components/DeleteConfirmationModal';
import { mergeScoringSettings } from './lib/scoringDefaults';

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
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = window.localStorage.getItem('omni-theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('omni-theme', theme);
  }, [theme]);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces');
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setWorkspaces(list);
      setActiveWorkspaceId(current => {
        if (list.length === 0) return null;
        if (current != null && list.some(w => w.id === current)) return current;
        return list[0].id;
      });
    } catch (err) {
      console.error('Failed to fetch workspaces', err);
    } finally {
      setIsLoading(false);
    }
  }, []); // Intentionally empty: only bootstrap fetch; selection changes handled separately

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
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg)]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Waves className="w-12 h-12 text-[var(--text-accent)]" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="app-shell flex flex-col h-screen overflow-hidden relative">
      {/* Undo Toast */}
      <AnimatePresence>
        {deletedWorkspaceBackup && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className="fixed bottom-12 left-1/2 z-50 toast-undo px-6 py-3 rounded-full flex items-center gap-4"
          >
            <span className="text-xs uppercase tracking-widest font-bold">Workspace Deleted</span>
            <button 
              onClick={undoDeleteWorkspace}
              className="bg-[var(--text-accent)] text-white px-3 py-1 rounded text-xs font-bold uppercase hover:opacity-90 transition-colors"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="app-header h-16 flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 flex items-center justify-center bg-[var(--surface-muted)] rounded shadow border border-[var(--border)] overflow-hidden" style={{ boxShadow: '0 4px 12px var(--shadow)' }}>
            <img src="/OMNISWIMLOGO.png" alt="Omni Swim Logo" className="w-full h-full object-contain p-1" />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-[var(--text-primary)]">OMNI SWIM <span className="text-[var(--text-accent)] font-semibold">MATRIX</span></h1>
        </div>

        <div className="flex items-center gap-2">
          <nav className="flex gap-1 bg-[var(--surface)] p-1 rounded-md border border-[var(--border)]">
            <button 
              onClick={() => setActiveGender(Gender.MEN)}
              className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all ${
                activeGender === Gender.MEN ? 'nav-tab-active' : 'nav-tab-inactive'
              }`}
            >
              Men's Operations
            </button>
            <button 
              onClick={() => setActiveGender(Gender.WOMEN)}
              className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-sm transition-all ${
                activeGender === Gender.WOMEN ? 'nav-tab-active' : 'nav-tab-inactive'
              }`}
            >
              Women's Operations
            </button>
          </nav>

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="theme-toggle-button p-2 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Toggle color mode"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {activeWorkspace && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowSettingsParamsManager(true)}
                className="p-1.5 theme-hover-row rounded btn-accent-outline transition-colors"
                title="Configure Scoring Model"
              >
                <Settings size={14} />
              </button>
              <div className="px-3 py-1.5 text-[10px] font-mono bg-[var(--surface-muted)] text-[var(--text-accent)] border border-[var(--text-accent)]/20 rounded-full flex items-center">
                <span className="truncate max-w-[150px]">WORKSPACE: {activeWorkspace.name.toUpperCase().replace(/\s+/g, '_')}</span>
              </div>
            </div>
          )}
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse ml-2"></div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Workspace Sidebar */}
        <aside className="workspace-sidebar w-64 flex flex-col">
          <div className="p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[10px] uppercase tracking-widest text-theme-muted font-bold">Active Sessions</h2>
              <button 
                onClick={createWorkspace}
                className="p-1 theme-hover-row rounded text-theme-secondary hover:text-[var(--text-primary)] transition-colors"
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
                      ? 'surface-card border-[var(--text-accent)]' 
                      : 'surface-soft border-theme-soft theme-hover-row'
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
                        className="surface-muted-bg text-[var(--text-accent)] text-xs font-bold border border-[var(--text-accent)]/50 rounded px-1 outline-none w-full"
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span 
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingWorkspaceId(w.id); setEditWorkspaceName(w.name); }}
                        className={`text-xs font-bold truncate ${activeWorkspaceId === w.id ? 'text-[var(--text-primary)]' : 'text-theme-secondary'}`}
                        title="Double click to rename"
                      >
                        {w.name.toUpperCase()}
                      </span>
                    )}
                    <FileText size={12} className={activeWorkspaceId === w.id ? 'text-[var(--text-accent)] shrink-0' : 'text-theme-secondary shrink-0'} />
                  </div>
                  <div className="text-[9px] text-theme-muted mt-1 uppercase font-mono">
                    {new Date(w.createdAt).toLocaleDateString()}
                  </div>
                </button>
                <button 
                  onClick={(e) => initDeleteWorkspace(w.id, e)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-[var(--text-accent)]/15 text-theme-muted hover:text-[var(--text-accent)] rounded transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-auto p-4 border-t border-theme surface-overlay">
            <button className="w-full flex items-center justify-center gap-2 py-2 bg-[var(--surface-strong)] text-[var(--text-primary)] font-bold rounded border border-[var(--border)] hover:bg-[var(--surface-strong)]/90 uppercase tracking-widest transition-colors">
              <Download size={14} />
              <span>Export Matrix</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main-content flex-1 overflow-y-auto">
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
            <div className="h-full flex flex-col items-center justify-center text-theme-secondary space-y-4">
              <div className="p-6 rounded border border-theme surface-card">
                <AlertCircle size={48} className="text-theme-secondary" />
              </div>
              <p className="text-xs uppercase tracking-widest font-bold text-[var(--text-primary)]">No Workspace Selected</p>
              <button onClick={createWorkspace} className="px-6 py-2 bg-[var(--text-accent)] border border-[var(--text-accent)]/30 text-white uppercase tracking-widest text-[10px] font-bold rounded-sm hover:bg-[var(--text-accent)]/90 transition-colors">
                Initialize System
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="app-footer h-8 px-4 flex items-center justify-between text-[10px] font-mono">
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><div className="w-1 h-1 bg-green-500 rounded-full" /> SYSTEM: READY</span>
          <span>PDF ENGINE: active v2.1</span>
          <span>DB: MEETS.JSON</span>
        </div>
        <div className="flex gap-4">
          <span className="text-theme-muted uppercase font-bold tracking-tighter">© 2026 NIHAR VITTHANALA, NOW OMNI SWIM ANALYTICS GROUP</span>
        </div>
      </footer>

      {showSettingsParamsManager && activeWorkspace && (
        <ScoringSettingsModal 
          settings={mergeScoringSettings(activeWorkspace.scoringSettings, {
            conference: activeWorkspace.conference,
            resultsForPdfHint: [
              ...(activeWorkspace.menResults ?? []),
              ...(activeWorkspace.womenResults ?? []),
            ],
          })}
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

