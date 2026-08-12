'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { API_BASE } from '../../../lib/api';

type Step = 'loading' | 'create-account' | 'accept-offer' | 'details' | 'documents' | 'complete' | 'error' | 'done';

interface OnboardingData {
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  onboardingStatus: string;
  companyName: string;
  companyLogo: string | null;
  offerLetter: any;
}

interface DocCategory {
  id: string;
  name: string;
  code: string;
  isRequired: boolean;
  document: any | null;
}

async function apiFetchPublic<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `Error: ${res.status}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export default function OnboardingWizardPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [step, setStep] = useState<Step>('loading');
  const [data, setData] = useState<OnboardingData | null>(null);
  const [error, setError] = useState('');

  // Step states
  const [details, setDetails] = useState({
    firstName: '', lastName: '', phone: '', designation: '',
    pfNumber: '', esiNumber: '', panNumber: '', bankAccount: '', bankIfsc: '', bankName: '', bankBranch: '',
  });
  const [docs, setDocs] = useState<DocCategory[]>([]);
  const [uploading, setUploading] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signedFile, setSignedFile] = useState<File | null>(null);

  useEffect(() => {
    loadOnboarding();
  }, [token]);

  const loadOnboarding = async () => {
    try {
      const res = await apiFetchPublic<OnboardingData>(`/onboarding/invite/${token}`);
      setData(res);
      setDetails(prev => ({
        ...prev,
        firstName: res.firstName || '',
        lastName: res.lastName || '',
      }));

      // Determine step from onboarding status
      switch (res.onboardingStatus) {
        case 'INVITED': setStep('create-account'); break;
        case 'OFFER_PENDING': setStep('accept-offer'); break;
        case 'DETAILS_PENDING': setStep('details'); break;
        case 'DOCUMENTS_PENDING': setStep('documents'); loadDocs(); break;
        case 'COMPLETED': setStep('done'); break;
        default: setStep('create-account');
      }
    } catch (err: any) {
      setError(err.message);
      setStep('error');
    }
  };

  const loadDocs = async () => {
    try {
      const res = await apiFetchPublic<DocCategory[]>(`/onboarding/invite/${token}/documents`);
      setDocs(res);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      // No password — sign-in is via one-time email code (OTP) after HR approval.
      await apiFetchPublic(`/onboarding/invite/${token}/create-account`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setStep('accept-offer');
      // Re-fetch to get updated status
      const res = await apiFetchPublic<OnboardingData>(`/onboarding/invite/${token}`);
      setData(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptOffer = async () => {
    setError('');
    setSubmitting(true);
    try {
      await apiFetchPublic(`/onboarding/invite/${token}/accept-offer`, { method: 'POST' });
      setStep('details');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadSignedOffer = async () => {
    if (!signedFile) return;
    setError('');
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', signedFile);
      const res = await fetch(`${API_BASE}/onboarding/invite/${token}/signed-offer`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(err.message);
      }
      setSignedFile(null);
      setStep('details');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiFetchPublic(`/onboarding/invite/${token}/details`, {
        method: 'PATCH',
        body: JSON.stringify(details),
      });
      setStep('documents');
      loadDocs();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadDoc = async (categoryCode: string, file: File) => {
    setUploading(categoryCode);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('categoryCode', categoryCode);

      const res = await fetch(`${API_BASE}/onboarding/invite/${token}/documents`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(err.message);
      }
      loadDocs();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading('');
    }
  };

  const handleComplete = async () => {
    setError('');
    setSubmitting(true);
    try {
      await apiFetchPublic(`/onboarding/invite/${token}/complete`, { method: 'POST' });
      setStep('done');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDetails(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const steps: { key: Step; label: string }[] = [
    { key: 'create-account', label: 'Get Started' },
    { key: 'accept-offer', label: 'Offer Letter' },
    { key: 'details', label: 'Personal Details' },
    { key: 'documents', label: 'Documents' },
    { key: 'complete', label: 'Complete' },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invite Link Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-green-500 text-5xl mb-4">&#10003;</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Application Submitted</h2>
          <p className="text-gray-600 mb-6">
            Thanks {data?.firstName}! Your onboarding details have been submitted to our HR team for review. You will receive an email once your account is approved and you can log in.
          </p>
          <button onClick={() => router.push('/login')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            {data?.companyName?.[0] || 'C'}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{data?.companyName}</h1>
            <p className="text-xs text-gray-500">Employee Onboarding</p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                i < currentStepIndex ? 'bg-green-500 text-white' :
                i === currentStepIndex ? 'bg-blue-600 text-white' :
                'bg-gray-200 text-gray-500'
              }`}>
                {i < currentStepIndex ? '✓' : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${
                i === currentStepIndex ? 'text-blue-600 font-medium' : 'text-gray-400'
              }`}>{s.label}</span>
              {i < steps.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto p-4 md:p-8">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        {/* Step 1: Get Started */}
        {step === 'create-account' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome, {data?.firstName}!</h2>
            <p className="text-gray-500 mb-6">Let’s get your onboarding started.</p>

            <form onSubmit={handleCreateAccount} className="space-y-4 max-w-sm">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={data?.email || ''} disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm" />
              </div>
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
                No password needed — once HR approves you, you’ll sign in with a one-time code (OTP) sent to this email.
              </p>
              <button type="submit" disabled={submitting}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium">
                {submitting ? 'Please wait…' : 'Get Started'}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Accept Offer */}
        {step === 'accept-offer' && data?.offerLetter && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Your Offer Letter</h2>
            <p className="text-gray-500 mb-6">Please review your offer details and accept to continue.</p>

            <div className="bg-gray-50 rounded-lg p-6 mb-6 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Designation</p>
                  <p className="text-sm font-medium text-gray-900">{data.offerLetter.designation}</p>
                </div>
                {data.offerLetter.department && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Department</p>
                    <p className="text-sm font-medium text-gray-900">{data.offerLetter.department}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Monthly Salary (CTC)</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(data.offerLetter.salary))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Joining Date</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(data.offerLetter.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Probation Period</p>
                  <p className="text-sm font-medium text-gray-900">{data.offerLetter.probationMonths} months</p>
                </div>
                {data.offerLetter.workLocation && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Work Location</p>
                    <p className="text-sm font-medium text-gray-900">{data.offerLetter.workLocation}</p>
                  </div>
                )}
                {data.offerLetter.reportingTo && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Reporting To</p>
                    <p className="text-sm font-medium text-gray-900">{data.offerLetter.reportingTo}</p>
                  </div>
                )}
                {data.offerLetter.workSchedule && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Work Schedule</p>
                    <p className="text-sm font-medium text-gray-900">{data.offerLetter.workSchedule}</p>
                  </div>
                )}
              </div>
              {data.offerLetter.benefits && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Benefits</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.offerLetter.benefits}</p>
                </div>
              )}
              {data.offerLetter.terms && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Terms & Conditions</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.offerLetter.terms}</p>
                </div>
              )}
            </div>

            {/* Sign flow: download → sign → upload */}
            <div className="rounded-lg border border-gray-200 bg-white p-5 mb-4">
              <p className="text-sm font-medium text-gray-900 mb-1">Sign your offer letter</p>
              <p className="text-sm text-gray-500 mb-4">Download the offer letter, sign it, then upload the signed PDF to accept.</p>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`${API_BASE}/onboarding/invite/${token}/offer-letter`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  ⬇ Download Offer Letter
                </a>
                <label className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
                  {signedFile ? '✓ ' + signedFile.name : '⬆ Choose Signed PDF'}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => setSignedFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button onClick={handleUploadSignedOffer} disabled={submitting || !signedFile}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium">
                {submitting ? 'Uploading...' : 'Upload Signed Offer & Continue'}
              </button>
              <button onClick={handleAcceptOffer} disabled={submitting}
                className="text-sm text-gray-500 hover:text-gray-700 underline disabled:opacity-50">
                Accept without uploading
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Personal Details */}
        {step === 'details' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Personal Details</h2>
            <p className="text-gray-500 mb-6">Please fill in your personal and banking details.</p>

            <form onSubmit={handleSubmitDetails} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input name="firstName" value={details.firstName} onChange={handleDetailsChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input name="lastName" value={details.lastName} onChange={handleDetailsChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input name="phone" value={details.phone} onChange={handleDetailsChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
                  <input name="panNumber" value={details.panNumber} onChange={handleDetailsChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="ABCDE1234F" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PF Number</label>
                  <input name="pfNumber" value={details.pfNumber} onChange={handleDetailsChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ESI Number</label>
                  <input name="esiNumber" value={details.esiNumber} onChange={handleDetailsChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account Number</label>
                  <input name="bankAccount" value={details.bankAccount} onChange={handleDetailsChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank IFSC Code</label>
                  <input name="bankIfsc" value={details.bankIfsc} onChange={handleDetailsChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input name="bankName" value={details.bankName} onChange={handleDetailsChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Branch</label>
                  <input name="bankBranch" value={details.bankBranch} onChange={handleDetailsChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <button type="submit" disabled={submitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium">
                {submitting ? 'Saving...' : 'Save Details & Continue'}
              </button>
            </form>
          </div>
        )}

        {/* Step 4: Documents */}
        {step === 'documents' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Upload Documents</h2>
            <p className="text-gray-500 mb-6">Upload the required documents. Accepted formats: PDF, PNG, JPG (max 5MB).</p>

            <div className="space-y-4 mb-6">
              {docs.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {cat.name}
                      {cat.isRequired && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    {cat.document ? (
                      <p className="text-xs text-green-600 mt-1">
                        Uploaded: {cat.document.fileName}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">Not uploaded</p>
                    )}
                  </div>
                  <div>
                    <label className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                      uploading === cat.code ? 'bg-gray-100 text-gray-400' :
                      cat.document ? 'bg-green-50 text-green-700 hover:bg-green-100' :
                      'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}>
                      {uploading === cat.code ? 'Uploading...' : cat.document ? 'Replace' : 'Upload'}
                      <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp"
                        disabled={uploading === cat.code}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadDoc(cat.code, file);
                          e.target.value = '';
                        }} />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={handleComplete} disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors text-sm font-medium">
              {submitting ? 'Completing...' : 'Complete Onboarding'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

