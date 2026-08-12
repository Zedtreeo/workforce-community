'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { EmployeeMonthlyAttendance } from '../../../components/attendance/employee-monthly-attendance';

export default function EmployeeAttendancePage() {
  const params = useParams();
  const employeeId = params.employeeId as string;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
        <Link href="/attendance" className="text-sm text-content-tertiary hover:text-content-secondary">
          ← Back to Attendance
        </Link>
        <EmployeeMonthlyAttendance employeeId={employeeId} />
      </div>
    </DashboardLayout>
  );
}
