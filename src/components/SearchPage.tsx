import { FormEvent, useState } from 'react';
import { Search, ExternalLink, Play, Loader2, Plus, ArrowUpRight, Sparkles, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { SEARCH_PROVIDERS } from '../lib/search';
import { formatDuration, isYouTubeConfigured, searchYouTube, videoIdToUrl } from '../lib/youtube';
import { useToast } from '../lib/toast';
import type { Resource, YouTubeResult } from '../types';

interface Props {
  initialQuery?: string;
  onAddVideo?: (v: Resource) => void;
  onAddDoc?: (d: Resource) => void;
}

/**
 * Combined search hub: shows YouTube results (real API) and deep-link cards to
 * MDN / W3Schools / freeCodeCamp / official docs. Honest about what's inline
 * vs what opens in a new tab.
 */
export function SearchPage({ initialQuery = '', onAddVideo, onAddDoc }: Props) {
  const toast = useToast();
  const [input, setInput] = useState(initialQuery);
  const [query, setQuery] = useState('');
  const [videos, setVideos] = useState<YouTubeResult[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [videosError, setVideosError] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const q = input.trim();
    if (!q) return;
    setQuery(q);

    if (isYouTubeConfigured) {
      setVideosLoading(true);
      setVideosError(null);
      try {
        const results = await searchYouTube(q, 8);
        setVideos(results);
      } catch (err) {
        setVideosError((err as Error).message);
        setVideos([]);
      } finally {
        setVideosLoading(false);
      }
    } else {
      setVideos([]);
      setVideosError(null);
    }
  }

  function handleAddVideo(v: YouTubeResult) {
    const res: Resource = {
      url: videoIdToUrl(v.videoId),
      title: v.title,
      source: v.channel,
    };
    onAddVideo?.(res);
    setAdded((s) => ({ ...s, [res.url]: true }));
    toast.success("Added to today's videos — open Learn → Video to start watching.");
  }

  function handleAddProviderLink(name: string, url: string) {
    const res: Resource = { url, title: `${name} — ${query}`, source: name };
    onAddDoc?.(res);
    setAdded((s) => ({ ...s, [url]: true }));
    toast.success(`${name} saved to today's docs — open Learn → Documentation.`);
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 w-full">
      <div className="mb-6 sm:mb-8 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-canvas rounded-lg border border-border-strong text-xs font-semibold uppercase tracking-widest text-text-secondary">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          Free Resources
        </div>
        <h1 className="font-display font-medium text-3xl sm:text-4xl text-primary tracking-tight">
          Search the open web
        </h1>
        <p className="text-text-secondary text-base max-w-2xl leading-relaxed">
          One query, four trusted sources. MDN, W3Schools, freeCodeCamp, and YouTube — no fluff, no paywalls.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mb-8 sm:mb-10">
        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Try "HTML Variables", "React hooks", "Python list comprehension"…'
            className="w-full bg-white border border-border-strong rounded-2xl pl-14 pr-32 py-4 sm:py-5 outline-none focus:border-primary text-base sm:text-lg shadow-sm transition-colors text-primary"
            aria-label="Search topic"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
            disabled={!input.trim()}
          >
            Search
          </button>
        </div>
      </form>

      {query && (
        <>
          {/* Provider deep-links */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-medium text-xl text-primary">Reading resources</h2>
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Opens in new tab</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SEARCH_PROVIDERS.map((p) => (
                <div
                  key={p.key}
                  className="bg-white border border-border-strong rounded-2xl p-4 sm:p-5 flex items-start gap-4 hover:border-primary/30 hover:shadow-sm transition-all group"
                >
                  <div className={`w-2 h-12 rounded-full ${p.accent} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-medium text-base text-primary truncate">{p.name}</h3>
                    <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{p.description}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <a
                      href={p.url(query)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${p.name} search`}
                      className="w-9 h-9 rounded-xl bg-canvas border border-border-strong flex items-center justify-center text-text-secondary hover:text-primary hover:border-primary/30 transition-colors"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </a>
                    {onAddDoc && (() => {
                      const url = p.url(query);
                      const isAdded = added[url];
                      return (
                        <button
                          onClick={() => !isAdded && handleAddProviderLink(p.name, url)}
                          disabled={isAdded}
                          aria-label={isAdded ? 'Already added' : `Save ${p.name} link to today's docs`}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                            isAdded
                              ? 'bg-emerald-100 text-emerald-700 cursor-default dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-primary text-white hover:bg-primary/90'
                          }`}
                          title={isAdded ? 'Already in today\'s docs' : "Save to today's docs"}
                        >
                          {isAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* YouTube results */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-medium text-xl text-primary">YouTube tutorials</h2>
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                {isYouTubeConfigured ? 'Live search' : 'API key missing'}
              </span>
            </div>

            {!isYouTubeConfigured && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900">
                Add <code className="font-mono">VITE_YOUTUBE_API_KEY</code> to your{' '}
                <code className="font-mono">.env.local</code> to enable in-app YouTube search.
              </div>
            )}

            {videosLoading && (
              <div className="flex items-center gap-3 text-text-secondary text-sm py-8 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Searching YouTube…
              </div>
            )}

            {videosError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
                {videosError}
              </div>
            )}

            {!videosLoading && videos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map((v) => (
                  <motion.div
                    key={v.videoId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border border-border-strong rounded-2xl overflow-hidden flex flex-col group"
                  >
                    <a
                      href={videoIdToUrl(v.videoId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative aspect-video bg-black overflow-hidden block"
                    >
                      {v.thumbnail && (
                        <img
                          src={v.thumbnail}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                        <Play className="w-10 h-10 text-white" />
                      </div>
                      {v.durationSec != null && v.durationSec > 0 && (
                        <span className="absolute bottom-2 right-2 text-[11px] font-medium bg-black/80 text-white px-1.5 py-0.5 rounded">
                          {formatDuration(v.durationSec)}
                        </span>
                      )}
                    </a>
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-medium text-sm text-primary line-clamp-2 leading-snug mb-1">{v.title}</h3>
                      <p className="text-xs text-text-muted mb-3">{v.channel}</p>
                      <div className="mt-auto flex items-center gap-2">
                        {onAddVideo && (() => {
                          const url = videoIdToUrl(v.videoId);
                          const isAdded = added[url];
                          return (
                            <button
                              onClick={() => !isAdded && handleAddVideo(v)}
                              disabled={isAdded}
                              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                                isAdded
                                  ? 'bg-emerald-100 text-emerald-700 cursor-default dark:bg-emerald-900/40 dark:text-emerald-300'
                                  : 'bg-primary text-white hover:bg-primary/90'
                              }`}
                            >
                              {isAdded ? <><Check className="w-3.5 h-3.5" /> Added</> : <><Plus className="w-3.5 h-3.5" /> Add to today</>}
                            </button>
                          );
                        })()}
                        <a
                          href={videoIdToUrl(v.videoId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open on YouTube"
                          className="w-8 h-8 rounded-lg bg-canvas border border-border-strong flex items-center justify-center text-text-secondary hover:text-primary transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {!videosLoading && !videosError && isYouTubeConfigured && videos.length === 0 && query && (
              <div className="text-sm text-text-muted text-center py-8">No videos found for "{query}".</div>
            )}
          </section>
        </>
      )}

      {!query && (
        <div className="bg-canvas border border-dashed border-border-strong rounded-2xl p-10 sm:p-16 text-center">
          <Search className="w-10 h-10 text-text-muted mx-auto mb-4" />
          <p className="text-text-secondary">Start typing a topic to see free resources and tutorials.</p>
        </div>
      )}
    </div>
  );
}
