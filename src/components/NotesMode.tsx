import { useState } from 'react';
import { StickyNote, ExternalLink, FolderOpen, Plus, X, Loader2, AlertCircle } from 'lucide-react';
import { NotePlan } from '../types';

interface Props {
  notes: NotePlan[];
  onAddNote: (note: NotePlan) => void;
  onRemoveNote: (id: string) => void;
}

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

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

export function NotesMode({ notes, onAddNote, onRemoveNote }: Props) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUrlBlur = async () => {
    if (!url.trim() || title.trim()) return;
    setFetching(true);
    const name = await fetchDriveTitle(url.trim());
    if (name) setTitle(name);
    setFetching(false);
  };

  const handleBrowse = () => {
    window.open('https://drive.google.com', '_blank', 'noopener,noreferrer');
  };

  const handleAdd = () => {
    const trimUrl = url.trim();
    const trimTitle = title.trim();
    if (!trimUrl) { setError('Please enter a Google Drive URL.'); return; }
    if (!trimTitle) { setError('Please enter a title.'); return; }
    if (notes.some(n => n.driveUrl === trimUrl)) { setError('This note is already added.'); return; }
    onAddNote({ id: genId(), title: trimTitle, driveUrl: trimUrl });
    setTitle('');
    setUrl('');
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Add note panel */}
      <div className="bg-canvas border border-border-strong rounded-[20px] p-5 space-y-4">
        <div className="flex items-start gap-2 p-3 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          Files must be shared as "Anyone with the link can view" on Google Drive.
        </div>

        <button
          onClick={handleBrowse}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-violet-300 bg-violet-50 text-violet-700 rounded-xl text-sm font-medium hover:border-violet-400 hover:bg-violet-100 transition-all"
        >
          <FolderOpen className="w-4 h-4" />
          Open Google Drive to browse &amp; copy link
        </button>

        <div className="space-y-2">
          <div className="relative">
            <input
              value={url}
              onChange={e => { setUrl(e.target.value); setError(null); }}
              onBlur={handleUrlBlur}
              placeholder="Paste Google Drive link here…"
              className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white placeholder:text-text-muted/60 pr-10 ${error && !url ? 'border-red-300' : 'border-border-strong'}`}
            />
            {fetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted animate-spin" />}
          </div>

          <input
            value={title}
            onChange={e => { setTitle(e.target.value); setError(null); }}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder={fetching ? 'Fetching title from Drive…' : 'Note title…'}
            className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white placeholder:text-text-muted/60 ${error && !title ? 'border-red-300' : 'border-border-strong'}`}
          />

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleAdd}
            disabled={!url.trim() || !title.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Add note
          </button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length > 0 ? (
        <div className="space-y-3">
          <h4 className="font-display font-medium text-lg text-primary">Today's Notes</h4>
          {notes.map(note => (
            <div
              key={note.id}
              className="bg-white border border-border-strong rounded-2xl p-5 flex items-start gap-4 group hover:border-violet-200 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center shrink-0">
                <StickyNote className="w-5 h-5 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-primary text-sm mb-1">{note.title}</p>
                <a
                  href={note.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 hover:underline transition-colors"
                >
                  <FolderOpen className="w-3 h-3" />
                  Open in Google Drive
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <button
                onClick={() => onRemoveNote(note.id)}
                aria-label="Remove note"
                className="w-8 h-8 flex items-center justify-center rounded-full text-text-muted hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-canvas border border-dashed border-border-strong rounded-2xl p-10 text-center">
          <StickyNote className="w-10 h-10 text-text-muted mx-auto mb-4" />
          <p className="text-text-secondary text-sm">No notes for today yet.</p>
          <p className="text-text-muted text-xs mt-1">Open Google Drive above and paste a share link.</p>
        </div>
      )}
    </div>
  );
}
