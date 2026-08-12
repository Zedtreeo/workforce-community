'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '../../lib/auth-client';
import { apiFetch } from '../../lib/api';
import { DashboardLayout } from '../../components/dashboard-layout';
import {
  Button, Badge, Select, Pagination, PageSkeleton,
  DataTable, TableToolbar, PageHeader,
} from '../../components/ui';
import type { Column, SortState } from '../../components/ui';
import { Plus, Users, Eye, Pencil, CalendarClock } from 'lucide-react';

type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'TERMINATED';

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  designation?: string;
  status: EmployeeStatus;
  joinDate: string;
  salary: string;
  department?: { id: string; name: string } | null;
  shifts?: { id: string; shiftType: { id: string; name: string; code: string; startTime: string; endTime: string } }[];
  payStructureAssignments?: { id: string; template: { id: string; name: string }; ctcMonthly?: string }[];
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_OPTIONS = [
  { label: 'All Status', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
  { label: 'Terminated', value: 'TERMINATED' },
];

const STATUS_BADGE_MAP: Record<EmployeeStatus, 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  TERMINATED: 'danger',
};

const columns: Column<Employee>[] = [
  {
    key: 'name',
    header: 'Employee',
    sortable: true,
    render: (emp) => (
      <div>
        <p className="font-medium text-content-primary">
          {emp.firstName} {emp.lastName}
        </p>
        <p className="text-xs text-content-tertiary">{emp.email}</p>
      </div>
    ),
  },
  {
    key: 'employeeCode',
    header: 'Code',
    sortable: true,
    className: 'font-mono text-xs text-content-secondary',
  },
  {
    key: 'department',
    header: 'Department',
    render: (emp) => (
      <span className="text-content-secondary">{emp.department?.name ?? '—'}</span>
    ),
  },
  {
    key: 'designation',
    header: 'Designation',
    render: (emp) => (
      <span className="text-content-secondary">{emp.designation ?? '—'}</span>
    ),
  },
  {
    key: 'shift',
    header: 'Shift',
    render: (emp) => {
      const shift = emp.shifts?.[0];
      if (!shift) return <span className="text-content-tertiary text-xs">—</span>;
      return (
        <div>
          <p className="text-sm text-content-primary">{shift.shiftType.name}</p>
          <p className="text-xs text-content-tertiary">{shift.shiftType.startTime} – {shift.shiftType.endTime}</p>
        </div>
      );
    },
  },
  {
    key: 'payStructure',
    header: 'Pay Structure',
    render: (emp) => {
      const psa = emp.payStructureAssignments?.[0];
      if (!psa) return <span className="text-content-tertiary text-xs">—</span>;
      return (
        <div>
          <p className="text-sm text-content-primary">{psa.template.name}</p>
          {psa.ctcMonthly && (
            <p className="text-xs text-content-tertiary">₹{Number(psa.ctcMonthly).toLocaleString('en-IN')}/mo</p>
          )}
        </div>
      );
    },
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    render: (emp) => (
      <Badge variant={STATUS_BADGE_MAP[emp.status]} dot>
        {emp.status}
      </Badge>
    ),
  },
  {
    key: 'joinDate',
    header: 'Join Date',
    sortable: true,
    render: (emp) => (
      <span className="text-content-secondary">
        {new Date(emp.joinDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}
      </span>
    ),
  },
  {
    key: 'actions',
    header: '',
    headerClassName: 'text-right',
    className: 'text-right',
    render: (emp) => (
      <div className="flex items-center justify-end gap-1">
        <Link href={`/attendance/${emp.id}`}>
          <Button variant="ghost" size="xs" icon={<CalendarClock size={14} />}>Attendance</Button>
        </Link>
        <Link href={`/employees/${emp.id}`}>
          <Button variant="ghost" size="xs" icon={<Eye size={14} />}>View</Button>
        </Link>
        <Link href={`/employees/${emp.id}/edit`}>
          <Button variant="ghost" size="xs" icon={<Pencil size={14} />}>Edit</Button>
        </Link>
      </div>
    ),
  },
];

export default function EmployeesPage() {
  const { data: session } = useSession();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: 'name', direction: null });
  const limit = 10;

  const fetchEmployees = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);

      const res = await apiFetch<{ data: Employee[]; meta: Meta }>(
        `/employees?${params.toString()}`,
      );
      setEmployees(res.data);
      setMeta(res.meta);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  }, [session, page, search, statusFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

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
          title="Employees"
          description={meta ? `${meta.total} total employees` : 'Loading...'}
          breadcrumbs={[{ label: 'Employees' }]}
          actions={
            <Link href="/employees/new">
              <Button icon={<Plus size={16} />}>Add Employee</Button>
            </Link>
          }
        />

        {/* DataTable with integrated toolbar + pagination */}
        <DataTable<Employee>
          columns={columns}
          data={employees}
          rowKey={(emp) => emp.id}
          loading={loading}
          loadingRows={limit}
          sort={sort}
          onSortChange={setSort}
          emptyMessage={
            search || statusFilter
              ? 'No employees match your filters.'
              : 'No employees yet. Add your first employee to get started.'
          }
          emptyIcon={<Users />}
          toolbar={
            <TableToolbar
              search={search}
              onSearchChange={handleSearch}
              searchPlaceholder="Search by name, email, or code..."
            >
              <Select
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value)}
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
