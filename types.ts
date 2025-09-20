
export type SortKey = 'latest' | 'likes';

export type FoundItem = {
  url: string;
  source: string; // 'qiita' | 'note' | 'zenn'
  title?: string;
  snippet?: string;
  rank?: number; // Search result rank for fallback sorting
  raw?: any; // To pass raw data from search to enrich phase
};

export type EnrichedItem = FoundItem & {
  publishedAt?: string; // ISO format string
  likeCount?: number;
  viewCount?: number;
};

export type ProviderOptions = {
  tokens: string[]; // AND keywords
  maxDiscover: number; // Max items for this provider to find
};

export interface Provider {
  id: string;
  displayName: string;
  search(opts: ProviderOptions, signal: AbortSignal): Promise<FoundItem[]>;
  enrich(items: FoundItem[], signal: AbortSignal): Promise<EnrichedItem[]>;
}