/**
 * Test fixtures — reusable fake data for all test suites.
 * Every fixture includes tenantId to validate multi-tenant isolation.
 */

export const TENANT_A = {
  id: 'tenant-aaa-111',
  name: 'Acme Staffing',
  domain: 'acme',
  currency: 'USD',
  timezone: 'America/New_York',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  deletedAt: null,
};

export const TENANT_B = {
  id: 'tenant-bbb-222',
  name: 'GlobalHire Inc',
  domain: 'globalhire',
  currency: 'EUR',
  timezone: 'Europe/London',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  deletedAt: null,
};

export const ADMIN_USER = {
  id: 'user-admin-001',
  tenantId: TENANT_A.id,
  email: 'admin@acme.com',
  name: 'Admin User',
  role: 'ADMIN',
  emailVerified: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  deletedAt: null,
};

export const MEMBER_USER = {
  id: 'user-member-001',
  tenantId: TENANT_A.id,
  email: 'john@acme.com',
  name: 'John Employee',
  role: 'MEMBER',
  emailVerified: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  deletedAt: null,
};

export const TENANT_B_USER = {
  id: 'user-b-001',
  tenantId: TENANT_B.id,
  email: 'bob@globalhire.com',
  name: 'Bob Manager',
  role: 'ADMIN',
  emailVerified: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  deletedAt: null,
};

export const DEPARTMENT = {
  id: 'dept-001',
  tenantId: TENANT_A.id,
  name: 'Engineering',
  description: 'Software Engineering',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  deletedAt: null,
};

export const EMPLOYEE = {
  id: 'emp-001',
  tenantId: TENANT_A.id,
  employeeCode: 'EMP001',
  firstName: 'Jane',
  lastName: 'Developer',
  email: 'jane@acme.com',
  phone: '+1234567890',
  departmentId: DEPARTMENT.id,
  designation: 'Senior Developer',
  status: 'ACTIVE' as const,
  joinDate: new Date('2025-02-01'),
  salary: 75000,
  currency: 'USD',
  createdBy: ADMIN_USER.id,
  updatedBy: ADMIN_USER.id,
  createdAt: new Date('2025-02-01'),
  updatedAt: new Date('2025-02-01'),
  deletedAt: null,
  department: DEPARTMENT,
};

export const EMPLOYEE_TENANT_B = {
  id: 'emp-b-001',
  tenantId: TENANT_B.id,
  employeeCode: 'GH001',
  firstName: 'Alice',
  lastName: 'Remote',
  email: 'alice@globalhire.com',
  phone: '+4400000000',
  departmentId: null,
  designation: 'Designer',
  status: 'ACTIVE' as const,
  joinDate: new Date('2025-03-01'),
  salary: 60000,
  currency: 'EUR',
  createdBy: TENANT_B_USER.id,
  updatedBy: TENANT_B_USER.id,
  createdAt: new Date('2025-03-01'),
  updatedAt: new Date('2025-03-01'),
  deletedAt: null,
};

export const CLIENT = {
  id: 'client-001',
  tenantId: TENANT_A.id,
  name: 'TechCorp',
  contactPerson: 'Sarah Manager',
  email: 'sarah@techcorp.com',
  phone: '+1987654321',
  address: '123 Tech St',
  currency: 'USD',
  billingRate: 50,
  status: 'ACTIVE' as const,
  createdAt: new Date('2025-01-15'),
  updatedAt: new Date('2025-01-15'),
  deletedAt: null,
};

export const INVOICE = {
  id: 'inv-001',
  tenantId: TENANT_A.id,
  clientId: CLIENT.id,
  invoiceNumber: 'INV-2025-001',
  issueDate: new Date('2025-03-01'),
  dueDate: new Date('2025-03-31'),
  subtotal: 5000,
  tax: 500,
  total: 5500,
  status: 'SENT' as const,
  currency: 'USD',
  createdAt: new Date('2025-03-01'),
  updatedAt: new Date('2025-03-01'),
  deletedAt: null,
  client: CLIENT,
};

export const ATTENDANCE = {
  id: 'att-001',
  tenantId: TENANT_A.id,
  employeeId: EMPLOYEE.id,
  date: new Date('2025-03-10'),
  checkIn: new Date('2025-03-10T09:00:00Z'),
  checkOut: new Date('2025-03-10T18:00:00Z'),
  totalHours: 9,
  status: 'PRESENT' as const,
  createdAt: new Date('2025-03-10'),
  updatedAt: new Date('2025-03-10'),
};

export const LEAVE_REQUEST = {
  id: 'leave-001',
  tenantId: TENANT_A.id,
  employeeId: EMPLOYEE.id,
  leaveTypeId: 'lt-001',
  startDate: new Date('2025-04-01'),
  endDate: new Date('2025-04-03'),
  days: 3,
  reason: 'Family vacation',
  status: 'PENDING' as const,
  createdAt: new Date('2025-03-20'),
  updatedAt: new Date('2025-03-20'),
};

/** Helper to create pagination meta */
export function paginated<T>(data: T[], total?: number, page = 1, limit = 20) {
  const count = total ?? data.length;
  return {
    data,
    meta: {
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
}
