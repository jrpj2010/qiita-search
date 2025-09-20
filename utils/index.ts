// Fix: Add import for FoundItem type.
import type { FoundItem } from '../types';

/**
 * Splits an input string by spaces or ampersands into an array of tokens.
 * @param input The raw search query string.
 * @returns An array of non-empty keyword tokens.
 */
export function tokenize(input: string): string[] {
  return input
    .split(/[\s&]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Creates a promise that resolves after a specified duration.
 * Can be aborted via an AbortSignal.
 * @param ms The delay in milliseconds.
 * @param signal The AbortSignal to listen for cancellation.
 * @returns A promise that resolves after the delay.
 */
export const delay = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });

// Fix: Implement and export the missing duckduckgoSiteSearch function.
/**
 * Performs a site-specific search on DuckDuckGo and scrapes the results.
 * NOTE: This will likely be blocked by CORS in a browser and requires a server-side proxy.
 * @param site The domain to search within (e.g., 'note.com').
 * @param tokens The keywords to search for.
 * @param maxResults The maximum number of results to return.
 * @param source The source identifier for the FoundItem.
 * @param signal An AbortSignal to cancel the operation.
 * @returns A promise that resolves to an array of FoundItem.
 */
export async function duckduckgoSiteSearch(
  site: string,
  tokens: string[],
  maxResults: number,
  source: string,
  signal: AbortSignal
): Promise<FoundItem[]> {
  const query = encodeURIComponent(`site:${site} ${tokens.join(' ')}`);
  // Use the non-JS version of DDG for simpler scraping
  const url = `https://html.duckduckgo.com/html/?q=${query}`;
  const foundItems: FoundItem[] = [];

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      console.error(`[DDG Search] Failed to fetch for site ${site}: ${res.status}`);
      return [];
    }
    const html = await res.text();
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const results = doc.querySelectorAll('.result');
    
    results.forEach((result, index) => {
      if (foundItems.length >= maxResults) return;

      const titleEl = result.querySelector('a.result__a');
      const snippetEl = result.querySelector('.result__snippet');
      const link = titleEl?.getAttribute('href');
      
      const title = titleEl?.textContent?.trim();
      const snippet = snippetEl?.textContent?.trim();
      
      if (link) {
        // Extract the target URL from DDG's redirect link
        const urlParams = new URLSearchParams(link.substring(link.indexOf('?')));
        const actualUrl = urlParams.get('uddg');
        
        if (actualUrl && title) {
          foundItems.push({
            url: actualUrl,
            title: title,
            snippet: snippet,
            source: source,
            rank: index + 1,
          });
        }
      }
    });
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error(`[DDG Search] Error during search for site ${site}:`, error);
    }
    // Let the caller handle AbortError
  }
  
  return foundItems.slice(0, maxResults);
}
