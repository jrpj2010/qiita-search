import type { Provider, ProviderOptions, FoundItem, EnrichedItem } from '../../types';
import { delay } from '../../utils';

export const qiitaProvider: Provider = {
  id: 'qiita',
  displayName: 'Qiita',
  async search(opts: ProviderOptions, signal: AbortSignal): Promise<FoundItem[]> {
    const q = encodeURIComponent(opts.tokens.join(' '));
    const perPage = 100; // Qiita API max is 100
    const maxPages = Math.ceil(opts.maxDiscover / perPage);
    const foundItems: FoundItem[] = [];
    let page = 1;
    
    console.log(`[Qiita] Searching for: "${q}", aiming for ${opts.maxDiscover} items over ${maxPages} pages.`);

    while (foundItems.length < opts.maxDiscover && page <= maxPages && !signal.aborted) {
      const url = `https://qiita.com/api/v2/items?query=${q}&page=${page}&per_page=${perPage}`;
      console.log(`[Qiita] Fetching page ${page}: ${url}`);
      
      try {
        // NOTE: This fetch might be blocked by CORS in a browser without a proxy.
        const res = await fetch(url, { signal });
        if (!res.ok) {
          console.error(`[Qiita] API request failed with status: ${res.status}`);
          break;
        }

        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) {
          break; // No more results
        }

        data.forEach((item: any, idx: number) => {
          if (foundItems.length < opts.maxDiscover) {
            foundItems.push({
              url: item.url,
              source: 'qiita',
              title: item.title,
              rank: (page - 1) * perPage + idx + 1,
              raw: item, // Pass the full API object to the enrich step
            });
          }
        });
        
        page++;
        // Politeness delay between pages
        if (foundItems.length < opts.maxDiscover && data.length > 0 && page <= maxPages) {
          await delay(600, signal);
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
            console.error('[Qiita] Fetch error:', error);
        }
        break;
      }
    }
    
    console.log(`[Qiita] Found ${foundItems.length} items.`);
    return foundItems.slice(0, opts.maxDiscover);
  },

  async enrich(items: FoundItem[], signal: AbortSignal): Promise<EnrichedItem[]> {
    // Data is already fetched in the search phase, just transform it.
    // No new network requests are needed for basic info.
    return items.map(item => {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const raw = item.raw;
        return {
            ...item,
            publishedAt: raw?.created_at,
            likeCount: raw?.likes_count,
            // Qiita API v2 does not provide view counts in the items list
            viewCount: undefined, 
        };
    });
  },
};