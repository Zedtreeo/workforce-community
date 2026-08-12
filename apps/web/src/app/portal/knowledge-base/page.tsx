'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { renderMarkdown } from '../../../lib/markdown';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Card, Badge, PageSkeleton, PageHeader, Modal } from '../../../components/ui';
import {
  Search, BookOpen, HelpCircle, ChevronRight, Eye, Filter, X,
} from 'lucide-react';

interface KbArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  module: string;
  category: string;
  tags: string[];
  isPublished: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

interface HelpContent {
  id: string;
  key: string;
  module: string;
  fieldName: string;
  title: string;
  description: string;
  example: string | null;
  validationRule: string | null;
  learnMoreUrl: string | null;
}

interface SearchResults {
  helpContent: HelpContent[];
  articles: KbArticle[];
}

const categoryColors: Record<string, 'brand' | 'info' | 'success' | 'default' | 'warning'> = {
  GUIDE: 'brand',
  FAQ: 'info',
  POLICY: 'success',
  COMPLIANCE: 'warning',
  TROUBLESHOOTING: 'default',
};

const modules = [
  'employees', 'departments', 'attendance', 'leaves', 'clients',
  'assignments', 'invoices', 'payroll', 'monitoring', 'documents',
  'holidays', 'settings',
];

// Read-only Knowledge Base for the employee portal. Uses the same open /kb/*
// read endpoints as the admin page, but lives under /portal so members aren't
// redirected away (adminRoutes bounces MEMBER/VIEWER to /portal) and get the
// portal nav. No article-management controls.
export default function PortalKnowledgeBasePage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<'articles' | 'tooltips'>('articles');
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [helpItems, setHelpItems] = useState<HelpContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [articleContent, setArticleContent] = useState('');
  const [articlePage] = useState(1);
  const [articleTotal, setArticleTotal] = useState(0);
  const [helpPage] = useState(1);
  const [helpTotal, setHelpTotal] = useState(0);

  const token = session?.session?.token;

  const loadArticles = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams({ page: String(articlePage), limit: '20', published: 'true' });
      if (selectedModule) params.set('module', selectedModule);
      const res = await apiFetch<{ data: KbArticle[]; meta: any }>(`/kb/articles?${params}`, { token });
      setArticles(res.data);
      setArticleTotal(res.meta.total);
    } catch { /* ignore */ }
  }, [token, articlePage, selectedModule]);

  const loadHelpContent = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams({ page: String(helpPage), limit: '50' });
      if (selectedModule) params.set('module', selectedModule);
      const res = await apiFetch<{ data: HelpContent[]; meta: any }>(`/kb/help?${params}`, { token });
      setHelpItems(res.data);
      setHelpTotal(res.meta.total);
    } catch { /* ignore */ }
  }, [token, helpPage, selectedModule]);

  useEffect(() => {
    if (token) {
      Promise.all([loadArticles(), loadHelpContent()]).finally(() => setLoading(false));
    }
  }, [token, loadArticles, loadHelpContent]);

  const handleSearch = useCallback(async () => {
    if (!token || !searchQuery || searchQuery.length < 2) {
      setSearchResults(null);
      return;
    }
    try {
      const res = await apiFetch<SearchResults>(`/kb/search?q=${encodeURIComponent(searchQuery)}&limit=10`, { token });
      setSearchResults(res);
    } catch {
      setSearchResults(null);
    }
  }, [token, searchQuery]);

  useEffect(() => {
    const timer = setTimeout(handleSearch, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const openArticle = async (slug: string) => {
    if (!token) return;
    try {
      const article = await apiFetch<any>(`/kb/articles/slug/${slug}`, { token });
      setSelectedArticle(article);
      setArticleContent(article.content);
    } catch { /* ignore */ }
  };

  if (loading) return <DashboardLayout><PageSkeleton /></DashboardLayout>;

  const tabs = [
    { key: 'articles' as const, label: 'Articles', icon: <BookOpen className="h-4 w-4" />, count: articleTotal },
    { key: 'tooltips' as const, label: 'Field Help', icon: <HelpCircle className="h-4 w-4" />, count: helpTotal },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Knowledge Base"
          breadcrumbs={[{ label: 'My Portal', href: '/portal' }, { label: 'Knowledge Base' }]}
        />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-content-tertiary" />
          <input
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-surface-200 bg-white text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Search articles, field help, guides..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-content-tertiary hover:text-content-secondary"
              onClick={() => { setSearchQuery(''); setSearchResults(null); }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {searchResults && searchQuery.length >= 2 && (
          <Card padding="md">
            <p className="text-xs font-medium text-content-tertiary uppercase tracking-wider mb-3">
              Search Results ({searchResults.articles.length + searchResults.helpContent.length} found)
            </p>
            {searchResults.articles.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-content-secondary mb-2 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> Articles
                </p>
                {searchResults.articles.map((a) => (
                  <button
                    key={a.id}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-50 transition-colors"
                    onClick={() => { openArticle(a.slug); setSearchQuery(''); setSearchResults(null); }}
                  >
                    <p className="text-sm font-medium text-content-primary">{a.title}</p>
                    <p className="text-xs text-content-tertiary mt-0.5">{a.excerpt || a.module}</p>
                  </button>
                ))}
              </div>
            )}
            {searchResults.helpContent.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-content-secondary mb-2 flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5" /> Field Help
                </p>
                {searchResults.helpContent.map((h) => (
                  <div key={h.id} className="px-3 py-2 rounded-lg hover:bg-surface-50">
                    <p className="text-sm font-medium text-content-primary">{h.title}</p>
                    <p className="text-xs text-content-tertiary mt-0.5">{h.description.slice(0, 100)}...</p>
                  </div>
                ))}
              </div>
            )}
            {searchResults.articles.length === 0 && searchResults.helpContent.length === 0 && (
              <p className="text-sm text-content-tertiary text-center py-4">No results found</p>
            )}
          </Card>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-1 border-b border-surface-200">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-content-tertiary hover:text-content-secondary'
                }`}
              >
                {t.icon}
                {t.label}
                <span className="text-xs bg-surface-100 px-1.5 py-0.5 rounded-full">{t.count}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-content-tertiary" />
            <select
              className="h-8 px-2 rounded-lg border border-surface-200 bg-white text-xs text-content-secondary focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
            >
              <option value="">All Modules</option>
              {modules.map((m) => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {tab === 'articles' && (
          <div className="grid gap-4">
            {articles.length === 0 ? (
              <Card padding="lg">
                <div className="text-center py-8">
                  <BookOpen className="h-10 w-10 text-content-tertiary mx-auto mb-3" />
                  <p className="text-sm text-content-secondary font-medium">No articles yet</p>
                  <p className="text-xs text-content-tertiary mt-1">Knowledge base articles will appear here once published.</p>
                </div>
              </Card>
            ) : (
              articles.map((article) => (
                <Card key={article.id} padding="md">
                  <button
                    className="w-full text-left flex items-start justify-between"
                    onClick={() => openArticle(article.slug)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant={categoryColors[article.category] || 'default'}>
                          {article.category}
                        </Badge>
                        <span className="text-xs text-content-tertiary">{article.module}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-content-primary">{article.title}</h3>
                      {article.excerpt && (
                        <p className="text-xs text-content-tertiary mt-1 line-clamp-2">{article.excerpt}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-content-tertiary flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {article.viewCount}
                        </span>
                        {article.tags.length > 0 && (
                          <span className="text-xs text-content-tertiary">
                            {article.tags.slice(0, 3).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-content-tertiary shrink-0 mt-1" />
                  </button>
                </Card>
              ))
            )}
          </div>
        )}

        {tab === 'tooltips' && (
          <Card padding="none">
            {helpItems.length === 0 ? (
              <div className="text-center py-8">
                <HelpCircle className="h-10 w-10 text-content-tertiary mx-auto mb-3" />
                <p className="text-sm text-content-secondary font-medium">No field help entries yet</p>
                <p className="text-xs text-content-tertiary mt-1">Field-level tooltips will appear here once configured.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-50 text-left border-b border-surface-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Field</th>
                    <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Module</th>
                    <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-xs font-medium text-content-tertiary uppercase tracking-wider">Example</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200">
                  {helpItems.map((h) => (
                    <tr key={h.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-content-primary">{h.title}</p>
                        <p className="text-xs text-content-tertiary">{h.key}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="default">{h.module}</Badge>
                      </td>
                      <td className="px-4 py-3 max-w-sm">
                        <p className="text-xs text-content-secondary line-clamp-2">{h.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-surface-50 px-1.5 py-0.5 rounded text-brand-700">{h.example || '—'}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
      </div>

      <Modal
        open={!!selectedArticle}
        onClose={() => { setSelectedArticle(null); setArticleContent(''); }}
        title={selectedArticle?.title || ''}
        description={`${selectedArticle?.module || ''} · ${selectedArticle?.category || ''}`}
      >
        <div className="prose prose-sm max-w-none">
          <div
            className="text-sm text-content-secondary leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(articleContent) }}
          />
          {selectedArticle?.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-surface-200">
              {selectedArticle.tags.map((tag: string) => (
                <span key={tag} className="text-xs bg-surface-100 text-content-tertiary px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </DashboardLayout>
  );
}
