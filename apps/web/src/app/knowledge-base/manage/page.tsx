'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { renderMarkdown } from '../../../lib/markdown';
import { Button, PageHeader, Badge } from '../../../components/ui';
import { Plus, Save, Trash2, X, ArrowLeft } from 'lucide-react';

interface Article {
  id: string;
  slug: string;
  title: string;
  content?: string;
  excerpt?: string | null;
  module: string;
  category: string;
  tags: string[];
  isPublished: boolean;
  updatedAt: string;
}

const CATEGORIES = ['GUIDE', 'FAQ', 'POLICY', 'COMPLIANCE', 'TROUBLESHOOTING'];
const MODULES = ['general', 'employees', 'attendance', 'leaves', 'payroll', 'invoices', 'clients', 'onboarding', 'documents'];

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 200);

const EMPTY = {
  id: '', slug: '', title: '', content: '', excerpt: '',
  module: 'general', category: 'GUIDE', tags: '', isPublished: true,
};

export default function KbManagePage() {
  const { data: session } = useSession();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ data: Article[] }>('/kb/articles?limit=100');
      setArticles(res.data);
    } catch (e: any) { setError(e?.message ?? 'Failed to load'); }
    finally { setLoading(false); }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm({ ...EMPTY }); setEditingId(null); setSlugTouched(false); setError(null); };
  const openEdit = async (a: Article) => {
    setError(null);
    try {
      const full = await apiFetch<Article>(`/kb/articles/${a.id}`);
      setForm({
        id: full.id, slug: full.slug, title: full.title, content: full.content ?? '',
        excerpt: full.excerpt ?? '', module: full.module, category: full.category,
        tags: (full.tags || []).join(', '), isPublished: full.isPublished,
      });
      setEditingId(full.id);
      setSlugTouched(true);
    } catch (e: any) { setError(e?.message ?? 'Failed to load article'); }
  };

  const setField = (k: string, v: any) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form) return;
    setSaving(true); setError(null);
    const payload = {
      slug: form.slug || slugify(form.title),
      title: form.title,
      content: form.content,
      excerpt: form.excerpt || undefined,
      module: form.module,
      category: form.category,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      isPublished: form.isPublished,
    };
    try {
      if (editingId) {
        await apiFetch(`/kb/articles/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/kb/articles', { method: 'POST', body: JSON.stringify(payload) });
      }
      setForm(null); setEditingId(null);
      await load();
    } catch (e: any) { setError(e?.message ?? 'Failed to save'); }
    finally { setSaving(false); }
  };

  const remove = async (a: Article) => {
    if (!confirm(`Delete article "${a.title}"?`)) return;
    try { await apiFetch(`/kb/articles/${a.id}`, { method: 'DELETE' }); await load(); }
    catch (e: any) { alert(e?.message ?? 'Failed to delete'); }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1100px] mx-auto space-y-6">
        <PageHeader
          title="Manage Knowledge Base"
          description="Create, edit and publish help articles for your team."
          breadcrumbs={[{ label: 'Knowledge Base', href: '/knowledge-base' }, { label: 'Manage' }]}
          actions={
            <div className="flex gap-2">
              <Link href="/knowledge-base"><Button variant="secondary" icon={<ArrowLeft size={15} />}>Back</Button></Link>
              {!form && <Button icon={<Plus size={15} />} onClick={openNew}>New Article</Button>}
            </div>
          }
        />

        {error && <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">{error}</div>}

        {form ? (
          <div className="rounded-lg border border-surface-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{editingId ? 'Edit Article' : 'New Article'}</h2>
              <Button variant="ghost" size="sm" icon={<X size={15} />} onClick={() => setForm(null)}>Cancel</Button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-content-secondary mb-1">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => { setField('title', e.target.value); if (!slugTouched) setField('slug', slugify(e.target.value)); }}
                  className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">Slug *</label>
                <input
                  value={form.slug}
                  onChange={(e) => { setSlugTouched(true); setField('slug', slugify(e.target.value)); }}
                  className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Module</label>
                  <select value={form.module} onChange={(e) => setField('module', e.target.value)}
                    className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm bg-white">
                    {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Category</label>
                  <select value={form.category} onChange={(e) => setField('category', e.target.value)}
                    className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm bg-white">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-content-secondary mb-1">Excerpt (short summary)</label>
                <input value={form.excerpt} onChange={(e) => setField('excerpt', e.target.value)}
                  className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="md:col-span-2 grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Content (Markdown) *</label>
                  <textarea value={form.content} onChange={(e) => setField('content', e.target.value)} rows={16}
                    className="w-full px-3 py-2 border border-surface-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <p className="text-xs text-content-tertiary mt-1">Supports Markdown: <code># Heading</code>, <code>**bold**</code>, <code>- list</code>, <code>[link](url)</code></p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-content-secondary mb-1">Preview</label>
                  <div className="border border-surface-200 rounded-lg p-3 bg-surface-50 min-h-[200px] text-sm text-content-secondary overflow-auto"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(form.content) }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-content-secondary mb-1">Tags (comma-separated)</label>
                <input value={form.tags} onChange={(e) => setField('tags', e.target.value)} placeholder="payroll, salary"
                  className="w-full px-3 py-2 border border-surface-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isPublished} onChange={(e) => setField('isPublished', e.target.checked)} />
                  Published (visible to everyone)
                </label>
              </div>
            </div>
            <div className="flex justify-end">
              <Button icon={<Save size={15} />} onClick={save} loading={saving}
                disabled={!form.title || !form.content || form.content.length < 10}>
                {editingId ? 'Save Changes' : 'Create Article'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-surface-200 bg-white divide-y divide-surface-100">
            {loading ? (
              <div className="p-6 text-content-tertiary text-sm">Loading…</div>
            ) : articles.length === 0 ? (
              <div className="p-6 text-content-tertiary text-sm">No articles yet. Click "New Article" to create one.</div>
            ) : articles.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-content-primary truncate">{a.title}</span>
                    <Badge variant={a.isPublished ? 'success' : 'default'}>{a.isPublished ? 'Published' : 'Draft'}</Badge>
                  </div>
                  <p className="text-xs text-content-tertiary">{a.module} · {a.category} · /{a.slug}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="xs" onClick={() => openEdit(a)}>Edit</Button>
                  <Button variant="ghost" size="xs" icon={<Trash2 size={14} />} className="text-danger hover:text-danger" onClick={() => remove(a)}>Delete</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
