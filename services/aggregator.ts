import type { Provider, EnrichedItem, FoundItem } from '../types';

export type RunOptions = {
  tokens: string[];
  providers: Provider[];
  maxTotal: number;
  signal: AbortSignal;
};

export async function runSearch(opts: RunOptions): Promise<EnrichedItem[]> {
  const { tokens, providers, maxTotal, signal } = opts;
  
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  // 1) Discover URLs from all providers in parallel
  const discovered: FoundItem[] = [];
  const seenUrls = new Set<string>();
  // Since it's only one provider now, this is simple.
  const perProviderTarget = Math.ceil(maxTotal / Math.max(1, providers.length));

  const searchPromises = providers.map(p => 
    p.search({ tokens, maxDiscover: perProviderTarget }, signal)
      .then(items => {
        for (const item of items) {
          if (signal.aborted) break;
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            discovered.push(item);
          }
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.error(`Error searching ${p.displayName}:`, err);
      })
  );
  
  await Promise.all(searchPromises);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  
  // 2) Enrich items with metrics
  let enriched: EnrichedItem[] = discovered;
  const itemsToEnrichByProvider = new Map<Provider, FoundItem[]>();
  for (const item of discovered) {
    const provider = providers.find(p => p.id === item.source);
    if (provider) {
      if (!itemsToEnrichByProvider.has(provider)) {
        itemsToEnrichByProvider.set(provider, []);
      }
      itemsToEnrichByProvider.get(provider)!.push(item);
    }
  }

  const enrichedChunks = await Promise.all(
    Array.from(itemsToEnrichByProvider.entries()).map(([provider, items]) =>
      provider.enrich(items, signal).catch(err => {
        if (err.name !== 'AbortError') console.error(`Error enriching ${provider.displayName}:`, err);
        return items; // Return non-enriched on error
      })
    )
  );
  enriched = enrichedChunks.flat();
  
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  // 3) Return all found and enriched items. Sorting is handled in the UI.
  return enriched.slice(0, maxTotal);
}