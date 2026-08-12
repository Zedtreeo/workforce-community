'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '../../../../lib/api';
import { DashboardLayout } from '../../../../components/dashboard-layout';
import { ClientForm, ClientFormData } from '../../../../components/client-form';
import { Card, PageSkeleton } from '../../../../components/ui';

export default function EditClientPage() {
  const params = useParams();
  const id = params?.id as string;
  const [initial, setInitial] = useState<Partial<ClientFormData> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<any>(`/clients/${id}`);
        setInitial({
          name: data.name ?? '',
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          email: data.email ?? '',
          country: data.country ?? 'US',
          currency: data.currency ?? 'USD',
          billingEmail: data.billingEmail ?? '',
          payoneerEmail: data.payoneerEmail ?? '',
          website: data.website ?? '',
          registeredAddress: data.registeredAddress ?? '',
          signatoryName: data.signatoryName ?? '',
          contactNumber: data.contactNumber ?? '',
          billingEntityId: data.billingEntityId ?? '',
          isActive: data.isActive ?? true,
        });
      } catch (err) {
        console.error('Failed to load client:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="max-w-3xl">
          <div className="mb-6">
            <Link
              href={`/clients/${id}`}
              className="text-sm text-content-tertiary hover:text-content-secondary inline-block mb-1"
            >
              ← Back to Client
            </Link>
            <h1 className="text-2xl font-bold text-content-primary">Edit Client</h1>
          </div>

          {loading ? (
            <PageSkeleton />
          ) : initial ? (
            <Card>
              <ClientForm mode="edit" clientId={id} initialData={initial} />
            </Card>
          ) : (
            <Card>
              <div className="text-center py-8 text-danger-dark">
                Client not found.
              </div>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
