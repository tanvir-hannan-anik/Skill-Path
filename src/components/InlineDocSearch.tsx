import { useState } from 'react';
import { Search, Plus, ArrowUpRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SEARCH_PROVIDERS } from '../lib/search';
import type { Resource } from '../types';

interface Props {
  existingUrls: string[];
  onAdd: (resource: Resource) => void;
  placeholder?: string;
}

/**
 * Search-as-you-type provider suggestions for the Learn page docs panel.
 * Renders cards for MDN / W3Schools / freeCodeCamp / official-docs Google
 * search. Each card has a + to add the deep-link to today's docs.
 */
export function InlineDocSearch({ existingUrls, onAdd, placeholder }: Props) {
  const [query, setQuery] = useState('');

  const trimmed = query.trim();

  const handleAdd = (providerName: string, url: string) => {
    onAdd({
      url,
      title: `${providerName} — ${trimmed}`,
      source: providerName,
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
          placeholder={placeholder ?? 'Search documentation…'}
          className="w-full bg-white border border-border-strong rounded-[16px] pl-10 pr-4 py-3 outline-none focus:border-primary text-sm shadow-sm transition-colors text-primary"
        />
      </div>

      <AnimatePresence>
        {trimmed.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-2"
          >
            {SEARCH_PROVIDERS.map((p) => {
              const url = p.url(trimmed);
              const added = existingUrls.includes(url);
              return (
                <div
                  key={p.key}
                  className="bg-white border border-border-strong rounded-[14px] p-3 flex items-center gap-3"
                >
                  <div className={`w-1.5 h-10 rounded-full ${p.accent} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-primary truncate">{p.name}</p>
                    <p className="text-[11px] text-text-muted line-clamp-1">Search "{trimmed}"</p>
                  </div>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${p.name} in a new tab`}
                    className="w-8 h-8 rounded-lg bg-canvas border border-border-strong flex items-center justify-center text-text-secondary hover:text-primary transition-colors shrink-0"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => !added && handleAdd(p.name, url)}
                    disabled={added}
                    aria-label={added ? 'Already added' : `Add ${p.name} to today's docs`}
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
    </div>
  );
}
