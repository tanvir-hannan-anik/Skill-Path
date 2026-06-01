import { useState, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import { convertPptxToPdf } from '../lib/pptxToPdf';
import { storeFile, loadFile, deleteFile } from '../lib/fileStore';
import { StickyNote, ExternalLink, FolderOpen, Plus, X, Loader2, AlertCircle, Upload, Download, FileText, Eye } from 'lucide-react';
import { NotePlan } from '../types';
import { NoteViewerModal } from './NoteViewerModal';

interface Props {
  notes: NotePlan[];
  onAddNote: (note: NotePlan) => void;
  onRemoveNote: (id: string) => void;
}

const DRIVE_API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY as string | undefined;
const LOCAL_FILE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

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
  const [tab, setTab] = useState<'drive' | 'local'>('drive');

  // Drive state
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Local file state
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localTitle, setLocalTitle] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [viewingNote, setViewingNote] = useState<NotePlan | null>(null);

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

  const acceptFile = (file: File) => {
    setLocalError(null);
    if (file.size > LOCAL_FILE_MAX_BYTES) {
      setLocalError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`);
      return;
    }
    setLocalFile(file);
    setLocalTitle(prev => prev || file.name.replace(/\.[^.]+$/, ''));
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) acceptFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  };

  const isPptx = localFile?.name.toLowerCase().endsWith('.pptx') ?? false;

  const handleLocalAdd = async () => {
    if (!localFile || !localTitle.trim()) return;
    setUploading(true);
    try {
      let dataUrl: string;
      if (isPptx) {
        dataUrl = await convertPptxToPdf(localFile);
      } else {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(localFile);
        });
      }
      // Store blob in IndexedDB — only the small ID goes into the schedule
      const fileId = genId();
      await storeFile(fileId, dataUrl);
      onAddNote({ id: genId(), title: localTitle.trim(), driveUrl: '', localFile: true, localFileId: fileId });
      setLocalFile(null);
      setLocalTitle('');
      setLocalError(null);
    } catch {
      setLocalError(isPptx ? 'Failed to convert PPTX to PDF. Please try again.' : 'Failed to read the file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveNote = (note: NotePlan) => {
    if (note.localFileId) deleteFile(note.localFileId).catch(() => {});
    onRemoveNote(note.id);
  };

  const handleDownload = async (note: NotePlan) => {
    const url = note.localFileId ? await loadFile(note.localFileId) : note.driveUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = note.title;
    a.click();
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {viewingNote && <NoteViewerModal note={viewingNote} onClose={() => setViewingNote(null)} />}
      </AnimatePresence>
      {/* Add note panel */}
      <div className="bg-canvas border border-border-strong rounded-[20px] p-5 space-y-4">

        {/* Tab toggle */}
        <div className="flex bg-canvas border border-border-strong rounded-xl p-1 gap-1">
          <button onClick={() => setTab('drive')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${tab === 'drive' ? 'bg-white text-primary shadow-sm border border-border-strong' : 'text-text-muted hover:text-primary'}`}>
            <FolderOpen className="w-3 h-3" /> Google Drive
          </button>
          <button onClick={() => setTab('local')}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${tab === 'local' ? 'bg-white text-primary shadow-sm border border-border-strong' : 'text-text-muted hover:text-primary'}`}>
            <Upload className="w-3 h-3" /> Local File
          </button>
        </div>

        {tab === 'drive' && (
          <>
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
          </>
        )}

        {tab === 'local' && (
          <>
            <div className="flex items-start gap-2 p-3 bg-violet-50 border border-violet-200 rounded-xl text-xs text-violet-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              Files up to 10 MB are supported. The file is stored in your notes data.
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl transition-all ${dragging ? 'border-violet-400 bg-violet-50' : localFile ? 'border-emerald-300 bg-emerald-50' : 'border-border-strong bg-canvas hover:border-violet-300 hover:bg-violet-50'}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileInputChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".pdf,.txt,.md,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.csv"
              />
              <div className="flex flex-col items-center justify-center gap-2 py-6 px-4 pointer-events-none">
                {localFile ? (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-emerald-600" />
                    </div>
                    <p className="text-sm font-semibold text-primary text-center truncate max-w-full">{localFile.name}</p>
                    <p className="text-xs text-text-muted">{(localFile.size / 1024).toFixed(0)} KB · click to change</p>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-violet-500" />
                    </div>
                    <p className="text-sm font-medium text-primary">Drop a file here or click to browse</p>
                    <p className="text-xs text-text-muted">PDF, Word, PowerPoint, Markdown, images…</p>
                  </>
                )}
              </div>
            </div>

            {localError && (
              <p className="text-xs text-red-500 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />{localError}
              </p>
            )}

            <div className="space-y-2">
              <input
                value={localTitle}
                onChange={e => setLocalTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLocalAdd()}
                placeholder="Note title…"
                className="w-full border border-border-strong rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white placeholder:text-text-muted/60"
              />

              <button
                onClick={handleLocalAdd}
                disabled={!localFile || !localTitle.trim() || uploading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-primary/20"
              >
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> {isPptx ? 'Converting PPTX to PDF…' : 'Reading file…'}</> : <><Plus className="w-4 h-4" /> Add note</>}
              </button>
            </div>
          </>
        )}
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
                {note.localFile ? (
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => setViewingNote(note)}
                      className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 hover:underline transition-colors font-medium"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                    <span className="text-text-muted text-xs">·</span>
                    <button
                      onClick={() => handleDownload(note)}
                      className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary hover:underline transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                    <span className="text-[10px] text-text-muted ml-1">Local file</span>
                  </div>
                ) : (
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
                )}
              </div>
              <button
                onClick={() => handleRemoveNote(note)}
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
          <p className="text-text-muted text-xs mt-1">Add a Google Drive link or upload a local file above.</p>
        </div>
      )}
    </div>
  );
}
