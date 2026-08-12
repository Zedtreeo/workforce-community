// apps/web/src/app/attendance/_components/AttendanceImportModal.tsx
'use client';

import { useState } from 'react';
import { Modal } from '../../../components/ui/modal';
import { Button } from '../../../components/ui';
import { Download, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { API_BASE, apiUpload } from '../../../lib/api';

type Step = 'download' | 'upload' | 'review' | 'committed';

interface ImportRowError {
  row: number;
  employee_email?: string;
  date?: string;
  message: string;
}

interface BatchResponse {
  batchId: string;
  status: 'PENDING' | 'COMMITTED' | 'FAILED';
  dryRun: boolean;
  rowCount: number;
  successCount: number;
  errorCount: number;
  errors: ImportRowError[];
}

export function AttendanceImportModal({
  open,
  onClose,
  onCommitted,
}: {
  open: boolean;
  onClose: () => void;
  onCommitted?: () => void;
}) {
  const [step, setStep] = useState<Step>('download');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [batch, setBatch] = useState<BatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep('download');
    setFile(null);
    setBatch(null);
    setError(null);
    setBusy(false);
  };

  const handleClose = () => {
    onClose();
    setTimeout(reset, 200);
  };

  const downloadTemplate = () => {
    window.open(`${API_BASE}/attendance/import/template`, '_blank');
  };

  const handleFile = (f: File | null) => {
    setFile(f);
    setError(null);
  };

  const runDryRun = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiUpload<BatchResponse>(
        `/attendance/import?dryRun=true`,
        fd,
      );
      setBatch(res);
      setStep('review');
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiUpload<BatchResponse>(
        `/attendance/import?dryRun=false`,
        fd,
      );
      setBatch(res);
      setStep('committed');
      onCommitted?.();
    } catch (e: any) {
      setError(e.message || 'Commit failed');
    } finally {
      setBusy(false);
    }
  };

  // ── render per step ──────────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import Attendance from CSV"
      description={
        step === 'download'
          ? 'Step 1 of 3 — Download the Zedtreeo template'
          : step === 'upload'
          ? 'Step 2 of 3 — Upload your CSV (dry-run validation first)'
          : step === 'review'
          ? 'Step 3 of 3 — Review and commit'
          : 'Import complete'
      }
      size="xl"
      footer={
        step === 'download' ? (
          <>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button onClick={() => setStep('upload')}>Next: Upload</Button>
          </>
        ) : step === 'upload' ? (
          <>
            <Button variant="secondary" onClick={() => setStep('download')}>Back</Button>
            <Button onClick={runDryRun} disabled={!file || busy} loading={busy}>
              {busy ? 'Validating…' : 'Validate'}
            </Button>
          </>
        ) : step === 'review' ? (
          <>
            <Button variant="secondary" onClick={() => setStep('upload')}>Back</Button>
            <Button
              onClick={commit}
              disabled={!batch || batch.errorCount === batch.rowCount || busy}
              loading={busy}
            >
              {busy ? 'Committing…' : `Commit ${(batch?.rowCount ?? 0) - (batch?.errorCount ?? 0)} rows`}
            </Button>
          </>
        ) : (
          <Button onClick={handleClose}>Done</Button>
        )
      }
    >
      {error && (
        <div className="mb-3 p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {step === 'download' && (
        <div className="space-y-4">
          <p className="text-sm text-content-secondary">
            The Zedtreeo template uses these columns:
            <code className="ml-1 px-1.5 py-0.5 bg-surface-100 rounded text-xs">
              employee_email, date, status, check_in, check_out, notes
            </code>
          </p>
          <ul className="text-xs text-content-tertiary space-y-1 list-disc pl-5">
            <li><strong>date</strong> — YYYY-MM-DD</li>
            <li><strong>status</strong> — PRESENT, ABSENT, HALF_DAY, LEAVE, HOLIDAY, WEEKEND, WFH</li>
            <li><strong>check_in / check_out</strong> — HH:MM (24-hour, optional)</li>
            <li><strong>employee_email</strong> — must match an active employee in this tenant</li>
            <li>CSV imports take precedence over desktop-agent data</li>
          </ul>
          <Button variant="secondary" onClick={downloadTemplate} className="gap-2">
            <Download size={14} /> Download attendance-template.csv
          </Button>
        </div>
      )}

      {step === 'upload' && (
        <div className="space-y-3">
          <label
            htmlFor="csv-file"
            className="flex flex-col items-center justify-center border-2 border-dashed border-surface-300 rounded-lg p-8 cursor-pointer hover:border-brand-400 hover:bg-surface-50 transition-colors"
          >
            <Upload size={32} className="text-content-tertiary mb-2" />
            <p className="text-sm font-medium text-content-primary">
              {file ? file.name : 'Click to choose a CSV file'}
            </p>
            <p className="text-xs text-content-tertiary mt-1">
              Max 5 MB · max 10,000 rows
            </p>
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {file && (
            <div className="text-xs text-content-secondary">
              {(file.size / 1024).toFixed(1)} KB selected
            </div>
          )}
        </div>
      )}

      {step === 'review' && batch && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-surface-200 p-3 text-center">
              <div className="text-2xl font-semibold">{batch.rowCount}</div>
              <div className="text-xs text-content-tertiary">Total rows</div>
            </div>
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-center">
              <div className="text-2xl font-semibold text-success">
                {batch.rowCount - batch.errorCount}
              </div>
              <div className="text-xs text-content-tertiary">Valid</div>
            </div>
            <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-center">
              <div className="text-2xl font-semibold text-danger">{batch.errorCount}</div>
              <div className="text-xs text-content-tertiary">Errors</div>
            </div>
          </div>

          {batch.errors.length > 0 && (
            <div>
              <p className="text-sm font-medium text-content-primary mb-2">
                Row errors (showing first 50):
              </p>
              <div className="max-h-64 overflow-y-auto border border-surface-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-surface-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Row</th>
                      <th className="px-2 py-1.5 text-left font-medium">Email</th>
                      <th className="px-2 py-1.5 text-left font-medium">Date</th>
                      <th className="px-2 py-1.5 text-left font-medium">Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.errors.slice(0, 50).map((e, i) => (
                      <tr key={i} className="border-t border-surface-200">
                        <td className="px-2 py-1">{e.row}</td>
                        <td className="px-2 py-1 text-content-tertiary">{e.employee_email ?? '—'}</td>
                        <td className="px-2 py-1 text-content-tertiary">{e.date ?? '—'}</td>
                        <td className="px-2 py-1 text-danger">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {batch.errorCount === batch.rowCount && batch.rowCount > 0 && (
            <div className="text-sm text-danger flex items-center gap-2">
              <AlertCircle size={16} /> No valid rows — fix and re-upload.
            </div>
          )}
        </div>
      )}

      {step === 'committed' && batch && (
        <div className="text-center py-6">
          <CheckCircle2 size={48} className="mx-auto text-success mb-3" />
          <p className="text-lg font-semibold text-content-primary">
            {batch.successCount} attendance rows imported
          </p>
          {batch.errorCount > 0 && (
            <p className="text-sm text-content-tertiary mt-1">
              {batch.errorCount} rows skipped (see review screen for details)
            </p>
          )}
          <p className="text-xs text-content-tertiary mt-3">
            Batch ID: <code className="font-mono">{batch.batchId}</code>
          </p>
        </div>
      )}
    </Modal>
  );
}
