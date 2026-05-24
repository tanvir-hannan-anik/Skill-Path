import { FileText, ArrowUpRight, BookOpen, Sparkles, Search, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Resource } from '../types';
import { StudyPackView } from './StudyPackView';
import { useStudyPack } from '../hooks/useStudyPack';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/toast';
import { InlineDocSearch } from './InlineDocSearch';

interface Props {
  docs: Resource[];
  onAddDoc: (d: Resource) => void;
  onRemoveDoc: (url: string) => void;
}

const AI_SUGGESTIONS: Resource[] = [
  { title: 'The Modern JavaScript Tutorial: Variables', source: 'javascript.info', url: 'https://javascript.info/variables' },
  { title: 'React Documentation: State Management', source: 'react.dev', url: 'https://react.dev/learn/state-a-components-memory' },
];

type View = 'reader' | 'study';

export function DocsMode({ docs, onAddDoc, onRemoveDoc }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(docs[0]?.url ?? null);
  const [view, setView] = useState<View>('reader');

  useEffect(() => {
    if (!docs.find((d) => d.url === activeUrl)) {
      setActiveUrl(docs[0]?.url ?? null);
    }
  }, [docs, activeUrl]);

  const activeDoc = useMemo(() => docs.find((d) => d.url === activeUrl) ?? null, [docs, activeUrl]);
  const existingUrls = useMemo(() => docs.map((d) => d.url), [docs]);

  const { pack, loading, error: packError, generate } = useStudyPack(
    user?.uid ?? null,
    activeDoc ? { url: activeDoc.url, title: activeDoc.title } : null
  );

  const handleSuggestionAdd = (resource: Resource) => {
    if (docs.some((d) => d.url === resource.url)) return;
    onAddDoc(resource);
    setActiveUrl(resource.url);
    toast.success(`${resource.source} added to today.`);
  };

  const handleAddURL = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    let parsed: URL;
    try { parsed = new URL(trimmed); } catch { setError('Please enter a valid URL.'); return; }
    if (docs.some((d) => d.url === trimmed)) {
      setError('That document is already in your list.');
      return;
    }
    onAddDoc({ url: trimmed, title: `Reading from ${parsed.hostname.replace(/^www\./, '')}`, source: parsed.hostname.replace(/^www\./, '') });
    setActiveUrl(trimmed);
    setUrl('');
    setError(null);
    toast.success('Document added to today.');
  };

  return (
    <div className="space-y-6">
      {/* Search + URL paste — search-as-you-type suggests provider deep-links */}
      <div className="bg-canvas border border-border-strong rounded-[20px] p-4 sm:p-5 space-y-4">
        <InlineDocSearch
          existingUrls={existingUrls}
          onAdd={handleSuggestionAdd}
          placeholder="Search MDN, W3Schools, freeCodeCamp, official docs…"
        />

        <div className="flex items-center gap-4">
          <div className="h-px bg-border-strong flex-1" />
          <span className="text-xs font-bold uppercase text-text-muted">OR PASTE URL</span>
          <div className="h-px bg-border-strong flex-1" />
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && handleAddURL()}
            placeholder="https://developer.mozilla.org/…"
            className={`flex-1 bg-white border rounded-[14px] px-4 py-3 outline-none text-sm text-primary placeholder:text-text-muted transition-colors ${error ? 'border-red-300 focus:border-red-500' : 'border-border-strong focus:border-primary'}`}
            aria-invalid={!!error}
          />
          <button
            onClick={handleAddURL}
            className="bg-primary hover:bg-primary/90 text-white px-5 py-3 rounded-[14px] text-sm font-medium transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Main content */}
        <div className="lg:col-span-3 space-y-4">
          {activeDoc && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-canvas border border-border-strong rounded-2xl p-3 sm:p-4">
              <div className="min-w-0">
                <p className="font-display font-medium text-base sm:text-lg text-primary line-clamp-1">{activeDoc.title}</p>
                <a
                  href={activeDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-text-secondary hover:text-primary inline-flex items-center gap-1 transition-colors truncate max-w-full"
                >
                  <span className="truncate">{activeDoc.source}</span>
                  <ArrowUpRight className="w-3 h-3 shrink-0" />
                </a>
              </div>

              <div className="flex items-center gap-2 bg-white p-1 rounded-full border border-border-strong shrink-0" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'reader'}
                  onClick={() => setView('reader')}
                  className={`relative px-4 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 ${view === 'reader' ? 'text-primary' : 'text-text-muted hover:text-primary'}`}
                >
                  {view === 'reader' && (
                    <motion.div layoutId="docsView" className="absolute inset-0 bg-canvas border border-border-strong rounded-full" />
                  )}
                  <BookOpen className="w-3.5 h-3.5 relative z-10" />
                  <span className="relative z-10">Reader</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'study'}
                  onClick={() => setView('study')}
                  className={`relative px-4 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1.5 ${view === 'study' ? 'text-primary' : 'text-text-muted hover:text-primary'}`}
                >
                  {view === 'study' && (
                    <motion.div layoutId="docsView" className="absolute inset-0 bg-canvas border border-border-strong rounded-full" />
                  )}
                  <Sparkles className="w-3.5 h-3.5 relative z-10" />
                  <span className="relative z-10">Study pack</span>
                </button>
              </div>
            </div>
          )}

          {!activeDoc && (
            <div className="bg-white border border-border-strong rounded-2xl p-10 text-center">
              <FileText className="w-10 h-10 text-text-muted mx-auto mb-4" />
              <p className="text-text-secondary text-sm">Add a documentation URL above to start reading.</p>
            </div>
          )}

          {activeDoc && view === 'reader' && (
            <ReaderCard doc={activeDoc} />
          )}

          {activeDoc && view === 'study' && (
            <StudyPackView
              pack={pack}
              loading={loading}
              error={packError}
              onGenerate={generate}
              onRegenerate={pack ? generate : undefined}
            />
          )}
        </div>

        {/* Sidebar list */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-canvas border border-border-strong rounded-[24px] p-5 flex flex-col max-h-[600px]">
            <h4 className="font-display font-medium text-primary shrink-0 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Today's Reading
            </h4>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
              <div className="space-y-3">
                {docs.map((doc) => (
                  <div
                    key={doc.url}
                    onClick={() => setActiveUrl(doc.url)}
                    className={`group bg-white border rounded-[16px] p-4 cursor-pointer transition-shadow ${
                      activeUrl === doc.url ? 'border-primary shadow-md' : 'border-border-strong hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-medium text-sm mb-2 line-clamp-2 leading-snug ${activeUrl === doc.url ? 'text-primary' : 'text-text-secondary'}`}>
                        {doc.title}
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemoveDoc(doc.url); }}
                        aria-label="Remove document"
                        className="text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-[11px] font-medium text-text-muted">{doc.source}</span>
                  </div>
                ))}
                {docs.length === 0 && (
                  <span className="text-sm text-text-muted">No documents scheduled yet — search or paste a URL above.</span>
                )}
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3 block">Suggested</span>
                <div className="space-y-3">
                  {AI_SUGGESTIONS.filter((s) => !docs.some((d) => d.url === s.url)).map((doc) => (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      key={doc.url}
                      onClick={() => { onAddDoc(doc); setActiveUrl(doc.url); }}
                      className="w-full text-left bg-white/50 border border-border-strong border-dashed rounded-[16px] p-4 group cursor-pointer hover:bg-white transition-all shadow-sm"
                    >
                      <p className="font-medium text-sm text-primary mb-2 line-clamp-2 leading-snug">{doc.title}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-text-muted">{doc.source}</span>
                        <Plus className="w-3.5 h-3.5 text-primary/50 group-hover:text-primary transition-colors" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Honest reader card: since CORS prevents in-browser fetching of arbitrary
 * doc pages, we offer fast outbound options instead of fake content.
 */
function ReaderCard({ doc }: { doc: Resource }) {
  return (
    <div className="bg-white border border-border-strong rounded-[24px] p-6 sm:p-8">
      <p className="text-text-secondary leading-relaxed mb-6">
        Most documentation sites block in-browser embedding for security reasons, so we link out to a clean reader instead of faking the content. Pick one of the options below.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group bg-canvas border border-border-strong rounded-2xl p-5 hover:border-primary/30 transition-colors flex items-start gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-medium text-base text-primary">Open the source</p>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">Full original page in a new tab.</p>
          </div>
        </a>

        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(doc.title + ' ' + doc.source)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group bg-canvas border border-border-strong rounded-2xl p-5 hover:border-primary/30 transition-colors flex items-start gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-canvas border border-border-strong text-text-secondary flex items-center justify-center shrink-0">
            <Search className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-medium text-base text-primary">Search for similar</p>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">Find related pages on the same topic.</p>
          </div>
        </a>
      </div>

      <div className="mt-6 p-4 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-100 rounded-2xl dark:from-blue-950/20 dark:to-purple-950/20 dark:border-blue-900/20">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-white border border-border-strong flex items-center justify-center text-accent shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-primary mb-1">Get more from this page</p>
            <p className="text-xs text-text-secondary leading-relaxed">
              Switch to the <strong className="text-primary">Study pack</strong> tab to generate key concepts, an estimated reading time, a quiz, and practice problems.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
