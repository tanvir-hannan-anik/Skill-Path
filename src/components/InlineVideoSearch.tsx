import { useEffect, useState } from 'react';
import { Search, Plus, Loader2, Play, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDuration, isYouTubeConfigured, searchYouTube, videoIdToUrl } from '../lib/youtube';
import type { Resource, YouTubeResult } from '../types';

interface Props {
  /** URLs already in today's list, so we can show a "added" check. */
  existingUrls: string[];
  onAdd: (resource: Resource) => void;
  placeholder?: string;
}

/**
 * Search-as-you-type YouTube suggestions for the Learn page. Debounced 500ms.
 * Each result has a + button that adds it as a Resource to today's schedule.
 */
export function InlineVideoSearch({ existingUrls, onAdd, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      return;
    }
    if (!isYouTubeConfigured) {
      setError('Add VITE_YOUTUBE_API_KEY to .env.local to enable search.');
      return;
    }
    setError(null);
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchYouTube(trimmed, 6);
        setResults(r);
      } catch (err) {
        setError((err as Error).message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  const handleAdd = (v: YouTubeResult) => {
    onAdd({
      url: videoIdToUrl(v.videoId),
      title: v.title,
      source: v.channel,
    });
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? 'Search YouTube tutorials…'}
          className="w-full bg-white border border-border-strong rounded-[16px] pl-10 pr-10 py-3 outline-none focus:border-primary text-sm shadow-sm transition-colors text-primary"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted animate-spin" />
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 px-1">{error}</p>
      )}

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-2 max-h-[360px] overflow-y-auto pr-1"
          >
            {results.map((v) => {
              const url = videoIdToUrl(v.videoId);
              const added = existingUrls.includes(url);
              return (
                <div
                  key={v.videoId}
                  className="bg-white border border-border-strong rounded-[14px] p-2 flex gap-3 items-center group"
                >
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative w-[88px] h-[52px] sm:w-[100px] sm:h-[60px] bg-slate-100 rounded-[8px] overflow-hidden shrink-0 flex items-center justify-center"
                  >
                    {v.thumbnail ? (
                      <img src={v.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <Play className="w-5 h-5 text-text-muted" />
                    )}
                    {v.durationSec != null && v.durationSec > 0 && (
                      <span className="absolute bottom-1 right-1 text-[9px] font-medium bg-black/80 text-white px-1 py-0.5 rounded">
                        {formatDuration(v.durationSec)}
                      </span>
                    )}
                  </a>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs sm:text-sm text-primary line-clamp-2 leading-snug">{v.title}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">{v.channel}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => !added && handleAdd(v)}
                    disabled={added}
                    aria-label={added ? 'Already added' : 'Add to today'}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      added
                        ? 'bg-emerald-100 text-emerald-700 cursor-default dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-primary text-white hover:bg-primary/90'
                    }`}
                  >
                    {added ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && !error && query.trim() && results.length === 0 && isYouTubeConfigured && (
        <p className="text-xs text-text-muted text-center py-3">No results for "{query}".</p>
      )}
    </div>
  );
}
