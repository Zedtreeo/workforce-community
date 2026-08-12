'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from '../../lib/auth-client';
import { apiFetch } from '../../lib/api';
import { DashboardLayout } from '../../components/dashboard-layout';
import {
  Button, Badge, Select, Pagination, PageSkeleton,
  DataTable, TableToolbar, PageHeader,
} from '../../components/ui';
import type { Column } from '../../components/ui';
import { Plus, Briefcase, Eye, Pencil } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  email?: string;
  country: string;
  currency: string;
  billingEmail?: string;
  payoneerEmail?: string;
  isActive: boolean;
  createdAt: string;
  billingEntityId?: string | null;
  billingEntity?: { id: string; name: string; invoicePrefix: string } | null;
  _count?: { assignments: number };
}

interface BillingEntity { id: string; name: string; invoicePrefix: string; isDefault: boolean; isActive: boolean }

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const ACTIVE_OPTIONS = [
  { label: 'All Clients', value: '' },
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
];

const columns: Column<Client>[] = [
  {
    key: 'name',
    header: 'Client',
    sortable: true,
    render: (c) => (
      <div>
        <p className="font-medium text-content-primary">{c.name}</p>
        <p className="text-xs text-content-tertiary">{c.email ?? '—'}</p>
      </div>
    ),
  },
  {
    key: 'country',
    header: 'Country',
    sortable: true,
    className: 'font-mono text-xs text-content-secondary uppercase',
  },
  {
    key: 'currency',
    header: 'Currency',
    className: 'font-mono text-xs text-content-secondary',
  },
  {
    key: 'assignments',
    header: 'Assignments',
    render: (c) => <Badge variant="brand">{c._count?.assignments ?? 0}</Badge>,
  },
  {
    key: 'isActive',
    header: 'Status',
    render: (c) => (
      <Badge variant={c.isActive ? 'success' : 'default'} dot>
        {c.isActive ? 'Active' : 'Inactive'}
      </Badge>
    ),
  },
  {
    key: 'actions',
    header: '',
    headerClassName: 'text-right',
    className: 'text-right',
    render: (c) => (
      <div className="flex items-center justify-end gap-1">
        <Link href={`/clients/${c.id}`}>
          <Button variant="ghost" size="xs" icon={<Eye size={14} />}>View</Button>
        </Link>
        <Link href={`/clients/${c.id}/edit`}>
          <Button variant="ghost" size="xs" icon={<Pencil size={14} />}>Edit</Button>
        </Link>
      </div>
    ),
  },
];

export default function ClientsPage() {
  const { data: session } = useSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [entities, setEntities] = useState<BillingEntity[]>([]);
  const limit = 10;

  useEffect(() => {
    apiFetch<BillingEntity[]>('/invoices/billing-entities')
      .then((e) => setEntities(e))
      .catch(() => {});
  }, []);

  const defaultEntityName = entities.find((e) => e.isDefault)?.name ?? null;

  // Insert a "Company" column (which entity invoices each client) when >1 exists.
  const displayColumns = useMemo<Column<Client>[]>(() => {
    if (entities.length <= 1) return columns;
    const companyCol: Column<Client> = {
      key: 'company',
      header: 'Company',
      render: (c) => c.billingEntity
        ? <span className="text-sm text-content-primary">{c.billingEntity.name}</span>
        : <span className="text-sm text-content-tertiary">{defaultEntityName ?? '—'}</span>,
    };
    return [columns[0], companyCol, ...columns.slice(1)];
  }, [entities.length, defaultEntityName]);

  const fetchClients = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (activeFilter) params.set('isActive', activeFilter);

      const res = await apiFetch<{ data: Client[]; meta: Meta }>(
        `/clients?${params.toString()}`,
      );
      setClients(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoading(false);
    }
  }, [session, page, search, activeFilter]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  if (loading && !meta) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-6"><PageSkeleton /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Clients"
          description={meta ? `${meta.total} total clients` : 'Loading...'}
          breadcrumbs={[{ label: 'Clients' }]}
          actions={
            <Link href="/clients/new">
              <Button icon={<Plus size={16} />}>Add Client</Button>
            </Link>
          }
        />

        <DataTable<Client>
          columns={displayColumns}
          data={clients}
          rowKey={(c) => c.id}
          loading={loading}
          loadingRows={limit}
          emptyMessage={
            search || activeFilter
              ? 'No clients match your filters.'
              : 'No clients yet. Add your first client to start billing.'
          }
          emptyIcon={<Briefcase />}
          toolbar={
            <TableToolbar
              search={search}
              onSearchChange={(v) => { setSearch(v); setPage(1); }}
              searchPlaceholder="Search by name or email..."
            >
              <Select
                options={ACTIVE_OPTIONS}
                value={activeFilter}
                onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
              />
            </TableToolbar>
          }
          pagination={
            meta && (
              <Pagination
                page={page}
                totalPages={meta.totalPages}
                total={meta.total}
                onPageChange={setPage}
              />
            )
          }
        />
      </div>
    </DashboardLayout>
  );
}
