import { Play, Plus, ExternalLink, Maximize2, Minimize2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Resource } from '../types';
import { getYouTubeId, formatDuration } from '../lib/youtube';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';
import { useVideoPlan } from '../hooks/useVideoPlan';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/toast';
import { VideoPortionScheduler } from './VideoPortionScheduler';
import { InlineVideoSearch } from './InlineVideoSearch';

interface Props {
  videos: Resource[];
  onAddVideo: (v: Resource) => void;
  onRemoveVideo: (url: string) => void;
}

export function VideoMode({ videos, onAddVideo, onRemoveVideo }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(videos[0]?.url ?? null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const existingUrls = useMemo(() => videos.map((v) => v.url), [videos]);

  const handleSuggestionAdd = (r: Resource) => {
    if (videos.some((v) => v.url === r.url)) return;
    onAddVideo(r);
    setActiveUrl(r.url);
    toast.success('Video added to today.');
  };

  useEffect(() => {
    if (!videos.find((v) => v.url === activeUrl)) {
      setActiveUrl(videos[0]?.url ?? null);
    }
  }, [videos, activeUrl]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const activeVideo = useMemo(() => videos.find((v) => v.url === activeUrl) ?? null, [videos, activeUrl]);
  const activeYTId = activeVideo ? getYouTubeId(activeVideo.url) : null;

  const { containerRef: playerHostRef, currentSec, durationSec, seekTo } = useYouTubePlayer(activeYTId);
  const { plan, update: updatePlan } = useVideoPlan(user?.uid ?? null, activeYTId);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await containerRef.current?.requestFullscreen();
      else await document.exitFullscreen();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddURL = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    let parsed: URL;
    try { parsed = new URL(trimmed); } catch { setError('Please enter a valid URL.'); return; }
    if (videos.some((v) => v.url === trimmed)) {
      setError('That video is already in your list.');
      return;
    }
    const newVideo: Resource = {
      url: trimmed,
      title: `Video from ${parsed.hostname.replace(/^www\./, '')}`,
      source: parsed.hostname.replace(/^www\./, ''),
    };
    onAddVideo(newVideo);
    setActiveUrl(newVideo.url);
    setUrl('');
    setError(null);
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Player */}
      <div ref={containerRef} className={`relative group ${isFullscreen ? 'fixed inset-0 z-50 bg-black p-0 m-0' : ''}`}>
        {!isFullscreen && (
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-100 to-purple-100 opacity-50 blur-2xl rounded-[40px] -z-10 group-hover:opacity-70 transition-opacity duration-700 dark:opacity-10" />
        )}

        <div className={`bg-white border border-border-strong rounded-[24px] sm:rounded-[32px] overflow-hidden shadow-[0_8px_40px_rgb(0,0,0,0.06)] ${isFullscreen ? '!rounded-none !border-none h-full flex flex-col' : 'p-2'}`}>
          <div className={`w-full bg-black relative flex items-center justify-center overflow-hidden ${isFullscreen ? 'flex-1 rounded-none' : 'aspect-video rounded-[20px]'}`}>
            {activeYTId ? (
              <div ref={playerHostRef} className="w-full h-full" />
            ) : activeVideo ? (
              <div className="text-white/70 flex flex-col items-center text-center p-6">
                <Play className="w-12 h-12 mb-3 opacity-50" />
                <p className="mb-2 text-sm">This URL isn't a YouTube embed.</p>
                <a href={activeVideo.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-sm inline-flex items-center gap-1">
                  Open in new tab <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : (
              <div className="text-white/50 flex flex-col items-center">
                <Play className="w-12 h-12 mb-4 opacity-50" />
                <p>No video selected — add one below.</p>
              </div>
            )}

            <button
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/80 text-white rounded-lg backdrop-blur-sm transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100 z-10"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>

          {!isFullscreen && activeVideo && (
            <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-display text-lg sm:text-xl font-medium text-primary line-clamp-2">{activeVideo.title}</h3>
              <div className="flex items-center gap-3 text-sm font-medium text-text-secondary shrink-0">
                {durationSec > 0 && (
                  <span className="bg-canvas px-3 py-1 rounded-full text-xs tabular-nums">
                    {formatDuration(currentSec)} / {formatDuration(durationSec)}
                  </span>
                )}
                <a href={activeVideo.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" /> {activeVideo.source}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Portion scheduler */}
      {activeVideo && activeYTId && (
        <VideoPortionScheduler
          plan={plan}
          onChange={updatePlan}
          onSeek={seekTo}
          currentSec={currentSec}
          totalSecHint={durationSec}
          videoId={activeYTId}
          url={activeVideo.url}
          title={activeVideo.title}
          source={activeVideo.source}
        />
      )}

      {/* Library + add */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-canvas border border-border-strong rounded-[24px] p-5 sm:p-6 flex flex-col">
          <h4 className="font-display font-medium text-lg text-primary mb-2">Find & add</h4>
          <p className="text-sm text-text-secondary mb-5 leading-relaxed">
            Search YouTube directly, or paste a URL.
          </p>

          <InlineVideoSearch
            existingUrls={existingUrls}
            onAdd={handleSuggestionAdd}
            placeholder="Search YouTube tutorials…"
          />

          <div className="flex items-center gap-4 my-5">
            <div className="h-px bg-border-strong flex-1" />
            <span className="text-xs font-bold uppercase text-text-muted">OR PASTE URL</span>
            <div className="h-px bg-border-strong flex-1" />
          </div>

          <div className="relative">
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(null); }}
              placeholder="https://youtube.com/watch?v=…"
              onKeyDown={(e) => e.key === 'Enter' && handleAddURL()}
              className={`w-full bg-white border rounded-[16px] pl-4 pr-12 py-3 outline-none text-sm shadow-sm transition-colors text-primary ${error ? 'border-red-300 focus:border-red-500' : 'border-border-strong focus:border-primary'}`}
              aria-invalid={!!error}
            />
            <button
              onClick={handleAddURL}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
              aria-label="Add video"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>

        <div className="lg:col-span-2 bg-canvas border border-border-strong rounded-[24px] p-5 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <h4 className="font-display font-medium text-lg text-primary">Today's videos</h4>
            <span className="text-xs font-bold text-text-muted uppercase tracking-widest">{videos.length} {videos.length === 1 ? 'item' : 'items'}</span>
          </div>

          <div className="flex-1 space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {videos.map((vid) => (
              <div
                key={vid.url}
                onClick={() => setActiveUrl(vid.url)}
                className={`bg-white border rounded-[16px] p-3 flex gap-4 items-center cursor-pointer transition-all group ${
                  activeUrl === vid.url ? 'border-primary shadow-md' : 'border-border-strong hover:border-primary/50'
                }`}
              >
                <div className="w-[72px] h-[48px] sm:w-[84px] sm:h-[56px] bg-slate-100 rounded-[10px] flex items-center justify-center shrink-0">
                  <Play className={`w-5 h-5 ${activeUrl === vid.url ? 'text-primary' : 'text-primary/30'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-primary line-clamp-2 leading-snug">{vid.title}</p>
                  <p className="text-[11px] text-text-muted mt-1 font-medium">{vid.source}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveVideo(vid.url); }}
                  aria-label="Remove video"
                  className="w-8 h-8 flex items-center justify-center rounded-full text-text-muted hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {videos.length === 0 && (
              <div className="text-sm text-text-muted text-center py-6 bg-white/50 rounded-[16px] border border-dashed border-border-strong">
                No videos for today yet. Search above or paste a URL to add one.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
