'use client';

import { DashboardLayout } from '../../../components/dashboard-layout';
import { EmployeeForm } from '../../../components/employee-form';
import { Card } from '../../../components/ui';

export default function NewEmployeePage() {
  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-content-primary mb-6">Add New Employee</h1>
        <Card>
          <EmployeeForm mode="create" />
        </Card>
      </div>
    </DashboardLayout>
  );
}
