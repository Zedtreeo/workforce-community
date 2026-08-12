'use client';

import Link from 'next/link';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { ClientForm } from '../../../components/client-form';
import { Card } from '../../../components/ui';

export default function NewClientPage() {
  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="max-w-3xl">
          <div className="mb-6">
            <Link
              href="/clients"
              className="text-sm text-content-tertiary hover:text-content-secondary inline-block mb-1"
            >
              ← Back to Clients
            </Link>
            <h1 className="text-2xl font-bold text-content-primary">Add Client</h1>
            <p className="text-sm text-content-tertiary mt-1">
              Create a new client for billing and assignments.
            </p>
          </div>

          <Card>
            <ClientForm mode="create" />
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
