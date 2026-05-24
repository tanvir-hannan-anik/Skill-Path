import { useRef, useState } from 'react';
import { Plus, Check, Trash2, Pencil, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { type Workspace, WORKSPACE_COLORS } from '../types';

interface Props {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  onSwitch: (wsId: string) => void;
  onCreate: (name: string) => Promise<string>;
  onDelete: (wsId: string) => void;
  onRename: (wsId: string, name: string) => void;
}

export function WorkspaceSwitcher({ workspaces, activeWorkspaceId, onSwitch, onCreate, onDelete, onRename }: Props) {
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const createInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await onCreate(name);
      setNewName('');
      setShowCreate(false);
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  const handleRenameSubmit = (wsId: string) => {
    const name = renameValue.trim();
    if (name) onRename(wsId, name);
    setRenamingId(null);
  };

  const handleDelete = (wsId: string) => {
    onDelete(wsId);
    setDeletingId(null);
    if (wsId === activeWorkspaceId) setOpen(false);
  };

  return (
    <div className="relative">
      {/* Trigger — shows active workspace */}
      <button
        onClick={() => { setOpen((o) => !o); setShowCreate(false); setRenamingId(null); setDeletingId(null); }}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-[18px] border border-border-strong shadow-sm hover:shadow-md transition-all group"
      >
        <div
          className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-white text-sm font-bold shadow-sm"
          style={{ backgroundColor: activeWs?.color ?? WORKSPACE_COLORS[0] }}
        >
          {(activeWs?.name ?? 'W')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-0.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
            Active Workspace
          </div>
          <div className="font-display font-medium text-sm text-primary truncate leading-tight">
            {activeWs?.name ?? 'My Workspace'}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-text-muted shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-border-strong rounded-[20px] shadow-xl z-50 overflow-hidden"
          >
            {/* Workspace list */}
            <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
              {workspaces.map((ws) => {
                const isActive = ws.id === activeWorkspaceId;
                const isRenaming = renamingId === ws.id;
                const isDeleting = deletingId === ws.id;

                return (
                  <div key={ws.id}>
                    {isRenaming ? (
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <div
                          className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: ws.color }}
                        >
                          {ws.name[0].toUpperCase()}
                        </div>
                        <input
                          ref={renameInputRef}
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit(ws.id);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          className="flex-1 text-sm border border-border-strong rounded-lg px-2 py-1 outline-none focus:border-primary bg-canvas"
                        />
                        <button onClick={() => handleRenameSubmit(ws.id)} className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setRenamingId(null)} className="w-7 h-7 rounded-lg border border-border-strong flex items-center justify-center shrink-0 text-text-muted hover:text-primary">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : isDeleting ? (
                      <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-xl">
                        <p className="text-xs text-red-700 font-medium mb-2">Delete "{ws.name}"?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDelete(ws.id)}
                            className="flex-1 text-xs py-1 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="flex-1 text-xs py-1 border border-border-strong rounded-lg font-medium text-text-secondary hover:text-primary transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={`flex items-center gap-2 px-2 py-2 rounded-xl cursor-pointer group/ws transition-colors ${isActive ? 'bg-canvas' : 'hover:bg-canvas/60'}`}>
                        <button
                          onClick={() => { onSwitch(ws.id); setOpen(false); }}
                          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                        >
                          <div
                            className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm"
                            style={{ backgroundColor: ws.color }}
                          >
                            {ws.name[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-primary truncate leading-tight">{ws.name}</div>
                            {ws.level && (
                              <div className="text-[10px] text-text-muted">{ws.level}</div>
                            )}
                          </div>
                          {isActive && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </button>

                        {/* Action buttons — shown on hover */}
                        <div className="flex items-center gap-1 opacity-0 group-hover/ws:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => { setRenamingId(ws.id); setRenameValue(ws.name); setTimeout(() => renameInputRef.current?.focus(), 50); }}
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-text-muted hover:text-primary hover:bg-white transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          {workspaces.length > 1 && (
                            <button
                              onClick={() => setDeletingId(ws.id)}
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Create workspace form */}
            <div className="border-t border-border-strong p-2">
              {showCreate ? (
                <div className="space-y-2">
                  <input
                    ref={createInputRef}
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate();
                      if (e.key === 'Escape') { setShowCreate(false); setNewName(''); }
                    }}
                    placeholder="Workspace name (e.g. React, Python…)"
                    className="w-full text-sm border border-border-strong rounded-xl px-3 py-2 outline-none focus:border-primary bg-canvas placeholder:text-text-muted/60"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreate}
                      disabled={creating || !newName.trim()}
                      className="flex-1 text-sm py-1.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {creating ? 'Creating…' : 'Create'}
                    </button>
                    <button
                      onClick={() => { setShowCreate(false); setNewName(''); }}
                      className="flex-1 text-sm py-1.5 border border-border-strong rounded-xl font-medium text-text-secondary hover:text-primary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setShowCreate(true); setTimeout(() => createInputRef.current?.focus(), 50); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-text-secondary hover:text-primary hover:bg-canvas transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New workspace
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Click-outside overlay */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setShowCreate(false); }} />
      )}
    </div>
  );
}
