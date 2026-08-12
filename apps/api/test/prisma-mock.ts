/**
 * Prisma mock factory for unit testing NestJS services.
 * Creates a deep mock of PrismaService with jest.fn() for every model method.
 */
import { PrismaService } from '../src/prisma';

type MockPrismaModel = {
  findMany: jest.Mock;
  findFirst: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  createMany: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  delete: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
  aggregate: jest.Mock;
  groupBy: jest.Mock;
  upsert: jest.Mock;
};

function createMockModel(): MockPrismaModel {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({}),
    groupBy: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockResolvedValue({}),
  };
}

/** All Prisma models in the HRMS schema */
const MODELS = [
  'tenant', 'user', 'session', 'account', 'verification',
  'employee', 'department', 'client', 'employeeAssignment',
  'invoice', 'invoiceLineItem', 'timeLog', 'activitySnapshot',
  'leaveType', 'leaveBalance', 'leaveRequest',
  'salaryStructure', 'payrollRun', 'payslip',
  'attendance', 'documentCategory', 'employeeDocument',
  'holiday', 'shiftType', 'employeeShift',
  'auditLog', 'notification', 'clientPortalUser', 'call',
  'tenantInvoiceSettings', 'billingEntity', 'accessProfile',
  'payHead', 'payStructureTemplate', 'payStructureComponent', 'payStructureAssignment',
  'appraisalCycle', 'appraisalSettings',
  'attendanceImportBatch', 'letterTemplate', 'generatedLetter',
] as const;

export type MockPrismaService = {
  [K in (typeof MODELS)[number]]: MockPrismaModel;
} & {
  $connect: jest.Mock;
  $disconnect: jest.Mock;
  $transaction: jest.Mock;
  $queryRawUnsafe: jest.Mock;
  $executeRawUnsafe: jest.Mock;
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
  excludeDeleted: jest.Mock;
};

/**
 * Create a fully mocked PrismaService for unit tests.
 * Usage:
 *   const prisma = createMockPrisma();
 *   prisma.employee.findMany.mockResolvedValue([...]);
 */
export function createMockPrisma(): MockPrismaService {
  const mock: any = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRawUnsafe: jest.fn().mockResolvedValue(undefined),
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue(undefined),
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn().mockImplementation((fn: any) => {
      if (typeof fn === 'function') return fn(mock);
      return Promise.all(fn);
    }),
    excludeDeleted: jest.fn().mockImplementation((where, includeDeleted = false) => {
      if (includeDeleted) return where;
      return { ...where, deletedAt: null };
    }),
  };

  for (const model of MODELS) {
    mock[model] = createMockModel();
  }

  return mock as MockPrismaService;
}

/**
 * Provider override for NestJS Testing module.
 * Usage:
 *   const module = await Test.createTestingModule({
 *     providers: [EmployeesService, mockPrismaProvider()],
 *   }).compile();
 */
export function mockPrismaProvider(mockInstance?: MockPrismaService) {
  return {
    provide: PrismaService,
    useValue: mockInstance ?? createMockPrisma(),
  };
}
