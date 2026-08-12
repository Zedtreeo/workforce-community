/**
 * HRMS Database Seed Script
 *
 * Creates a demo tenant with sample data for:
 * - Admin user + employee users
 * - Departments, employees, clients
 * - Attendance records, leave types, holidays
 * - Sample invoices and salary structures
 *
 * Usage:
 *   npx prisma db seed
 *   npx tsx prisma/seed.ts
 *
 * Idempotent: safe to run multiple times (upserts by unique keys).
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding HRMS database...\n');

  // ── 1. Demo Tenant ──────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-company' },
    update: {},
    create: {
      name: 'Demo Company Ltd',
      slug: 'demo-company',
      plan: 'PROFESSIONAL',
      currency: 'USD',
      timezone: 'America/New_York',
    },
  });
  console.log(`  Tenant: ${tenant.name} (${tenant.id})`);

  // ── 2. Admin User ───────────────────────────────────
  const hashedPassword = await bcrypt.hash('Admin@123', 12);
  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@demo.com',
      name: 'Demo Admin',
      role: 'ADMIN',
      emailVerified: true,
    },
  });
  console.log(`  Admin: ${adminUser.email}`);

  // ── 3. Departments ──────────────────────────────────
  const departments = ['Engineering', 'Human Resources', 'Sales', 'Marketing', 'Finance'];
  const createdDepts: Record<string, any> = {};

  for (const name of departments) {
    const code = name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase();
    const dept = await prisma.department.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: {},
      create: { tenantId: tenant.id, name, code },
    });
    createdDepts[name] = dept;
  }
  console.log(`  Departments: ${departments.length} created`);

  // ── 4. Employees ────────────────────────────────────
  const employees = [
    { name: 'Sarah Johnson', email: 'sarah@demo.com', dept: 'Engineering', designation: 'Senior Developer', salary: 85000 },
    { name: 'Michael Chen', email: 'michael@demo.com', dept: 'Engineering', designation: 'Full Stack Developer', salary: 72000 },
    { name: 'Emily Davis', email: 'emily@demo.com', dept: 'Human Resources', designation: 'HR Manager', salary: 68000 },
    { name: 'James Wilson', email: 'james@demo.com', dept: 'Sales', designation: 'Sales Lead', salary: 75000 },
    { name: 'Priya Sharma', email: 'priya@demo.com', dept: 'Marketing', designation: 'Marketing Specialist', salary: 62000 },
    { name: 'Robert Taylor', email: 'robert@demo.com', dept: 'Finance', designation: 'Financial Analyst', salary: 70000 },
    { name: 'Lisa Anderson', email: 'lisa@demo.com', dept: 'Engineering', designation: 'QA Engineer', salary: 65000 },
    { name: 'David Martinez', email: 'david@demo.com', dept: 'Sales', designation: 'Account Executive', salary: 68000 },
  ];

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const [firstName, ...rest] = emp.name.split(' ');
    await prisma.employee.upsert({
      where: {
        tenantId_email: { tenantId: tenant.id, email: emp.email },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        employeeCode: `EMP${String(i + 1).padStart(3, '0')}`,
        firstName,
        lastName: rest.join(' ') || '-',
        email: emp.email,
        departmentId: createdDepts[emp.dept].id,
        designation: emp.designation,
        status: 'ACTIVE',
        joinDate: new Date('2024-01-15'),
        salary: emp.salary,
      },
    });
  }
  console.log(`  Employees: ${employees.length} created`);

  // ── 5. Clients ──────────────────────────────────────
  const clients = [
    { name: 'Acme Corporation', email: 'contact@acme.com', country: 'United States' },
    { name: 'GlobalTech Solutions', email: 'hr@globaltech.com', country: 'United Kingdom' },
    { name: 'Pacific Innovations', email: 'team@pacific.au', country: 'Australia' },
  ];

  for (const client of clients) {
    await prisma.client.upsert({
      where: {
        tenantId_email: { tenantId: tenant.id, email: client.email },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        name: client.name,
        email: client.email,
        country: client.country,
      },
    });
  }
  console.log(`  Clients: ${clients.length} created`);

  // ── 6. Leave Types ──────────────────────────────────
  const leaveTypes = [
    { name: 'Annual Leave', code: 'AL', defaultDays: 20, isPaid: true },
    { name: 'Sick Leave', code: 'SL', defaultDays: 12, isPaid: true },
    { name: 'Personal Leave', code: 'PL', defaultDays: 5, isPaid: true },
    { name: 'Unpaid Leave', code: 'UL', defaultDays: 30, isPaid: false },
  ];

  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: {
        tenantId_code: { tenantId: tenant.id, code: lt.code },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        name: lt.name,
        code: lt.code,
        defaultDays: lt.defaultDays,
        isPaid: lt.isPaid,
      },
    });
  }
  console.log(`  Leave Types: ${leaveTypes.length} created`);

  // ── 7. Holidays (current year) ──────────────────────
  const year = new Date().getFullYear();
  const holidays = [
    { name: "New Year's Day", date: `${year}-01-01` },
    { name: 'Martin Luther King Jr. Day', date: `${year}-01-20` },
    { name: 'Presidents Day', date: `${year}-02-17` },
    { name: 'Memorial Day', date: `${year}-05-26` },
    { name: 'Independence Day', date: `${year}-07-04` },
    { name: 'Labor Day', date: `${year}-09-01` },
    { name: 'Thanksgiving', date: `${year}-11-27` },
    { name: 'Christmas Day', date: `${year}-12-25` },
  ];

  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: {
        tenantId_date: { tenantId: tenant.id, date: new Date(h.date) },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        name: h.name,
        date: new Date(h.date),
        year,
      },
    });
  }
  console.log(`  Holidays: ${holidays.length} created`);

  // ── 8. Document Categories ──────────────────────────
  const docCategories = [
    { name: 'ID Proof', code: 'ID' },
    { name: 'Address Proof', code: 'ADDR' },
    { name: 'Educational', code: 'EDU' },
    { name: 'Work Experience', code: 'EXP' },
    { name: 'Contract', code: 'CONTRACT' },
    { name: 'Visa / Work Permit', code: 'VISA' },
  ];
  for (const dc of docCategories) {
    await prisma.documentCategory.upsert({
      where: {
        tenantId_code: { tenantId: tenant.id, code: dc.code },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        name: dc.name,
        code: dc.code,
      },
    });
  }
  console.log(`  Document Categories: ${docCategories.length} created`);

  console.log('\nSeed completed successfully.');
  console.log('\n  Sign in at the web app (http://localhost:3000):');
  console.log('  Email: admin@demo.com  — a one-time code is emailed;');
  console.log('  with the bundled Mailpit, read it at http://localhost:8025\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
