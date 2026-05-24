/**
 * Deep-link providers for free learning resources.
 *
 * We cannot search W3Schools / freeCodeCamp / MDN inline because none of them
 * expose a public CORS-enabled search API. Instead we construct deep links
 * that open the search results directly in a new tab. This is honest about the
 * limitation while still saving the user a step.
 */

export interface SearchProvider {
  key: string;
  name: string;
  description: string;
  url: (query: string) => string;
  /** Used for a small visual badge. */
  accent: string;
}

const enc = (s: string) => encodeURIComponent(s.trim());

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
