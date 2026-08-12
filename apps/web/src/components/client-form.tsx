'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../lib/api';

export interface ClientFormData {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  currency: string;
  billingEmail: string;
  payoneerEmail: string;
  website: string;
  registeredAddress: string;
  signatoryName: string;
  contactNumber: string;
  billingEntityId: string;
  isActive: boolean;
}

interface BillingEntity { id: string; name: string; invoicePrefix: string; isDefault: boolean; isActive: boolean }

const EMPTY_FORM: ClientFormData = {
  name: '',
  firstName: '',
  lastName: '',
  email: '',
  country: 'US',
  currency: 'USD',
  billingEmail: '',
  payoneerEmail: '',
  website: '',
  registeredAddress: '',
  signatoryName: '',
  contactNumber: '',
  billingEntityId: '',
  isActive: true,
};

// Remote staffing target markets
const COUNTRY_OPTIONS = [
  { code: 'US', label: 'United States', currency: 'USD' },
  { code: 'CA', label: 'Canada', currency: 'CAD' },
  { code: 'GB', label: 'United Kingdom', currency: 'GBP' },
  { code: 'AU', label: 'Australia', currency: 'AUD' },
  { code: 'NZ', label: 'New Zealand', currency: 'NZD' },
  { code: 'DE', label: 'Germany', currency: 'EUR' },
  { code: 'FR', label: 'France', currency: 'EUR' },
  { code: 'NL', label: 'Netherlands', currency: 'EUR' },
  { code: 'IE', label: 'Ireland', currency: 'EUR' },
  { code: 'AE', label: 'UAE', currency: 'AED' },
  { code: 'SA', label: 'Saudi Arabia', currency: 'SAR' },
  { code: 'SG', label: 'Singapore', currency: 'SGD' },
  { code: 'IN', label: 'India', currency: 'INR' },
];

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'AED', 'SAR', 'SGD', 'INR'];

interface Props {
  mode: 'create' | 'edit';
  clientId?: string;
  initialData?: Partial<ClientFormData>;
}

export function ClientForm({ mode, clientId, initialData }: Props) {
  const router = useRouter();
  const [formData, setFormData] = useState<ClientFormData>({
    ...EMPTY_FORM,
    ...initialData,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entities, setEntities] = useState<BillingEntity[]>([]);

  useEffect(() => {
    apiFetch<BillingEntity[]>('/invoices/billing-entities')
      .then((e) => setEntities(e.filter((x) => x.isActive)))
      .catch(() => {});
  }, []);

  const updateField = <K extends keyof ClientFormData>(key: K, value: ClientFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleCountryChange = (code: string) => {
    const match = COUNTRY_OPTIONS.find((c) => c.code === code);
    setFormData((prev) => ({
      ...prev,
      country: code,
      currency: match?.currency ?? prev.currency,
    }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        name: formData.name.trim(),
        firstName: formData.firstName.trim() || undefined,
        lastName: formData.lastName.trim() || undefined,
        email: formData.email.trim(),
        country: formData.country.toUpperCase(),
        currency: formData.currency.toUpperCase(),
        billingEmail: formData.billingEmail.trim() || undefined,
        payoneerEmail: formData.payoneerEmail.trim() || undefined,
        website: formData.website.trim() || undefined,
        registeredAddress: formData.registeredAddress.trim() || undefined,
        signatoryName: formData.signatoryName.trim() || undefined,
        contactNumber: formData.contactNumber.trim() || undefined,
        billingEntityId: formData.billingEntityId || null,
        isActive: formData.isActive,
      };

      if (mode === 'create') {
        const created = await apiFetch<{ id: string }>('/clients', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        router.push(`/clients/${created.id}`);
      } else if (clientId) {
        await apiFetch(`/clients/${clientId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        router.push(`/clients/${clientId}`);
      }
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Company Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Company Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Acme Corp Pty Ltd"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Contact First Name</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => updateField('firstName', e.target.value)}
              placeholder="James"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Contact Last Name</label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => updateField('lastName', e.target.value)}
              placeholder="Jordan"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Primary Email *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="ops@acme.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Country *</label>
            <select
              required
              value={formData.country}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {COUNTRY_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label} ({opt.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Billing</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Currency *</label>
            <select
              required
              value={formData.currency}
              onChange={(e) => updateField('currency', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Billing Email</label>
            <input
              type="email"
              value={formData.billingEmail}
              onChange={(e) => updateField('billingEmail', e.target.value)}
              placeholder="ap@acme.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Payoneer Email</label>
            <input
              type="email"
              value={formData.payoneerEmail}
              onChange={(e) => updateField('payoneerEmail', e.target.value)}
              placeholder="Used to auto-fill invoice payment instructions"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Will be pre-filled on invoices for this client.
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Agreement Details</h3>
        <p className="text-xs text-gray-500 mb-3">Used to auto-fill the Service Agreement sent to this client.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Website</label>
            <input
              type="text"
              value={formData.website}
              onChange={(e) => updateField('website', e.target.value)}
              placeholder="www.acme.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Authorized Signatory</label>
            <input
              type="text"
              value={formData.signatoryName}
              onChange={(e) => updateField('signatoryName', e.target.value)}
              placeholder="James Jordan"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Contact Number</label>
            <input
              type="text"
              value={formData.contactNumber}
              onChange={(e) => updateField('contactNumber', e.target.value)}
              placeholder="+1 713-731-7992"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Registered Address &amp; Country</label>
            <textarea
              rows={2}
              value={formData.registeredAddress}
              onChange={(e) => updateField('registeredAddress', e.target.value)}
              placeholder="P.O. Box 34506, Houston, TX 77234, USA"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          {entities.length > 1 && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Billed by (company)</label>
              <select
                value={formData.billingEntityId}
                onChange={(e) => updateField('billingEntityId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">Default company{entities.find((e) => e.isDefault) ? ` (${entities.find((e) => e.isDefault)!.name})` : ''}</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.invoicePrefix})</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">New invoices for this client are issued under this company and its number series.</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="isActive"
          type="checkbox"
          checked={formData.isActive}
          onChange={(e) => updateField('isActive', e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="isActive" className="text-sm text-gray-700">
          Client is active (can be assigned employees)
        </label>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {submitting ? 'Saving...' : mode === 'create' ? 'Create Client' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
