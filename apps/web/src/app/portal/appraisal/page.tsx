'use client';

import { useEffect, useState } from 'react';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Card, Badge, Button, PageSkeleton, PageHeader, useToast } from '../../../components/ui';
import { TrendingUp, Star } from 'lucide-react';

interface Appraisal {
  id: string;
  cycleYear: number;
  cycleNumber: number;
  dueDate: string;
  status: string;
  selfRating: number | null;
  selfComments: string | null;
  selfSubmittedAt: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  DUE: 'Self-review pending',
  SELF_REVIEW: 'With your manager',
  MANAGER_REVIEW: 'With HR/Admin',
  PENDING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Approved',
  APPLIED: 'Applied',
};

export default function PortalAppraisalPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [appraisal, setAppraisal] = useState<Appraisal | null>(null);
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!session) return;
    setLoading(true);
    apiFetch<Appraisal | null>('/portal/appraisal')
      .then((a) => setAppraisal(a))
      .catch(() => setAppraisal(null))
      .finally(() => setLoading(false));
  };

  useEffect(load, [session]);

  const canSelfReview = appraisal && ['DUE', 'SELF_REVIEW'].includes(appraisal.status) && !appraisal.selfSubmittedAt;

  const submit = async () => {
    if (!appraisal || !rating) return;
    setSaving(true);
    try {
      await apiFetch(`/portal/appraisal/${appraisal.id}/self-review`, {
        method: 'POST',
        body: JSON.stringify({ selfRating: rating, selfComments: comments || undefined }),
      });
      toast('success', 'Self-review submitted');
      load();
    } catch (e: any) {
      toast('error', e?.message || 'Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <DashboardLayout><div className="p-4 md:p-6"><PageSkeleton /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <PageHeader title="My Appraisal" description="Your annual salary-review cycle." />

        {!appraisal ? (
          <Card>
            <div className="flex flex-col items-center text-center py-10 text-content-tertiary">
              <TrendingUp className="mb-3" />
              <p className="font-medium text-content-secondary">No appraisal open right now.</p>
              <p className="text-sm">Your cycle opens each year around your joining anniversary.</p>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-content-tertiary">Year {appraisal.cycleNumber} · Cycle {appraisal.cycleYear}</p>
                <p className="font-semibold text-content-primary">
                  Due {new Date(appraisal.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              <Badge variant={appraisal.status === 'APPLIED' ? 'success' : 'info'}>
                {STATUS_LABEL[appraisal.status] ?? appraisal.status}
              </Badge>
            </div>

            {appraisal.selfSubmittedAt ? (
              <div className="rounded-lg bg-surface-50 p-4">
                <p className="text-sm text-content-secondary mb-1">Your self-review</p>
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={18} className={n <= (appraisal.selfRating ?? 0) ? 'fill-amber-400 text-amber-400' : 'text-surface-300'} />
                  ))}
                </div>
                {appraisal.selfComments && <p className="text-sm text-content-secondary whitespace-pre-wrap">{appraisal.selfComments}</p>}
                <p className="text-xs text-content-tertiary mt-3">
                  Submitted {new Date(appraisal.selfSubmittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} — now with your manager.
                </p>
              </div>
            ) : canSelfReview ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-2">How do you rate your year?</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => setRating(n)} className="p-1">
                        <Star size={26} className={n <= rating ? 'fill-amber-400 text-amber-400' : 'text-surface-300 hover:text-amber-300'} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-content-secondary mb-1">Highlights & comments</label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={5}
                    placeholder="Key achievements this year, goals, anything you'd like considered…"
                    className="w-full rounded-lg border border-surface-200 bg-surface-0 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <Button onClick={submit} loading={saving} disabled={!rating}>Submit self-review</Button>
              </div>
            ) : (
              <p className="text-sm text-content-secondary">
                Your appraisal is in progress with HR. You'll be notified when your revised salary is applied.
              </p>
            )}
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
