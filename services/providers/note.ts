import type { Provider, ProviderOptions, FoundItem, EnrichedItem } from '../../types';
import { delay, duckduckgoSiteSearch } from '../../utils';

async function enrichNoteItem(item: FoundItem, signal: AbortSignal): Promise<EnrichedItem> {
  // IMPORTANT: This fetch will be blocked by CORS in a browser.
  // It requires a server-side proxy to work in a real web application.
  try {
    const res = await fetch(item.url, { signal });
    if (!res.ok) return { ...item }; // Failed to fetch, return as is

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Find published date
    const timeEl = doc.querySelector('time[datetime]');
    const publishedAt = timeEl?.getAttribute('datetime') || undefined;

    // Find like count (スキ)
    // This is brittle and may break if Note.com changes its markup.
    const bodyText = doc.body.textContent || '';
    const likeMatch = bodyText.match(/スキ\s*([0-9,]+)/);
    const likeCount = likeMatch ? parseInt(likeMatch[1].replace(/,/g, ''), 10) : undefined;

    return { ...item, publishedAt, likeCount };
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error(`[Note] Failed to enrich ${item.url}:`, error);
    }
    return { ...item }; // Return original on error
  }
}

export const noteProvider: Provider = {
  id: 'note',
  displayName: 'Note',
  async search(opts: ProviderOptions, signal: AbortSignal): Promise<FoundItem[]> {
    console.log(`[Note] Searching via DuckDuckGo for: ${opts.tokens.join(', ')}`);
    return await duckduckgoSiteSearch('note.com', opts.tokens, opts.maxDiscover, 'note', signal);
  },

  async enrich(items: FoundItem[], signal: AbortSignal): Promise<EnrichedItem[]> {
    console.log(`[Note] Enriching ${items.length} items by scraping pages.`);
    const enrichedItems: EnrichedItem[] = [];
    for (const item of items) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const enrichedItem = await enrichNoteItem(item, signal);
      enrichedItems.push(enrichedItem);
      // Politeness delay between scraping each page
      await delay(300 + Math.random() * 200, signal);
    }
    console.log(`[Note] Finished enriching.`);
    return enrichedItems;
  },
};
