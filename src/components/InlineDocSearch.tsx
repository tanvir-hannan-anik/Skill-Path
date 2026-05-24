import { useEffect, useRef, useState } from 'react';
import { Search, Plus, ArrowUpRight, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { searchGoogle, isGoogleSearchConfigured, type GoogleSearchResult } from '../lib/search';
import type { Resource } from '../types';

interface Props {
  existingUrls: string[];
  onAdd: (resource: Resource) => void;
  placeholder?: string;
}

export function InlineDocSearch({ existingUrls, onAdd, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GoogleSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) { setResults([]); setError(null); return; }
    if (!isGoogleSearchConfigured) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await searchGoogle(trimmed);
        setResults(items);
      } catch {
        setError('Search failed. Check your connection.');
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [trimmed]);

  const handleAdd = (result: GoogleSearchResult) => {
    onAdd({ url: result.link, title: result.title, source: result.displayLink });
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? 'Search for documentation…'}
          className="w-full bg-white border border-border-strong rounded-[16px] pl-10 pr-4 py-3 outline-none focus:border-primary text-sm shadow-sm transition-colors text-primary"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted animate-spin" />
        )}
      </div>

      <AnimatePresence>
        {trimmed.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-2"
          >
            {/* Google results */}
            {isGoogleSearchConfigured && results.map((result) => {
              const added = existingUrls.includes(result.link);
              return (
                <div
                  key={result.link}
                  className="bg-white border border-border-strong rounded-[14px] p-3 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-primary line-clamp-1">{result.title}</p>
                    <p className="text-[11px] text-emerald-600 font-medium mb-0.5 truncate">{result.displayLink}</p>
                    <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">{result.snippet}</p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <a
                      href={result.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open in new tab"
                      className="w-8 h-8 rounded-lg bg-canvas border border-border-strong flex items-center justify-center text-text-secondary hover:text-primary transition-colors"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => !added && handleAdd(result)}
                      disabled={added}
                      aria-label={added ? 'Already added' : 'Add to today'}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        added
                          ? 'bg-emerald-100 text-emerald-700 cursor-default'
                          : 'bg-primary text-white hover:bg-primary/90'
                      }`}
                    >
                      {added ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Empty state when configured but no results yet / still loading */}
            {isGoogleSearchConfigured && !loading && results.length === 0 && !error && (
              <p className="text-xs text-text-muted text-center py-2">No results found. Try a different search term.</p>
            )}

            {/* Error */}
            {error && <p className="text-xs text-red-500 text-center py-2">{error}</p>}

            {/* Fallback when CSE not configured: open Google in new tab */}
            {!isGoogleSearchConfigured && (
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(trimmed + ' documentation tutorial')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-white border border-border-strong rounded-[14px] p-3 hover:border-primary/30 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-canvas border border-border-strong flex items-center justify-center shrink-0">
                  <Search className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-primary">Search Google</p>
                  <p className="text-[11px] text-text-muted truncate">"{trimmed} documentation tutorial"</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors shrink-0" />
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
