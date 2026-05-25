import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Play, FileText, HelpCircle, ClipboardList, StickyNote,
  ChevronLeft, ChevronRight, X, Clock, ExternalLink, Trash2,
  AlertCircle, FolderOpen, Search, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Schedule, DayContent, Resource, QuizPlan, AssignmentPlan, NotePlan, YouTubeResult } from '../types';
import { toDateKey } from '../lib/dates';
import { searchYouTube, isYouTubeConfigured, videoIdToUrl, formatDuration } from '../lib/youtube';
import { SEARCH_PROVIDERS } from '../lib/search';

interface Props {
  schedule: Schedule;
  onUpdateDay: (date: string, day: DayContent) => void;
  workspaceName: string;
}

type ItemType = 'video' | 'doc' | 'quiz' | 'assignment' | 'note';

const ITEM_TYPES: { id: ItemType; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { id: 'video', label: 'Video', desc: 'YouTube video — full or time portion', icon: <Play className="w-5 h-5" />, color: 'text-rose-500 bg-rose-50 border-rose-200' },
  { id: 'doc', label: 'Documentation', desc: 'Article, blog post, or official docs', icon: <FileText className="w-5 h-5" />, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'quiz', label: 'Quiz', desc: 'Set how many questions to practice', icon: <HelpCircle className="w-5 h-5" />, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'assignment', label: 'Assignment', desc: 'Task with a difficulty level', icon: <ClipboardList className="w-5 h-5" />, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { id: 'note', label: 'Note', desc: 'Google Drive document or folder', icon: <StickyNote className="w-5 h-5" />, color: 'text-violet-600 bg-violet-50 border-violet-200' },
];

const DIFFICULTY_COLORS = {
  Easy: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Medium: 'bg-amber-100 text-amber-700 border-amber-200',
  Hard: 'bg-red-100 text-red-700 border-red-200',
};

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

// ---- Drive helpers -----------------------------------------------------------

const DRIVE_API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY as string | undefined;

function extractDriveId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function fetchDriveTitle(url: string): Promise<string | null> {
  if (!DRIVE_API_KEY) return null;
  const id = extractDriveId(url);
  if (!id) return null;
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=name&key=${DRIVE_API_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json() as { name?: string };
    return data.name ?? null;
  } catch {
    return null;
  }
}

// ---- Video search form -------------------------------------------------------

interface VideoFormProps {
  existingUrls: string[];
  onSubmit: (resource: Resource) => void;
}

function VideoForm({ existingUrls, onSubmit }: VideoFormProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<YouTubeResult | null>(null);
  const [pasteUrl, setPasteUrl] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [mode, setMode] = useState<'full' | 'portion'>('full');
  const [portionStart, setPortionStart] = useState('');
  const [portionEnd, setPortionEnd] = useState('');
  const [tab, setTab] = useState<'search' | 'paste'>('search');

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || tab !== 'search') { setResults([]); return; }
    if (!isYouTubeConfigured) { setSearchError('Add VITE_YOUTUBE_API_KEY to .env.local to enable search.'); return; }
    setSearchError(null);
    const t = setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchYouTube(trimmed, 5)); }
      catch (e) { setSearchError((e as Error).message); setResults([]); }
      finally { setSearching(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [query, tab]);

  const handleSelectResult = (v: YouTubeResult) => {
    setSelected(v);
    setQuery('');
    setResults([]);
  };

  const handleAdd = () => {
    if (tab === 'search' && selected) {
      onSubmit({
        url: videoIdToUrl(selected.videoId),
        title: selected.title,
        source: selected.channel,
        ...(mode === 'portion' && portionStart ? { portionStart } : {}),
        ...(mode === 'portion' && portionEnd ? { portionEnd } : {}),
      });
    } else if (tab === 'paste' && pasteUrl.trim()) {
      let parsed: URL;
      try { parsed = new URL(pasteUrl.trim()); } catch { return; }
      onSubmit({
        url: pasteUrl.trim(),
        title: pasteTitle.trim() || `Video from ${parsed.hostname.replace(/^www\./, '')}`,
        source: parsed.hostname.replace(/^www\./, ''),
        ...(mode === 'portion' && portionStart ? { portionStart } : {}),
        ...(mode === 'portion' && portionEnd ? { portionEnd } : {}),
      });
    }
  };

  const canAdd = tab === 'search' ? !!selected : !!pasteUrl.trim();

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className="flex bg-canvas border border-border-strong rounded-xl p-1 gap-1">
        {(['search', 'paste'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setSelected(null); setResults([]); }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all capitalize flex items-center justify-center gap-1.5 ${tab === t ? 'bg-white text-primary shadow-sm border border-border-strong' : 'text-text-muted hover:text-primary'}`}>
            {t === 'search' ? <><Search className="w-3 h-3" /> Search YouTube</> : 'Paste URL'}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <div className="space-y-3">
          {selected ? (
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
              <div className="w-16 h-10 bg-slate-100 rounded-lg overflow-hidden shrink-0">
                {selected.thumbnail && <img src={selected.thumbnail} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-rose-800 line-clamp-1">{selected.title}</p>
                <p className="text-[10px] text-rose-500">{selected.channel}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-rose-400 hover:text-rose-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search YouTube tutorials…"
                  className="w-full bg-white border border-border-strong rounded-xl pl-10 pr-10 py-2.5 text-sm outline-none focus:border-primary placeholder:text-text-muted/60" />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted animate-spin" />}
              </div>
              {searchError && <p className="text-xs text-red-500">{searchError}</p>}
              <AnimatePresence>
                {results.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="space-y-1.5 max-h-[220px] overflow-y-auto">
                    {results.map(v => {
                      const url = videoIdToUrl(v.videoId);
                      const added = existingUrls.includes(url);
                      return (
                        <button key={v.videoId} onClick={() => !added && handleSelectResult(v)} disabled={added}
                          className={`w-full flex items-center gap-3 bg-white border rounded-xl p-2 text-left transition-all ${added ? 'opacity-50 cursor-not-allowed border-border-strong' : 'border-border-strong hover:border-primary/40 hover:bg-canvas'}`}>
                          <div className="w-14 h-9 bg-slate-100 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                            {v.thumbnail ? <img src={v.thumbnail} alt="" className="w-full h-full object-cover" /> : <Play className="w-4 h-4 text-text-muted" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-primary line-clamp-1">{v.title}</p>
                            <p className="text-[10px] text-text-muted">{v.channel}{v.durationSec ? ` · ${formatDuration(v.durationSec)}` : ''}</p>
                          </div>
                          {added && <span className="text-[10px] text-emerald-600 font-bold shrink-0">Added</span>}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      )}

      {tab === 'paste' && (
        <div className="space-y-3">
          <input value={pasteUrl} onChange={e => setPasteUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=…"
            className="w-full border border-border-strong rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-canvas placeholder:text-text-muted/60" />
          <input value={pasteTitle} onChange={e => setPasteTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full border border-border-strong rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-canvas placeholder:text-text-muted/60" />
        </div>
      )}

      {/* Watch mode */}
      <div>
        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Watch mode</label>
        <div className="flex gap-2">
          {(['full', 'portion'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${mode === m ? 'bg-primary text-white border-primary' : 'bg-canvas border-border-strong text-text-secondary hover:border-primary/30'}`}>
              {m === 'full' ? 'Full video' : 'Time portion'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'portion' && (
        <div className="flex gap-3">
          {[['Start', portionStart, setPortionStart] as const, ['End', portionEnd, setPortionEnd] as const].map(([label, val, set]) => (
            <div key={label} className="flex-1">
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">{label} (mm:ss)</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                <input value={val} onChange={e => set(e.target.value)} placeholder={label === 'Start' ? '0:00' : '10:00'}
                  className="w-full border border-border-strong rounded-xl pl-8 pr-3 py-2.5 text-sm outline-none focus:border-primary bg-canvas placeholder:text-text-muted/60" />
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={handleAdd} disabled={!canAdd}
        className="w-full py-3 bg-primary text-white font-semibold text-sm rounded-2xl hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed">
        Add video to plan
      </button>
    </div>
  );
}

// ---- Doc search form ---------------------------------------------------------

interface DocFormProps {
  existingUrls: string[];
  onSubmit: (resource: Resource) => void;
}

function DocForm({ existingUrls, onSubmit }: DocFormProps) {
  const [tab, setTab] = useState<'search' | 'paste'>('search');
  const [query, setQuery] = useState('');
  const [pasteUrl, setPasteUrl] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');

  const trimmed = query.trim();

  const handleAdd = (resource: Resource) => onSubmit(resource);

  const handlePasteAdd = () => {
    if (!pasteUrl.trim()) return;
    let parsed: URL;
    try { parsed = new URL(pasteUrl.trim()); } catch { return; }
    onSubmit({
      url: pasteUrl.trim(),
      title: pasteTitle.trim() || `Reading from ${parsed.hostname.replace(/^www\./, '')}`,
      source: parsed.hostname.replace(/^www\./, ''),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex bg-canvas border border-border-strong rounded-xl p-1 gap-1">
        {(['search', 'paste'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all capitalize flex items-center justify-center gap-1.5 ${tab === t ? 'bg-white text-primary shadow-sm border border-border-strong' : 'text-text-muted hover:text-primary'}`}>
            {t === 'search' ? <><Search className="w-3 h-3" /> Search Docs</> : 'Paste URL'}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search MDN, W3Schools, official docs…"
              className="w-full bg-white border border-border-strong rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary placeholder:text-text-muted/60" />
          </div>
          <AnimatePresence>
            {trimmed.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-2 max-h-[260px] overflow-y-auto">
                {SEARCH_PROVIDERS.map(p => {
                  const url = p.url(trimmed);
                  const added = existingUrls.includes(url);
                  return (
                    <div key={p.key} className="bg-white border border-border-strong rounded-xl p-3 flex items-center gap-3">
                      <div className={`w-1.5 h-10 rounded-full ${p.accent} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-primary">{p.name}</p>
                        <p className="text-[11px] text-text-muted">Search "{trimmed}"</p>
                      </div>
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-canvas border border-border-strong flex items-center justify-center text-text-secondary hover:text-primary transition-colors shrink-0">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button onClick={() => !added && handleAdd({ url, title: `${p.name} — ${trimmed}`, source: p.name })}
                        disabled={added}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors text-xs font-bold ${added ? 'bg-emerald-100 text-emerald-700 cursor-default' : 'bg-primary text-white hover:bg-primary/90'}`}>
                        {added ? '✓' : <Plus className="w-4 h-4" />}
                      </button>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
          {trimmed.length === 0 && (
            <p className="text-xs text-text-muted text-center py-2">Type to search across MDN, W3Schools, freeCodeCamp and more.</p>
          )}
        </div>
      )}

      {tab === 'paste' && (
        <div className="space-y-3">
          <input autoFocus value={pasteUrl} onChange={e => setPasteUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePasteAdd()}
            placeholder="https://developer.mozilla.org/…"
            className="w-full border border-border-strong rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-canvas placeholder:text-text-muted/60" />
          <input value={pasteTitle} onChange={e => setPasteTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handlePasteAdd()}
            placeholder="Title (optional)"
            className="w-full border border-border-strong rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-canvas placeholder:text-text-muted/60" />
          <button onClick={handlePasteAdd} disabled={!pasteUrl.trim()}
            className="w-full py-3 bg-primary text-white font-semibold text-sm rounded-2xl hover:bg-primary/90 disabled:opacity-40 transition-all">
            Add to plan
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Note / Drive form -------------------------------------------------------

interface NoteFormProps {
  onSubmit: (note: NotePlan) => void;
}

function NoteForm({ onSubmit }: NoteFormProps) {
  const [noteTitle, setNoteTitle] = useState('');
  const [noteUrl, setNoteUrl] = useState('');
  const [fetching, setFetching] = useState(false);

  const handleUrlBlur = async () => {
    if (!noteUrl.trim() || noteTitle.trim()) return;
    setFetching(true);
    const name = await fetchDriveTitle(noteUrl.trim());
    if (name) setNoteTitle(name);
    setFetching(false);
  };

  const handleBrowse = () => {
    window.open('https://drive.google.com', '_blank', 'noopener,noreferrer');
  };

  const handleSubmit = () => {
    if (!noteUrl.trim() || !noteTitle.trim()) return;
    onSubmit({ id: genId(), title: noteTitle.trim(), driveUrl: noteUrl.trim() });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-700">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        Make sure the file is shared as "Anyone with the link can view."
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Google Drive file or folder</label>
        <button onClick={handleBrowse}
          className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-violet-300 bg-violet-50 text-violet-700 rounded-xl text-sm font-medium hover:border-violet-400 hover:bg-violet-100 transition-all mb-3">
          <FolderOpen className="w-4 h-4" />
          Open Google Drive to browse
        </button>
        <div className="relative">
          <input value={noteUrl} onChange={e => setNoteUrl(e.target.value)} onBlur={handleUrlBlur}
            placeholder="Paste Drive link here…"
            className="w-full border border-border-strong rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-canvas placeholder:text-text-muted/60 pr-10" />
          {fetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted animate-spin" />}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Title</label>
        <input autoFocus={false} value={noteTitle} onChange={e => setNoteTitle(e.target.value)}
          placeholder={fetching ? 'Fetching title…' : 'Note title…'}
          className="w-full border border-border-strong rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-canvas placeholder:text-text-muted/60" />
      </div>

      <button onClick={handleSubmit} disabled={!noteUrl.trim() || !noteTitle.trim()}
        className="w-full py-3 bg-primary text-white font-semibold text-sm rounded-2xl hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed">
        Add note to plan
      </button>
    </div>
  );
}

// ---- Add-item modal ----------------------------------------------------------

interface ModalState { dateKey: string }

interface AddModalProps {
  dateKey: string;
  existingDay: DayContent | undefined;
  onClose: () => void;
  onAdd: (dateKey: string, type: ItemType, data: unknown) => void;
}

function AddItemModal({ dateKey, existingDay, onClose, onAdd }: AddModalProps) {
  const [type, setType] = useState<ItemType | null>(null);

  // Quiz state
  const [quizTopic, setQuizTopic] = useState('');
  const [quizCount, setQuizCount] = useState(5);

  // Assignment state
  const [assignTitle, setAssignTitle] = useState('');
  const [assignDiff, setAssignDiff] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');

  const existingVideoUrls = useMemo(() => (existingDay?.videos ?? []).map(v => v.url), [existingDay]);
  const existingDocUrls = useMemo(() => (existingDay?.docs ?? []).map(d => d.url), [existingDay]);

  const [y, m, d] = dateKey.split('-');
  const dateLabel = new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('default', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  const handleVideoSubmit = (r: Resource) => { onAdd(dateKey, 'video', r); onClose(); };
  const handleDocSubmit = (r: Resource) => { onAdd(dateKey, 'doc', r); onClose(); };
  const handleNoteSubmit = (n: NotePlan) => { onAdd(dateKey, 'note', n); onClose(); };

  const handleQuizSubmit = () => {
    onAdd(dateKey, 'quiz', { id: genId(), topic: quizTopic.trim() || undefined, count: quizCount } as QuizPlan);
    onClose();
  };

  const handleAssignSubmit = () => {
    if (!assignTitle.trim()) return;
    onAdd(dateKey, 'assignment', { id: genId(), title: assignTitle.trim(), difficulty: assignDiff } as AssignmentPlan);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-border-strong overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0 border-b border-border-strong">
          <div>
            {type && (
              <button onClick={() => setType(null)} className="text-[11px] font-medium text-text-muted hover:text-primary mb-1 flex items-center gap-1 transition-colors">
                <ChevronLeft className="w-3 h-3" /> All types
              </button>
            )}
            <h3 className="font-display font-semibold text-lg text-primary">
              {type ? ITEM_TYPES.find(t => t.id === type)?.label : 'Add to plan'}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">{dateLabel}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-canvas border border-border-strong text-text-muted hover:text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          <AnimatePresence mode="wait">
            {!type && (
              <motion.div key="pick" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-2">
                {ITEM_TYPES.map(t => (
                  <button key={t.id} onClick={() => setType(t.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border-strong bg-canvas hover:border-primary/30 hover:bg-white transition-all text-left group">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${t.color} shrink-0`}>{t.icon}</div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-primary">{t.label}</div>
                      <div className="text-xs text-text-muted mt-0.5">{t.desc}</div>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-text-muted rotate-180 shrink-0" />
                  </button>
                ))}
              </motion.div>
            )}

            {type === 'video' && (
              <motion.div key="video" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <VideoForm existingUrls={existingVideoUrls} onSubmit={handleVideoSubmit} />
              </motion.div>
            )}

            {type === 'doc' && (
              <motion.div key="doc" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <DocForm existingUrls={existingDocUrls} onSubmit={handleDocSubmit} />
              </motion.div>
            )}

            {type === 'quiz' && (
              <motion.div key="quiz" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Topic (optional)</label>
                  <input autoFocus value={quizTopic} onChange={e => setQuizTopic(e.target.value)}
                    placeholder="e.g. React Hooks…"
                    className="w-full border border-border-strong rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-canvas placeholder:text-text-muted/60" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Number of questions</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setQuizCount(Math.max(1, quizCount - 1))} className="w-10 h-10 rounded-xl border border-border-strong bg-canvas flex items-center justify-center text-lg font-medium text-text-secondary hover:text-primary transition-colors">−</button>
                    <span className="text-2xl font-display font-semibold text-primary w-12 text-center">{quizCount}</span>
                    <button onClick={() => setQuizCount(quizCount + 1)} className="w-10 h-10 rounded-xl border border-border-strong bg-canvas flex items-center justify-center text-lg font-medium text-text-secondary hover:text-primary transition-colors">+</button>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {[5, 10, 15, 20].map(n => (
                      <button key={n} onClick={() => setQuizCount(n)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${quizCount === n ? 'bg-primary text-white border-primary' : 'bg-canvas border-border-strong text-text-secondary hover:border-primary/30'}`}>{n} Qs</button>
                    ))}
                  </div>
                </div>
                <button onClick={handleQuizSubmit}
                  className="w-full py-3 bg-primary text-white font-semibold text-sm rounded-2xl hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-primary/20">
                  Add quiz to plan
                </button>
              </motion.div>
            )}

            {type === 'assignment' && (
              <motion.div key="assignment" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">Assignment title</label>
                  <input autoFocus value={assignTitle} onChange={e => setAssignTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAssignSubmit()}
                    placeholder="e.g. Build a todo app…"
                    className="w-full border border-border-strong rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-canvas placeholder:text-text-muted/60" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Difficulty</label>
                  <div className="flex gap-2">
                    {(['Easy', 'Medium', 'Hard'] as const).map(d => (
                      <button key={d} onClick={() => setAssignDiff(d)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${assignDiff === d ? DIFFICULTY_COLORS[d] + ' shadow-sm' : 'bg-canvas border-border-strong text-text-muted hover:border-primary/30'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={handleAssignSubmit} disabled={!assignTitle.trim()}
                  className="w-full py-3 bg-primary text-white font-semibold text-sm rounded-2xl hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-primary/20 disabled:opacity-40">
                  Add assignment to plan
                </button>
              </motion.div>
            )}

            {type === 'note' && (
              <motion.div key="note" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <NoteForm onSubmit={handleNoteSubmit} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---- Plan item chips ---------------------------------------------------------

function VideoChip({ item, onRemove }: { item: Resource; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 group">
      <div className="w-6 h-6 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
        <Play className="w-3 h-3 text-rose-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-rose-800 truncate">{item.title}</p>
        {(item.portionStart || item.portionEnd) && (
          <p className="text-[10px] text-rose-500 flex items-center gap-1 mt-0.5">
            <Clock className="w-2.5 h-2.5" />{item.portionStart ?? '0:00'} → {item.portionEnd ?? 'end'}
          </p>
        )}
      </div>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-rose-400 hover:text-rose-600 shrink-0"><ExternalLink className="w-3 h-3" /></a>
      <button onClick={onRemove} className="text-rose-300 hover:text-rose-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
    </div>
  );
}

function DocChip({ item, onRemove }: { item: Resource; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 group">
      <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0"><FileText className="w-3 h-3 text-emerald-600" /></div>
      <p className="text-xs font-semibold text-emerald-800 flex-1 truncate">{item.title}</p>
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-600 shrink-0"><ExternalLink className="w-3 h-3" /></a>
      <button onClick={onRemove} className="text-emerald-300 hover:text-emerald-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
    </div>
  );
}

function QuizChip({ item, onRemove }: { item: QuizPlan; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 group">
      <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center shrink-0"><HelpCircle className="w-3 h-3 text-amber-600" /></div>
      <p className="text-xs font-semibold text-amber-800 flex-1 truncate">{item.count} question{item.count !== 1 ? 's' : ''}{item.topic ? ` · ${item.topic}` : ''}</p>
      <button onClick={onRemove} className="text-amber-300 hover:text-amber-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
    </div>
  );
}

function AssignmentChip({ item, onRemove }: { item: AssignmentPlan; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 group">
      <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center shrink-0"><ClipboardList className="w-3 h-3 text-blue-600" /></div>
      <p className="text-xs font-semibold text-blue-800 flex-1 truncate">{item.title}</p>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${DIFFICULTY_COLORS[item.difficulty]}`}>{item.difficulty}</span>
      <button onClick={onRemove} className="text-blue-300 hover:text-blue-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
    </div>
  );
}

function NoteChip({ item, onRemove }: { item: NotePlan; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2 group">
      <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center shrink-0"><StickyNote className="w-3 h-3 text-violet-600" /></div>
      <p className="text-xs font-semibold text-violet-800 flex-1 truncate">{item.title}</p>
      <a href={item.driveUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-600 shrink-0"><ExternalLink className="w-3 h-3" /></a>
      <button onClick={onRemove} className="text-violet-300 hover:text-violet-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3" /></button>
    </div>
  );
}

// ---- Day row ----------------------------------------------------------------

function DayRow({ dateKey, day, isToday, onAdd, onUpdateDay }: {
  dateKey: string;
  day: DayContent | undefined;
  isToday: boolean;
  onAdd: (dateKey: string) => void;
  onUpdateDay: (dateKey: string, day: DayContent) => void;
}) {
  const [y, m, d] = dateKey.split('-');
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const weekday = dateObj.toLocaleDateString('default', { weekday: 'short' });
  const dayNum = dateObj.getDate();
  const isPast = dateKey < toDateKey() && !isToday;
  const hasItems =
    (day?.videos?.length ?? 0) + (day?.docs?.length ?? 0) +
    (day?.quizzes?.length ?? 0) + (day?.assignments?.length ?? 0) +
    (day?.notes?.length ?? 0) > 0;

  const empty: DayContent = { videos: [], docs: [], tasks: [] };
  const cur = day ?? empty;

  return (
    <div className={`flex gap-4 group ${isPast ? 'opacity-60' : ''}`}>
      <div className="flex flex-col items-center shrink-0 w-14">
        <div className={`w-10 h-10 rounded-2xl flex flex-col items-center justify-center border transition-colors ${isToday ? 'bg-primary border-primary text-white shadow-md shadow-primary/25' : hasItems ? 'bg-white border-border-strong text-primary' : 'bg-canvas border-border-strong text-text-muted'}`}>
          <span className="text-[9px] font-bold uppercase tracking-wider leading-none opacity-70">{weekday}</span>
          <span className="text-sm font-display font-semibold leading-tight">{dayNum}</span>
        </div>
        <div className="flex-1 w-px bg-border-strong mt-2 min-h-[16px]" />
      </div>

      <div className="flex-1 pb-4 min-w-0">
        {day?.topicTitle && <p className="text-xs font-semibold text-primary mb-2">{day.topicTitle}</p>}

        {hasItems && (
          <div className="space-y-1.5 mb-2">
            {cur.videos.map((v, i) => (
              <VideoChip key={i} item={v} onRemove={() => onUpdateDay(dateKey, { ...cur, videos: cur.videos.filter((_, idx) => idx !== i) })} />
            ))}
            {cur.docs.map((d, i) => (
              <DocChip key={i} item={d} onRemove={() => onUpdateDay(dateKey, { ...cur, docs: cur.docs.filter((_, idx) => idx !== i) })} />
            ))}
            {(cur.quizzes ?? []).map(q => (
              <QuizChip key={q.id} item={q} onRemove={() => onUpdateDay(dateKey, { ...cur, quizzes: (cur.quizzes ?? []).filter(x => x.id !== q.id) })} />
            ))}
            {(cur.assignments ?? []).map(a => (
              <AssignmentChip key={a.id} item={a} onRemove={() => onUpdateDay(dateKey, { ...cur, assignments: (cur.assignments ?? []).filter(x => x.id !== a.id) })} />
            ))}
            {(cur.notes ?? []).map(n => (
              <NoteChip key={n.id} item={n} onRemove={() => onUpdateDay(dateKey, { ...cur, notes: (cur.notes ?? []).filter(x => x.id !== n.id) })} />
            ))}
          </div>
        )}

        <button
          onClick={() => onAdd(dateKey)}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition-all border-dashed border-border-strong text-text-muted hover:text-primary hover:border-primary/40 ${!hasItems ? 'opacity-0 group-hover:opacity-100' : ''}`}
        >
          <Plus className="w-3.5 h-3.5" /> Add item
        </button>
      </div>
    </div>
  );
}

// ---- Main PlanPage ----------------------------------------------------------

export function PlanPage({ schedule, onUpdateDay, workspaceName }: Props) {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const [currentMonth, setCurrentMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [modal, setModal] = useState<ModalState | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

  const dateKeys = useMemo(() => {
    if (viewMode === 'month') {
      return Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1;
        return `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      });
    }
    // Week mode: currentMonth holds the Sunday that starts this week.
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), currentMonth.getDate() + i);
      return toDateKey(d);
    });
  }, [currentMonth, daysInMonth, viewMode]);

  const weeks = useMemo(() => {
    const result: string[][] = [];
    let week: string[] = [];
    dateKeys.forEach((key, i) => {
      week.push(key);
      if (week.length === 7 || i === dateKeys.length - 1) { result.push(week); week = []; }
    });
    return result;
  }, [dateKeys]);

  const totalPlanned = useMemo(() =>
    dateKeys.reduce((acc, k) => {
      const d = schedule[k];
      return acc + (d?.videos?.length ?? 0) + (d?.docs?.length ?? 0) + (d?.quizzes?.length ?? 0) + (d?.assignments?.length ?? 0) + (d?.notes?.length ?? 0);
    }, 0),
  [dateKeys, schedule]);

  /** Returns midnight of the Sunday that starts the week containing `d`. */
  function weekSunday(d: Date): Date {
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    s.setDate(s.getDate() - s.getDay());
    return s;
  }

  const monthLabel = useMemo(() => {
    if (viewMode === 'month') {
      return currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
    }
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), currentMonth.getDate() + 6);
    const sameMonth = currentMonth.getMonth() === end.getMonth();
    const startStr = currentMonth.toLocaleDateString('default', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('default', {
      month: sameMonth ? undefined : 'short',
      day: 'numeric',
      year: 'numeric',
    } as Intl.DateTimeFormatOptions);
    return `${startStr} – ${endStr}`;
  }, [currentMonth, viewMode]);

  const handleAdd = (dateKey: string) => setModal({ dateKey });

  const handleAddItem = (dateKey: string, type: ItemType, data: unknown) => {
    const cur: DayContent = schedule[dateKey] ?? { videos: [], docs: [], tasks: [] };
    if (type === 'video') onUpdateDay(dateKey, { ...cur, videos: [...cur.videos, data as Resource] });
    else if (type === 'doc') onUpdateDay(dateKey, { ...cur, docs: [...cur.docs, data as Resource] });
    else if (type === 'quiz') onUpdateDay(dateKey, { ...cur, quizzes: [...(cur.quizzes ?? []), data as QuizPlan] });
    else if (type === 'assignment') onUpdateDay(dateKey, { ...cur, assignments: [...(cur.assignments ?? []), data as AssignmentPlan] });
    else if (type === 'note') onUpdateDay(dateKey, { ...cur, notes: [...(cur.notes ?? []), data as NotePlan] });
  };

  const handlePrev = () => {
    if (viewMode === 'week') {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), currentMonth.getDate() - 7));
    } else {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'week') {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), currentMonth.getDate() + 7));
    } else {
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    }
  };

  const handleSetViewMode = (mode: 'month' | 'week') => {
    if (mode === 'week') {
      setCurrentMonth(weekSunday(today));
    } else {
      setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    }
    setViewMode(mode);
  };

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="font-display font-semibold text-2xl text-primary">Learning Plan</h1>
          <p className="text-sm text-text-muted mt-0.5">{workspaceName} · {totalPlanned} item{totalPlanned !== 1 ? 's' : ''} planned this {viewMode}</p>
        </div>
        <div className="flex bg-canvas border border-border-strong rounded-xl p-1 gap-1">
          {(['week', 'month'] as const).map(m => (
            <button key={m} onClick={() => handleSetViewMode(m)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${viewMode === m ? 'bg-white text-primary shadow-sm border border-border-strong' : 'text-text-muted hover:text-primary'}`}>{m}</button>
          ))}
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <h2 className="font-display font-medium text-lg text-primary">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button onClick={handlePrev} className="w-8 h-8 flex items-center justify-center rounded-xl border border-border-strong bg-white text-text-secondary hover:text-primary transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => viewMode === 'week' ? setCurrentMonth(weekSunday(today)) : setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="px-3 h-8 text-xs font-semibold rounded-xl border border-border-strong bg-white text-text-secondary hover:text-primary transition-colors">
            Today
          </button>
          <button onClick={handleNext} className="w-8 h-8 flex items-center justify-center rounded-xl border border-border-strong bg-white text-text-secondary hover:text-primary transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Day list */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        {viewMode === 'month' ? (
          weeks.map((week, wi) => (
            <div key={wi} className="mb-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3 flex items-center gap-2">
                Week {wi + 1}<div className="flex-1 h-px bg-border-strong" />
              </div>
              {week.map(key => (
                <DayRow key={key} dateKey={key} day={schedule[key]} isToday={key === todayKey} onAdd={handleAdd} onUpdateDay={onUpdateDay} />
              ))}
            </div>
          ))
        ) : (
          dateKeys.map(key => (
            <DayRow key={key} dateKey={key} day={schedule[key]} isToday={key === todayKey} onAdd={handleAdd} onUpdateDay={onUpdateDay} />
          ))
        )}
      </div>

      {/* Floating add button for today */}
      <div className="fixed bottom-8 right-8 z-10">
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => handleAdd(todayKey)}
          className="w-14 h-14 bg-primary text-white rounded-2xl shadow-xl shadow-primary/30 flex items-center justify-center hover:bg-primary/90 transition-colors"
          title="Add to today"
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modal && (
          <AddItemModal
            dateKey={modal.dateKey}
            existingDay={schedule[modal.dateKey]}
            onClose={() => setModal(null)}
            onAdd={handleAddItem}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
