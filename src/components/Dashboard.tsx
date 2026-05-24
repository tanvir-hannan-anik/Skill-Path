import { lazy, Suspense, useState } from 'react';
import { Menu, X, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NavItem, DayContent, WORKSPACE_COLORS, genWorkspaceId } from '../types';
import { Sidebar } from './Sidebar';
import { LearnContentView } from './LearnContentView';
import { TasksPage } from './TasksPage';
import { FullPageLoader } from './ui/FullPageLoader';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/toast';
import { useSchedule } from '../hooks/useSchedule';
import { useWorkspaces } from '../hooks/useWorkspaces';
import { toDateKey } from '../lib/dates';

const InsightsPage = lazy(() => import('./InsightsPage').then(m => ({ default: m.InsightsPage })));
const CalendarView = lazy(() => import('./CalendarView').then(m => ({ default: m.CalendarView })));
const PlanPage = lazy(() => import('./PlanPage').then(m => ({ default: m.PlanPage })));

interface Props {
  onRequestAuth: () => void;
}

const EMPTY_DAY: DayContent = { videos: [], docs: [], tasks: [] };

export function Dashboard({ onRequestAuth }: Props) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<NavItem>('learn');
  const [selectedDate, setSelectedDate] = useState(() => toDateKey());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    loading: wsLoading,
    createWorkspace,
    switchWorkspace,
    deleteWorkspace,
    updateWorkspace,
  } = useWorkspaces(user?.uid ?? null);

  const { schedule, loading: schedLoading, updateDay } = useSchedule(
    user?.uid ?? null,
    activeWorkspaceId || null,
  );

  // Only block the full UI on workspace loading; schedule loading renders inline skeletons.
  const loading = wsLoading;

  const handleUpdateDay = (date: string, day: DayContent) => updateDay(date, day);

  const handleNav = async (tab: NavItem) => {
    setMobileSidebarOpen(false);
    if (tab === 'profile') {
      if (!user) { onRequestAuth(); return; }
      try {
        await logout();
        toast.info('You have been signed out.');
      } catch {
        toast.error('Sign out failed.');
      }
      return;
    }
    setActiveTab(tab);
  };

  const handleSwitchWorkspace = async (wsId: string) => {
    await switchWorkspace(wsId);
    // Reset to learn tab and today's date when switching context
    setActiveTab('learn');
    setSelectedDate(toDateKey());
  };

  const sidebarProps = {
    activeTab,
    onChangeTab: handleNav,
    workspaces,
    activeWorkspaceId,
    onSwitchWorkspace: handleSwitchWorkspace,
    onCreateWorkspace: createWorkspace,
    onDeleteWorkspace: deleteWorkspace,
    onRenameWorkspace: (wsId: string, name: string) => updateWorkspace(wsId, { name }),
    selectedDate,
    onDateSelect: (d: string) => { setSelectedDate(d); setActiveTab('learn'); },
  };

  if (loading) return <FullPageLoader label="Loading your workspace…" />;

  return (
    <div className="flex h-[100dvh] bg-canvas p-2 sm:p-3 md:p-4 gap-3 md:gap-4 overflow-hidden relative">
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="md:hidden fixed top-4 left-4 z-30 w-11 h-11 rounded-full bg-white border border-border-strong shadow-md flex items-center justify-center text-primary"
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar {...sidebarProps} />
      </div>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              className="md:hidden fixed top-0 left-0 bottom-0 z-50 bg-canvas w-[300px] max-w-[85vw] shadow-2xl flex flex-col"
            >
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white border border-border-strong flex items-center justify-center text-primary"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
              <Sidebar
                {...sidebarProps}
                onDateSelect={(d) => { setSelectedDate(d); setActiveTab('learn'); setMobileSidebarOpen(false); }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 bg-surface rounded-[24px] md:rounded-[32px] overflow-hidden shadow-[0_8px_40px_rgb(0,0,0,0.03)] border border-border-strong relative flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-16 pt-16 md:pt-6 pb-4 sm:py-6 flex flex-col min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}-${activeWorkspaceId}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex-1 flex flex-col min-h-0 h-full"
            >
              {activeTab === 'dashboard' && (
                <WorkspaceOverview
                  workspaces={workspaces}
                  activeWorkspaceId={activeWorkspaceId}
                  onSwitch={handleSwitchWorkspace}
                  onCreate={createWorkspace}
                  onDelete={deleteWorkspace}
                  onRename={(wsId, name) => updateWorkspace(wsId, { name })}
                />
              )}

              {activeTab === 'learn' && (
                schedLoading
                  ? <ContentSkeleton />
                  : <LearnContentView
                      date={selectedDate}
                      day={schedule[selectedDate] ?? EMPTY_DAY}
                      onUpdateDay={(d) => handleUpdateDay(selectedDate, d)}
                    />
              )}

              {activeTab === 'tasks' && (
                schedLoading
                  ? <ContentSkeleton />
                  : <TasksPage
                      date={selectedDate}
                      day={schedule[selectedDate] ?? EMPTY_DAY}
                      onUpdateDay={(d) => handleUpdateDay(selectedDate, d)}
                    />
              )}

              {activeTab === 'calendar' && (
                <Suspense fallback={<FullPageLoader label="Loading calendar…" />}>
                  <CalendarView
                    onClose={() => setActiveTab('learn')}
                    schedule={schedule}
                    onSelectDate={(date) => { setSelectedDate(date); setActiveTab('learn'); }}
                  />
                </Suspense>
              )}

              {activeTab === 'plan' && (
                <Suspense fallback={<FullPageLoader label="Loading plan…" />}>
                  <PlanPage
                    schedule={schedule}
                    onUpdateDay={handleUpdateDay}
                    workspaceName={activeWorkspace?.name ?? 'My Workspace'}
                  />
                </Suspense>
              )}

              {activeTab === 'insights' && (
                <Suspense fallback={<FullPageLoader label="Loading insights…" />}>
                  <InsightsPage skill={activeWorkspace?.name ?? ''} schedule={schedule} />
                </Suspense>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// ---- Content skeleton shown while schedule data loads -----------------------

function ContentSkeleton() {
  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 animate-pulse">
      <div className="h-48 bg-primary/10 rounded-[24px]" />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-3 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-border-subtle rounded-[20px]" />
          ))}
        </div>
        <div className="md:col-span-2 h-48 bg-border-subtle rounded-[24px]" />
      </div>
    </div>
  );
}

// ---- Workspace overview page ------------------------------------------------

interface OverviewProps {
  workspaces: import('../types').Workspace[];
  activeWorkspaceId: string;
  onSwitch: (wsId: string) => void;
  onCreate: (name: string) => Promise<string>;
  onDelete: (wsId: string) => void;
  onRename: (wsId: string, name: string) => void;
}

function WorkspaceOverview({ workspaces, activeWorkspaceId, onSwitch, onCreate, onDelete, onRename }: OverviewProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await onCreate(name);
      setNewName('');
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-medium text-3xl text-primary">Workspaces</h1>
          <p className="text-text-muted text-sm mt-1">Each workspace is a separate skill or learning track.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-2xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
        >
          <Layers className="w-4 h-4" />
          New workspace
        </button>
      </div>

      {showCreate && (
        <div className="bg-white border border-border-strong rounded-2xl p-5 shadow-sm space-y-3">
          <h3 className="font-medium text-primary">New workspace</h3>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setShowCreate(false); setNewName(''); } }}
            placeholder="Skill name (e.g. React, Python, UI Design…)"
            className="w-full border border-border-strong rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-canvas placeholder:text-text-muted/60"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating || !newName.trim()} className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors">
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => { setShowCreate(false); setNewName(''); }} className="px-4 py-2 border border-border-strong rounded-xl text-sm text-text-secondary hover:text-primary transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {workspaces.map((ws) => {
          const isActive = ws.id === activeWorkspaceId;
          const isRenaming = renamingId === ws.id;
          return (
            <div
              key={ws.id}
              className={`relative bg-white border rounded-2xl p-5 shadow-sm transition-all group ${isActive ? 'border-primary/30 ring-2 ring-primary/10' : 'border-border-strong hover:border-primary/20 hover:shadow-md'}`}
            >
              {/* Active badge */}
              {isActive && (
                <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/8 px-2 py-0.5 rounded-full border border-primary/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Active
                </div>
              )}

              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-base font-bold shadow-sm shrink-0"
                  style={{ backgroundColor: ws.color }}
                >
                  {ws.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { onRename(ws.id, renameValue); setRenamingId(null); }
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onBlur={() => { if (renameValue.trim()) onRename(ws.id, renameValue); setRenamingId(null); }}
                      className="font-display font-medium text-lg text-primary border-b-2 border-primary bg-transparent outline-none w-full"
                    />
                  ) : (
                    <h3 className="font-display font-medium text-lg text-primary truncate">{ws.name}</h3>
                  )}
                  {ws.level && <p className="text-xs text-text-muted mt-0.5">{ws.level}{ws.hoursPerDay ? ` · ${ws.hoursPerDay}h/day` : ''}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isActive && (
                  <button
                    onClick={() => onSwitch(ws.id)}
                    className="flex-1 py-1.5 bg-primary/8 text-primary text-xs font-medium rounded-xl hover:bg-primary/15 transition-colors border border-primary/20"
                  >
                    Switch to this
                  </button>
                )}
                <button
                  onClick={() => { setRenamingId(ws.id); setRenameValue(ws.name); }}
                  className="p-1.5 rounded-xl text-text-muted hover:text-primary hover:bg-canvas transition-colors text-xs"
                  title="Rename"
                >
                  Rename
                </button>
                {workspaces.length > 1 && (
                  <button
                    onClick={() => onDelete(ws.id)}
                    className="p-1.5 rounded-xl text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors text-xs"
                    title="Delete"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
