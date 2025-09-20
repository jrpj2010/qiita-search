import React, { useState, useRef, useCallback, useMemo } from 'react';
import type { SortKey, EnrichedItem } from './types';
import { runSearch } from './services/aggregator';
import { providerRegistry } from './services/providers';
import { tokenize } from './utils';
import { SearchIcon, StopIcon, CopyIcon, CheckIcon, ArrowUpIcon, ArrowDownIcon } from './components/Icons';

type SearchStatus = 'idle' | 'searching' | 'stopped' | 'finished';
type SortDirection = 'asc' | 'desc';
type SortConfig = {
  key: SortKey;
  direction: SortDirection;
};

const App: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [maxResults, setMaxResults] = useState<50 | 300>(50);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'latest', direction: 'desc' });
  
  const [foundItems, setFoundItems] = useState<EnrichedItem[]>([]);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [statusText, setStatusText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStartSearch = useCallback(async () => {
    if (query.trim() === '') {
      setStatusText('キーワードを入力してください。');
      setTimeout(() => setStatusText(''), 3000);
      return;
    }

    setFoundItems([]);
    setSelectedUrls(new Set());
    setStatus('searching');
    setStatusText('検索中...');
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    const tokens = tokenize(query);
    const qiitaProvider = providerRegistry['qiita'];

    try {
      const finalItems: EnrichedItem[] = await runSearch({
        tokens,
        providers: [qiitaProvider],
        maxTotal: 500, // Fetch up to 500 items
        signal,
      });
      
      if (signal.aborted) {
         setStatus('stopped');
         setStatusText('検索を停止しました。');
      } else {
        setFoundItems(finalItems);
        setSelectedUrls(new Set(finalItems.map(item => item.url)));
        setStatus('finished');
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setStatus('stopped');
        setStatusText('検索を停止しました。');
      } else {
        console.error('Search error:', error);
        setStatus('idle');
        setStatusText('エラーが発生しました。');
      }
    }
  }, [query]);
  
  const handleStopSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };
  
  const sortedItems = useMemo(() => {
    const sortableItems = [...foundItems];
    sortableItems.sort((a, b) => {
        const { key, direction } = sortConfig;
        const dir = direction === 'asc' ? 1 : -1;

        if (key === 'latest') {
            const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return (dateA - dateB) * dir;
        }
        if (key === 'likes') {
            const likesA = a.likeCount ?? -1;
            const likesB = b.likeCount ?? -1;
            if (likesA !== likesB) {
                return (likesA - likesB) * dir;
            }
             const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return (dateB - dateA); // Secondary sort by latest
        }
        return 0;
    });
    return sortableItems;
  }, [foundItems, sortConfig]);

  const handleCopy = () => {
    const urlsToCopy = sortedItems
      .filter(item => selectedUrls.has(item.url))
      .slice(0, maxResults)
      .map(item => item.url)
      .join('\n');
      
    if (urlsToCopy) {
      navigator.clipboard.writeText(urlsToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSelectRow = (url: string) => {
    const newSelectedUrls = new Set(selectedUrls);
    if (newSelectedUrls.has(url)) {
      newSelectedUrls.delete(url);
    } else {
      newSelectedUrls.add(url);
    }
    setSelectedUrls(newSelectedUrls);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedUrls(new Set(foundItems.map(item => item.url)));
    } else {
      setSelectedUrls(new Set());
    }
  };
  
  const handleSort = (key: SortKey) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' };
    });
  };

  const currentStatusText = useMemo(() => {
    if (status === 'searching' || status === 'stopped') return statusText;
    if (status === 'finished' || (status === 'idle' && foundItems.length > 0)) {
        return `完了 ${foundItems.length}件 | ${selectedUrls.size}件選択中 (上位${maxResults}件をコピー)`;
    }
    return statusText;
  }, [status, statusText, foundItems.length, selectedUrls.size, maxResults]);

  const isAllSelected = useMemo(() => {
    return foundItems.length > 0 && selectedUrls.size === foundItems.length;
  }, [foundItems, selectedUrls]);


  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex p-2">
      <div className="w-full max-w-lg mx-auto bg-gray-800 rounded-2xl shadow-lg p-4 space-y-4 border border-gray-700 flex flex-col">
        <header>
          <h1 className="text-2xl font-bold text-center text-cyan-400">勝Qiitaサーチ</h1>
        </header>

        <div className="space-y-3">
          <div className="relative">
            <input
              id="q"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="キーワード（スペース / & でAND検索）"
              className="w-full bg-gray-900 border-2 border-gray-600 focus:border-cyan-500 focus:ring-cyan-500 rounded-lg py-2 px-3 text-white placeholder-gray-500 transition-colors text-sm"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <fieldset className="p-3 border-2 border-gray-700 rounded-lg">
              <legend className="px-2 text-gray-400 font-semibold text-sm">コピー上限</legend>
              <div className="flex gap-4">
                <label className="flex items-center space-x-2 cursor-pointer text-sm">
                  <input type="radio" name="count" value="50" checked={maxResults === 50} onChange={() => setMaxResults(50)} className="h-4 w-4 bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-600"/>
                  <span>TOP 50</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer text-sm">
                  <input type="radio" name="count" value="300" checked={maxResults === 300} onChange={() => setMaxResults(300)} className="h-4 w-4 bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-600"/>
                  <span>TOP 300</span>
                </label>
              </div>
            </fieldset>

            <fieldset className="p-3 border-2 border-gray-700 rounded-lg">
              <legend className="px-2 text-gray-400 font-semibold text-sm">初期ソート</legend>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center space-x-2 cursor-pointer text-sm">
                  <input type="radio" name="sort" value="latest" checked={sortConfig.key === 'latest'} onChange={() => handleSort('latest')} className="h-4 w-4 bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-600"/>
                  <span>最新</span>
                </label>
                 <label className="flex items-center space-x-2 cursor-pointer text-sm">
                  <input type="radio" name="sort" value="likes" checked={sortConfig.key === 'likes'} onChange={() => handleSort('likes')} className="h-4 w-4 bg-gray-700 border-gray-600 text-cyan-500 focus:ring-cyan-600"/>
                  <span>いいね</span>
                </label>
              </div>
            </fieldset>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-3">
          <button 
            id="start" 
            onClick={handleStartSearch} 
            disabled={status === 'searching'}
            className="flex items-center justify-center gap-2 flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-500 text-white font-bold rounded-lg shadow-md transition-all duration-300 text-sm"
          >
            <SearchIcon />
            検索開始
          </button>
          <button 
            id="stop" 
            onClick={handleStopSearch}
            disabled={status !== 'searching'}
            className="flex items-center justify-center gap-2 flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-500 text-white font-bold rounded-lg shadow-md transition-all duration-300 text-sm"
          >
            <StopIcon />
            停止
          </button>
          <button 
            id="copy" 
            onClick={handleCopy}
            disabled={selectedUrls.size === 0}
            className="relative flex items-center justify-center gap-2 flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-500 text-white font-bold rounded-lg shadow-md transition-all duration-300 text-sm"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? 'コピー完了' : `選択URLコピー`}
          </button>
        </div>

        <div className="space-y-1 flex-grow flex flex-col min-h-0">
            <div className="flex-grow bg-gray-900 border-2 border-gray-600 rounded-lg overflow-auto min-h-0">
                <table className="w-full text-sm text-left text-gray-300 table-fixed">
                    <thead className="text-xs text-cyan-400 uppercase bg-gray-700 sticky top-0 z-10">
                        <tr>
                            <th scope="col" className="p-2 w-12 text-center">
                                <input type="checkbox"
                                       checked={isAllSelected}
                                       onChange={handleSelectAll}
                                       className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-cyan-500 focus:ring-cyan-600"
                                />
                            </th>
                            <th scope="col" className="p-2 w-16 text-center">No.</th>
                            <th scope="col" className="p-2">Title</th>
                            <th scope="col" className="p-2 w-40 cursor-pointer hover:bg-gray-600" onClick={() => handleSort('latest')}>
                                <div className="flex items-center justify-between">
                                  <span>公開日</span>
                                  {sortConfig.key === 'latest' && (sortConfig.direction === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />)}
                                </div>
                            </th>
                            <th scope="col" className="p-2 w-24 text-center cursor-pointer hover:bg-gray-600" onClick={() => handleSort('likes')}>
                               <div className="flex items-center justify-center gap-1">
                                  <span>いいね</span>
                                  {sortConfig.key === 'likes' && (sortConfig.direction === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />)}
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {status === 'searching' && (
                            <tr>
                                <td colSpan={5} className="text-center p-8 text-gray-400">
                                    <div className="animate-pulse">Qiitaから記事を取得しています...</div>
                                </td>
                            </tr>
                        )}
                        {sortedItems.map((item, index) => (
                            <tr key={item.url} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50">
                                <td className="p-2 text-center">
                                    <input type="checkbox"
                                           checked={selectedUrls.has(item.url)}
                                           onChange={() => handleSelectRow(item.url)}
                                           className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-cyan-500 focus:ring-cyan-600"
                                    />
                                </td>
                                <td className="p-2 text-center text-gray-400">{index + 1}</td>
                                <td className="p-2 truncate">
                                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline" title={item.title}>
                                    {item.title ?? '-'}
                                  </a>
                                </td>
                                <td className="p-2 text-gray-400">
                                  {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString('ja-JP') : '-'}
                                </td>
                                <td className="p-2 text-center">{item.likeCount ?? '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                 {status !== 'searching' && foundItems.length === 0 && (
                    <div className="text-center p-8 text-gray-500">
                        ここに検索結果が表示されます
                    </div>
                 )}
            </div>
            <div id="status" className="text-right text-xs text-gray-400 h-5 pr-2">
                {currentStatusText}
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;