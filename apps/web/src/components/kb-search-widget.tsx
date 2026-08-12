'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '../lib/auth-client';
import { apiFetch } from '../lib/api';
import { MessageCircleQuestion, Search, X, BookOpen, HelpCircle, ChevronRight } from 'lucide-react';

interface SearchResult {
  helpContent: Array<{
    id: string;
    key: string;
    title: string;
    description: string;
    module: string;
  }>;
  articles: Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    module: string;
    category: string;
  }>;
}

export function KbSearchWidget() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const token = session?.session?.token;

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSearch = useCallback(async () => {
    if (!token || !query || query.length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    try {
      const res = await apiFetch<SearchResult>(`/kb/search?q=${encodeURIComponent(query)}&limit=8`, { token });
      setResults(res);
    } catch {
      setResults(null);
    } finally {
      setSearching(false);
    }
  }, [token, query]);

  useEffect(() => {
    const timer = setTimeout(handleSearch, 300);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  const loadArticle = async (slug: string) => {
    if (!token) return;
    try {
      const article = await apiFetch<any>(`/kb/articles/slug/${slug}`, { token });
      setSelectedArticle(article);
    } catch { /* ignore */ }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 h-10 w-10 sm:bottom-6 sm:right-6 sm:h-12 sm:w-12 z-40 rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 transition-all hover:scale-105 flex items-center justify-center"
        title="Help & Knowledge Base (Ctrl+K)"
      >
        <MessageCircleQuestion size={22} />
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-16 inset-x-3 w-auto sm:bottom-20 sm:inset-x-auto sm:right-6 sm:w-96 z-50 max-h-[500px] bg-white border border-surface-200 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 bg-surface-50">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-content-primary">Help & Knowledge Base</h3>
            </div>
            <button onClick={() => setOpen(false)} className="text-content-tertiary hover:text-content-secondary">
              <X size={16} />
            </button>
          </div>

          {/* Article view */}
          {selectedArticle ? (
            <div className="flex-1 overflow-y-auto p-4">
              <button
                className="text-xs text-brand-600 hover:text-brand-700 mb-3 flex items-center gap-1"
                onClick={() => setSelectedArticle(null)}
              >
                ← Back to search
              </button>
              <h4 className="text-sm font-bold text-content-primary mb-2">{selectedArticle.title}</h4>
              <div className="text-xs text-content-secondary whitespace-pre-wrap leading-relaxed">
                {selectedArticle.content}
              </div>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="relative px-4 py-3">
                <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-content-tertiary" />
                <input
                  ref={inputRef}
                  className="w-full h-8 pl-8 pr-3 rounded-lg border border-surface-200 bg-white text-xs text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Ask a question or search..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <kbd className="absolute right-7 top-1/2 -translate-y-1/2 text-[10px] text-content-tertiary bg-surface-100 px-1.5 py-0.5 rounded">
                  ⌘K
                </kbd>
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {searching && (
                  <p className="text-xs text-content-tertiary text-center py-4">Searching...</p>
                )}

                {!searching && !results && query.length < 2 && (
                  <div className="text-center py-6">
                    <MessageCircleQuestion className="h-8 w-8 text-content-tertiary mx-auto mb-2" />
                    <p className="text-xs text-content-tertiary">Type to search articles and field help</p>
                    <p className="text-[10px] text-content-tertiary mt-1">Try: "salary", "leave policy", "invoice"</p>
                  </div>
                )}

                {results && (
                  <div className="space-y-3">
                    {results.articles.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-content-tertiary uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <BookOpen className="h-3 w-3" /> Articles
                        </p>
                        {results.articles.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => loadArticle(a.slug)}
                            className="w-full text-left px-2 py-2 rounded-lg hover:bg-surface-50 transition-colors flex items-center justify-between"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-content-primary truncate">{a.title}</p>
                              <p className="text-[10px] text-content-tertiary">{a.module} · {a.category}</p>
                            </div>
                            <ChevronRight className="h-3 w-3 text-content-tertiary shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}

                    {results.helpContent.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-content-tertiary uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <HelpCircle className="h-3 w-3" /> Field Help
                        </p>
                        {results.helpContent.map((h) => (
                          <div key={h.id} className="px-2 py-2 rounded-lg hover:bg-surface-50 transition-colors">
                            <p className="text-xs font-medium text-content-primary">{h.title}</p>
                            <p className="text-[10px] text-content-tertiary line-clamp-2 mt-0.5">{h.description}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {results.articles.length === 0 && results.helpContent.length === 0 && (
                      <p className="text-xs text-content-tertiary text-center py-4">No results found for "{query}"</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
