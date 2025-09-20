import type { Provider, ProviderOptions, FoundItem, EnrichedItem } from '../../types';
import { delay, duckduckgoSiteSearch } from '../../utils';


async function enrichZennItem(item: FoundItem, signal: AbortSignal): Promise<EnrichedItem> {
  // IMPORTANT: This fetch will be blocked by CORS in a browser.
  // It requires a server-side proxy to work in a real web application.
  try {
    const res = await fetch(item.url, { signal });
    if (!res.ok) return { ...item };

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    let publishedAt: string | undefined;
    let likeCount: number | undefined;

    // Approach 1: Try to find JSON-LD script for structured data (more reliable)
    const ldJsonScript = doc.querySelector('script[type="application/ld+json"]');
    if (ldJsonScript?.textContent) {
      try {
        const ld = JSON.parse(ldJsonScript.textContent);
        publishedAt = ld.datePublished || ld.dateCreated;
        if (ld.interactionStatistic) {
          const likeInteraction = ld.interactionStatistic.find((stat: any) => stat.interactionType.includes('LikeAction'));
          if (likeInteraction) {
            likeCount = parseInt(likeInteraction.userInteractionCount, 10);
          }
        }
      } catch (e) {
        console.warn(`[Zenn] Failed to parse JSON-LD for ${item.url}`, e);
      }
    }

    // Fallback if JSON-LD fails
    if (!publishedAt) {
      const timeEl = doc.querySelector('time[datetime]');
      publishedAt = timeEl?.getAttribute('datetime') || undefined;
    }
    if (!likeCount) {
        // This is brittle. Looks for a specific element structure near the like button.
        const likeButton = doc.querySelector('[class^="Like_container"]');
        const likeCountText = likeButton?.querySelector('span')?.textContent;
        if(likeCountText) {
            likeCount = parseInt(likeCountText, 10);
        }
    }

    return { ...item, publishedAt, likeCount };
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error(`[Zenn] Failed to enrich ${item.url}:`, error);
    }
    return { ...item };
  }
}

export const zennProvider: Provider = {
  id: 'zenn',
  displayName: 'Zenn',
  async search(opts: ProviderOptions, signal: AbortSignal): Promise<FoundItem[]> {
    console.log(`[Zenn] Searching via DuckDuckGo for: ${opts.tokens.join(', ')}`);
    return await duckduckgoSiteSearch('zenn.dev', opts.tokens, opts.maxDiscover, 'zenn', signal);
  },

  async enrich(items: FoundItem[], signal: AbortSignal): Promise<EnrichedItem[]> {
    console.log(`[Zenn] Enriching ${items.length} items by scraping pages.`);
    const enrichedItems: EnrichedItem[] = [];
    for (const item of items) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const enrichedItem = await enrichZennItem(item, signal);
      enrichedItems.push(enrichedItem);
      // Politeness delay
      await delay(300 + Math.random() * 200, signal);
    }
    console.log(`[Zenn] Finished enriching.`);
    return enrichedItems;
  },
};
