import { Home, Compass, CheckSquare, Calendar as CalendarIcon, Lightbulb, LogOut, LogIn, Map } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { ReactNode, useMemo } from 'react';
import { motion } from 'motion/react';
import { NavItem, Workspace } from '../types';
import { rollingFiveDays } from '../lib/dates';
import { useAuth } from '../lib/AuthContext';

interface Props {
  activeTab: NavItem;
  onChangeTab: (tab: NavItem) => void;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSwitchWorkspace: (wsId: string) => void;
  onCreateWorkspace: (name: string) => Promise<string>;
  onDeleteWorkspace: (wsId: string) => void;
  onRenameWorkspace: (wsId: string, name: string) => void;
  selectedDate: string;
  onDateSelect: (date: string) => void;
}

const NAV_ITEMS: { id: NavItem; label: string; icon: ReactNode }[] = [
  { id: 'dashboard', label: 'Overview', icon: <Home className="w-[18px] h-[18px]" /> },
  { id: 'learn', label: 'Learn', icon: <Compass className="w-[18px] h-[18px]" /> },
  { id: 'plan', label: 'Plan', icon: <Map className="w-[18px] h-[18px]" /> },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="w-[18px] h-[18px]" /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarIcon className="w-[18px] h-[18px]" /> },
  { id: 'insights', label: 'Insights', icon: <Lightbulb className="w-[18px] h-[18px]" /> },
];

export function Sidebar({
  activeTab,
  onChangeTab,
  workspaces,
  activeWorkspaceId,
  onSwitchWorkspace,
  onCreateWorkspace,
  onDeleteWorkspace,
  onRenameWorkspace,
  selectedDate,
  onDateSelect,
}: Props) {
  const { user } = useAuth();
  const dates = useMemo(() => rollingFiveDays(), []);
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Learner';

  return (
    <div className="w-[280px] min-w-[280px] h-full flex flex-col pt-6 pb-4">
      {/* Logo */}
      <div className="px-6 flex items-center gap-3 mb-6">
        <img src="/LOGO.png" alt="SkillPath" className="w-10 h-10 rounded-[12px] object-contain shadow-lg shadow-black/10" />
        <span className="font-display font-semibold text-2xl tracking-tight text-primary">SkillPath</span>
      </div>

      {/* Workspace switcher */}
      <div className="px-5 mb-5">
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitch={onSwitchWorkspace}
          onCreate={onCreateWorkspace}
          onDelete={onDeleteWorkspace}
          onRename={onRenameWorkspace}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-[16px] text-sm font-medium transition-colors relative group outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {isActive && (
                <motion.div
                  layoutId="navIndicator"
                  className="absolute inset-0 bg-white border border-border-strong rounded-[16px] shadow-sm z-0"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                />
              )}
              <div className={`relative z-10 flex items-center gap-4 ${isActive ? 'text-primary' : 'text-text-secondary group-hover:text-primary'}`}>
                {item.icon}
                {item.label}
              </div>
            </button>
          );
        })}
      </nav>

      {/* This Week mini calendar */}
      <div className="px-5 mt-4 mb-3">
        <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-4">This Week</div>
        <div className="flex justify-between items-center bg-white rounded-[20px] p-2 border border-border-strong shadow-sm">
          {dates.map((d) => {
            const isSelected = selectedDate === d.fullDate;
            const isToday = d.status === 'today';
            return (
              <button
                key={d.fullDate}
                onClick={() => onDateSelect(d.fullDate)}
                aria-label={`Select ${d.fullDate}${isToday ? ' (today)' : ''}`}
                className={`relative flex flex-col items-center justify-center w-[42px] py-1.5 rounded-[14px] transition-colors ${
                  isSelected ? 'bg-primary text-white shadow-md' : 'hover:bg-canvas text-text-secondary'
                }`}
              >
                <span className={`text-[9px] uppercase font-bold tracking-wider mb-0.5 ${isSelected ? 'text-white/80' : 'text-text-muted'}`}>{d.day}</span>
                <span className="text-sm font-display font-medium relative">
                  {d.date}
                  {isToday && !isSelected && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Theme + auth */}
      <div className="px-5 mb-3 flex items-center justify-between text-text-secondary">
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Theme</span>
        <ThemeToggle />
      </div>

      <div className="px-5">
        {user ? (
          <button
            onClick={() => onChangeTab('profile')}
            className="w-full flex items-center justify-between px-4 py-3 rounded-[16px] text-sm font-medium bg-white border border-border-strong text-text-secondary hover:text-primary transition-colors shadow-sm"
            title="Sign out"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-semibold shrink-0">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
              <span className="truncate">{displayName}</span>
            </div>
            <LogOut className="w-4 h-4 shrink-0" />
          </button>
        ) : (
          <button
            onClick={() => onChangeTab('profile')}
            className="w-full flex items-center justify-between px-4 py-3 rounded-[16px] text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-7 h-7 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0">
                <LogIn className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="truncate leading-tight">Sign in to save</span>
                <span className="text-[10px] text-white/60 font-medium uppercase tracking-wider">Guest mode</span>
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
