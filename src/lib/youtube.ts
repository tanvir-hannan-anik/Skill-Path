import type { YouTubeResult } from '../types';

const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
export const isYouTubeConfigured = Boolean(apiKey);

/** ISO 8601 → seconds. e.g. "PT1H2M30S" → 3750. */
export function parseISO8601Duration(iso: string): number {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const h = Number(m[1] ?? 0);
  const mm = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  return h * 3600 + mm * 60 + s;
}

export function formatDuration(totalSec: number): string {
  if (!totalSec || totalSec < 0) return '0:00';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface SearchApiItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: { medium?: { url: string }; default?: { url: string } };
  };
}

interface VideoApiItem {
  id: string;
  contentDetails: { duration: string };
}

/**
 * Searches YouTube and returns top results with durations populated.
 * Costs 100 quota units (search) + 1 unit (videos.list) per call. With the
 * 10,000/day free quota this allows ~99 searches/day.
 */
export async function searchYouTube(query: string, maxResults = 8): Promise<YouTubeResult[]> {
  if (!apiKey) throw new Error('YouTube API key missing. Add VITE_YOUTUBE_API_KEY to .env.local.');
  const trimmed = query.trim();
  if (!trimmed) return [];

  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('maxResults', String(maxResults));
  searchUrl.searchParams.set('q', trimmed);
  searchUrl.searchParams.set('safeSearch', 'moderate');
  searchUrl.searchParams.set('key', apiKey);

  const searchRes = await fetch(searchUrl.toString());
  if (!searchRes.ok) {
    const body = await searchRes.text().catch(() => '');
    throw new Error(`YouTube search failed (${searchRes.status}): ${body.slice(0, 200)}`);
  }
  const searchJson = await searchRes.json() as { items?: SearchApiItem[] };
  const items = searchJson.items ?? [];
  if (items.length === 0) return [];

  // Fetch durations in one batch.
  const ids = items.map((i) => i.id.videoId).join(',');
  const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  detailsUrl.searchParams.set('part', 'contentDetails');
  detailsUrl.searchParams.set('id', ids);
  detailsUrl.searchParams.set('key', apiKey);

  let durations = new Map<string, number>();
  try {
    const detRes = await fetch(detailsUrl.toString());
    if (detRes.ok) {
      const detJson = await detRes.json() as { items?: VideoApiItem[] };
      for (const v of detJson.items ?? []) {
        durations.set(v.id, parseISO8601Duration(v.contentDetails.duration));
      }
    }
  } catch (err) {
    console.warn('YouTube duration lookup failed', err);
  }

  return items.map((i) => ({
    videoId: i.id.videoId,
    title: i.snippet.title,
    channel: i.snippet.channelTitle,
    publishedAt: i.snippet.publishedAt,
    thumbnail: i.snippet.thumbnails.medium?.url ?? i.snippet.thumbnails.default?.url ?? '',
    durationSec: durations.get(i.id.videoId),
  }));
}

export function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})/);
  return match ? match[1] : null;
}

export function videoIdToUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}
