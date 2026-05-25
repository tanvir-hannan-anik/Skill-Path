import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Menu, X, Layers, Compass, Map, CheckSquare, Calendar as CalendarIcon, Lightbulb, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NavItem, DayContent, WORKSPACE_COLORS, genWorkspaceId } from '../types';
import { Sidebar } from './Sidebar';
import { LearnContentView } from './LearnContentView';
import { TasksPage } from './TasksPage';
import { ProfilePage } from './ProfilePage';
import { FullPageLoader } from './ui/FullPageLoader';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/toast';
import { useSchedule } from '../hooks/useSchedule';
import { useWorkspaces } from '../hooks/useWorkspaces';
import { useStreak } from '../hooks/useStreak';
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
  const streak = useStreak(schedule);

  // Only block the full UI on workspace loading; schedule loading renders inline skeletons.
  const loading = wsLoading;

  const handleUpdateDay = (date: string, day: DayContent) => updateDay(date, day);

  const handleNav = (tab: NavItem) => {
    setMobileSidebarOpen(false);
    if (tab === 'profile') {
      if (!user) { onRequestAuth(); return; }
      setActiveTab('profile');
      return;
    }
    setActiveTab(tab);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.info('You have been signed out.');
    } catch {
      toast.error('Sign out failed.');
    }
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
    streak,
  };

  if (loading) return <FullPageLoader label="Loading your workspace…" />;

  return (
    <div className="flex h-[100dvh] bg-canvas p-2 sm:p-3 md:p-4 gap-3 md:gap-4 overflow-hidden relative">
      {/* Mobile hamburger — only shown to open drawer for workspace/date controls */}
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="md:hidden fixed top-4 left-4 z-30 w-11 h-11 rounded-full bg-white border border-border-strong shadow-md flex items-center justify-center text-primary"
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile bottom navigation bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onChangeTab={handleNav}
        streak={streak}
        userPhotoURL={user?.photoURL ?? null}
        displayName={user?.displayName || user?.email?.split('@')[0] || null}
      />

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
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-16 pt-16 sm:pt-6 pb-24 sm:pb-6 flex flex-col min-h-0">
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
                      uid={user?.uid ?? null}
                      wsId={activeWorkspaceId || ''}
                      date={selectedDate}
                      day={schedule[selectedDate] ?? EMPTY_DAY}
                      onUpdateDay={(d) => handleUpdateDay(selectedDate, d)}
                      onScheduleVideoForDate={(date, video) => {
                        const dayData = schedule[date] ?? EMPTY_DAY;
                        if (!dayData.videos.some((v) => v.url === video.url)) {
                          handleUpdateDay(date, { ...dayData, videos: [...dayData.videos, video] });
                        }
                      }}
                      onUnscheduleVideoForDate={(date, videoUrl) => {
                        const dayData = schedule[date] ?? EMPTY_DAY;
                        handleUpdateDay(date, { ...dayData, videos: dayData.videos.filter((v) => v.url !== videoUrl) });
                      }}
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

              {activeTab === 'profile' && (
                <ProfilePage
                  schedule={schedule}
                  onRequestAuth={onRequestAuth}
                  onLogout={handleLogout}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// ---- Mobile bottom navigation bar -------------------------------------------

interface MobileNavProps {
  activeTab: NavItem;
  onChangeTab: (tab: NavItem) => void;
  streak: number;
  userPhotoURL: string | null;
  displayName: string | null;
}

const MOBILE_NAV: { id: NavItem; icon: ReactNode; label: string }[] = [
  { id: 'learn', icon: <Compass className="w-5 h-5" />, label: 'Learn' },
  { id: 'tasks', icon: <CheckSquare className="w-5 h-5" />, label: 'Tasks' },
  { id: 'plan', icon: <Map className="w-5 h-5" />, label: 'Plan' },
  { id: 'calendar', icon: <CalendarIcon className="w-5 h-5" />, label: 'Calendar' },
  { id: 'insights', icon: <Lightbulb className="w-5 h-5" />, label: 'Insights' },
];

function MobileBottomNav({ activeTab, onChangeTab, streak, userPhotoURL, displayName }: MobileNavProps) {
  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur-md border-t border-border-strong safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {MOBILE_NAV.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-0 ${
                isActive ? 'text-primary' : 'text-text-muted'
              }`}
            >
              <div className={`relative ${isActive ? 'text-primary' : 'text-text-muted'}`}>
                {item.icon}
                {isActive && (
                  <motion.div
                    layoutId="mobileNavDot"
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
        {/* Profile button */}
        <button
          onClick={() => onChangeTab('profile')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-0 ${
            activeTab === 'profile' ? 'text-primary' : 'text-text-muted'
          }`}
        >
          <div className="relative">
            {userPhotoURL ? (
              <img src={userPhotoURL} alt="" referrerPolicy="no-referrer" crossOrigin="anonymous" className="w-5 h-5 rounded-full object-cover ring-1 ring-border-strong" />
            ) : displayName ? (
              <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            ) : (
              <User className="w-5 h-5" />
            )}
            {streak > 0 && (
              <div className="absolute -top-1.5 -right-2 bg-orange-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {streak > 99 ? '99+' : streak}
              </div>
            )}
            {activeTab === 'profile' && (
              <motion.div
                layoutId="mobileNavDot"
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
              />
            )}
          </div>
          <span className="text-[10px] font-medium">Profile</span>
        </button>
      </div>
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
