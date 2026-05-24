// ---- Legacy provider deep-links (used in SearchPage / PlanPage) -------------

const enc = (s: string) => encodeURIComponent(s.trim());

export interface SearchProvider {
  key: string;
  name: string;
  description: string;
  url: (query: string) => string;
  accent: string;
}

export const SEARCH_PROVIDERS: SearchProvider[] = [
  {
    key: 'mdn',
    name: 'MDN Web Docs',
    description: 'The reference for web standards (HTML, CSS, JavaScript).',
    accent: 'bg-blue-500',
    url: (q) => `https://developer.mozilla.org/en-US/search?q=${enc(q)}`,
  },
  {
    key: 'w3schools',
    name: 'W3Schools',
    description: 'Beginner-friendly tutorials with editable examples.',
    accent: 'bg-emerald-500',
    url: (q) => `https://www.w3schools.com/search/search_asp.asp?search=${enc(q)}`,
  },
  {
    key: 'fcc',
    name: 'freeCodeCamp',
    description: 'Free curriculum, articles, and practice projects.',
    accent: 'bg-amber-500',
    url: (q) => `https://www.freecodecamp.org/news/search/?query=${enc(q)}`,
  },
  {
    key: 'official',
    name: 'Official Docs',
    description: 'Find first-party documentation via Google.',
    accent: 'bg-purple-500',
    url: (q) => `https://www.google.com/search?q=${enc(q + ' official documentation')}`,
  },
];

// ---- Google Custom Search (used in InlineDocSearch) -------------------------

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY as string | undefined;
const GOOGLE_CSE_ID = import.meta.env.VITE_GOOGLE_CSE_ID as string | undefined;

export const isGoogleSearchConfigured = Boolean(GOOGLE_API_KEY && GOOGLE_CSE_ID);

export interface GoogleSearchResult {
  title: string;
  link: string;
  displayLink: string;
  snippet: string;
}

export async function searchGoogle(query: string): Promise<GoogleSearchResult[]> {
  if (!isGoogleSearchConfigured) return [];
  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${encodeURIComponent(query)}&num=8`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google search failed: ${res.status}`);
  const data = await res.json() as { items?: GoogleSearchResult[] };
  return data.items ?? [];
}
