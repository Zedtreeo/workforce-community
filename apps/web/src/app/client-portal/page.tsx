'use client'

import { API_BASE } from '@/lib/api';
import { useEffect, useState, useCallback } from 'react';
import { Button, Card, Badge, StatCard } from '../../components/ui';
import { HolidayCalendar } from '../../components/holiday-calendar';
import { Users, FileText, CalendarDays, CalendarOff, LogOut, Eye, ArrowLeft, Mail } from 'lucide-react';

const API = `${API_BASE}/client-portal`;

const money = (v: any, ccy?: string) =>
  `${ccy ? ccy + ' ' : ''}${Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtTime = (d?: string | null) =>
  d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

const invoiceBadge = (s: string): 'success' | 'info' | 'danger' | 'warning' | 'default' => {
  if (s === 'PAID') return 'success';
  if (s === 'PARTIALLY_PAID') return 'warning';
  if (s === 'SENT') return 'info';
  if (s === 'OVERDUE') return 'danger';
  return 'default';
};
const attBadge = (s: string): 'success' | 'info' | 'danger' | 'warning' | 'default' => {
  if (s === 'PRESENT' || s === 'WFH') return 'success';
  if (s === 'ABSENT') return 'danger';
  if (s === 'LEAVE' || s === 'HALF_DAY') return 'warning';
  return 'default';
};
const leaveBadge = (s: string): 'success' | 'info' | 'danger' | 'warning' | 'default' => {
  if (s === 'APPROVED') return 'success';
  if (s === 'PENDING') return 'warning';
  if (s === 'REJECTED' || s === 'CANCELLED') return 'danger';
  return 'default';
};

type Tab = 'dashboard' | 'team' | 'attendance' | 'leave' | 'invoices' | 'holidays';

export default function ClientPortalPage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(false);

  // Login (email → OTP)
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Data
  const [dashboard, setDashboard] = useState<any>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any>(null);
  const [leave, setLeave] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    const t = typeof window !== 'undefined' ? sessionStorage.getItem('cp_token') : null;
    const u = typeof window !== 'undefined' ? sessionStorage.getItem('cp_user') : null;
    if (t && u) { setToken(t); setUser(JSON.parse(u)); }
  }, []);

  const portalFetch = useCallback(async (path: string) => {
    if (!token) return null;
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      setToken(null); setUser(null);
      sessionStorage.removeItem('cp_token'); sessionStorage.removeItem('cp_user');
      return null;
    }
    return res.json();
  }, [token]);

  const sendOtp = async () => {
    setLoginError(''); setSending(true);
    try {
      const res = await fetch(`${API}/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || 'Could not send code'); }
      setStep('otp');
    } catch (e: any) { setLoginError(e.message); }
    finally { setSending(false); }
  };

  const verifyOtp = async () => {
    setLoginError(''); setSending(true);
    try {
      const res = await fetch(`${API}/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid code');
      setToken(data.token); setUser(data.user);
      sessionStorage.setItem('cp_token', data.token);
      sessionStorage.setItem('cp_user', JSON.stringify(data.user));
    } catch (e: any) { setLoginError(e.message); }
    finally { setSending(false); }
  };

  const logout = () => {
    setToken(null); setUser(null); setStep('email'); setOtp('');
    sessionStorage.removeItem('cp_token'); sessionStorage.removeItem('cp_user');
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    (async () => {
      try {
        if (tab === 'dashboard') setDashboard(await portalFetch('/dashboard'));
        else if (tab === 'team') setTeam(await portalFetch('/team') || []);
        else if (tab === 'attendance') setAttendance(await portalFetch('/attendance'));
        else if (tab === 'leave') setLeave(await portalFetch('/leave') || []);
        else if (tab === 'invoices') setInvoices(await portalFetch('/invoices') || []);
        else if (tab === 'holidays') setHolidays(await portalFetch(`/holidays?year=${holidayYear}`) || []);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [token, tab, portalFetch, holidayYear]);

  useEffect(() => {
    if (token) portalFetch('/company').then(setCompany).catch(() => {});
  }, [token, portalFetch]);

  // ── Login screen ──
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 px-4">
        <div className="bg-white rounded-2xl p-8 sm:p-10 w-full max-w-[400px] shadow-lg">
          <h1 className="text-xl font-bold text-content-primary mb-1">Client Portal</h1>
          <p className="text-sm text-content-tertiary mb-6">
            {step === 'email'
              ? 'Sign in with your registered email — we’ll send you a one-time code.'
              : `Enter the 6-digit code sent to ${email}.`}
          </p>
          {loginError && <p className="text-danger-dark text-sm mb-3">{loginError}</p>}

          {step === 'email' ? (
            <div className="flex flex-col gap-3">
              <input
                type="email" placeholder="Email address" autoFocus
                className="border border-surface-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && email.trim() && sendOtp()}
              />
              <Button className="w-full" onClick={sendOtp} loading={sending} disabled={!email.trim()}>
                <Mail size={14} /> Send code
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <input
                type="text" inputMode="numeric" maxLength={6} placeholder="6-digit code" autoFocus
                className="border border-surface-300 rounded-lg px-3 py-2.5 text-center text-lg font-mono tracking-[0.4em] focus:ring-2 focus:ring-brand-500 focus:outline-none"
                value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && otp.length === 6 && verifyOtp()}
              />
              <Button className="w-full" onClick={verifyOtp} loading={sending} disabled={otp.length !== 6}>
                Verify & sign in
              </Button>
              <button onClick={() => { setStep('email'); setOtp(''); setLoginError(''); }}
                className="text-xs text-content-tertiary hover:text-content-secondary">
                ← Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Portal ──
  const ccy = dashboard?.client?.currency;
  return (
    <div className="min-h-screen bg-surface-50">
      <header className="bg-white border-b border-surface-200 px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-content-primary">Client Portal</h1>
          <p className="text-xs text-content-tertiary truncate">{user?.clientName}</p>
        </div>
        <Button variant="ghost" size="sm" icon={<LogOut size={14} />} onClick={logout}>
          <span className="hidden sm:inline">Sign Out</span>
        </Button>
      </header>

      <div className="bg-white border-b border-surface-200 px-4 md:px-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {([
            { key: 'dashboard', label: 'Dashboard' },
            { key: 'team', label: 'My Staff' },
            { key: 'attendance', label: 'Attendance' },
            { key: 'leave', label: 'Leave' },
            { key: 'invoices', label: 'Invoices' },
            { key: 'holidays', label: 'Holidays' },
          ] as { key: Tab; label: string }[]).map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setSelectedInvoice(null); }}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                tab === t.key ? 'border-brand-600 text-brand-600' : 'border-transparent text-content-tertiary hover:text-content-secondary'
              }`}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="p-4 md:p-6 max-w-[1100px] mx-auto">
        {loading && <p className="text-content-tertiary text-sm py-8 text-center">Loading…</p>}

        {/* Holidays */}
        {tab === 'holidays' && !loading && (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Company Holidays</h3>
              <select
                className="border border-surface-200 rounded-lg px-3 py-2 text-sm text-content-primary bg-white"
                value={holidayYear}
                onChange={(e) => setHolidayYear(+e.target.value)}
              >
                {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <HolidayCalendar holidays={holidays} year={holidayYear} />
          </Card>
        )}

        {/* Dashboard */}
        {tab === 'dashboard' && dashboard && !loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Active Staff" value={dashboard.activeStaff} icon={<Users />} />
              <StatCard label="Total Invoices" value={dashboard.totalInvoices} icon={<FileText />} />
              <StatCard label="Open Invoices" value={dashboard.openInvoices}
                changeType={dashboard.openInvoices > 0 ? 'negative' : 'neutral'} icon={<FileText />} />
            </div>
            <Card padding="none">
              <div className="px-4 py-3 border-b border-surface-200"><h3 className="font-semibold text-sm">Recent Invoices</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-content-tertiary bg-surface-50">
                    <tr><th className="px-4 py-2.5 font-medium">Invoice #</th><th className="px-4 py-2.5 font-medium text-right">Amount</th>
                      <th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium hidden sm:table-cell">Date</th>
                      <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Due</th></tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100">
                    {(dashboard.recentInvoices || []).map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-surface-50">
                        <td className="px-4 py-2.5 font-mono font-medium">{inv.invoiceNumber}</td>
                        <td className="px-4 py-2.5 font-mono text-right">{money(inv.total, inv.currency)}</td>
                        <td className="px-4 py-2.5"><Badge variant={invoiceBadge(inv.status)}>{inv.status}</Badge></td>
                        <td className="px-4 py-2.5 text-content-tertiary hidden sm:table-cell">{fmtDate(inv.invoiceDate)}</td>
                        <td className="px-4 py-2.5 text-content-tertiary hidden sm:table-cell">{fmtDate(inv.dueDate)}</td>
                      </tr>
                    ))}
                    {(dashboard.recentInvoices || []).length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-content-tertiary">No invoices yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Staff */}
        {tab === 'team' && !loading && (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 text-left border-b border-surface-200">
                  <tr><th className="px-4 py-3 font-medium text-content-secondary">Name</th>
                    <th className="px-4 py-3 font-medium text-content-secondary hidden sm:table-cell">Designation</th>
                    <th className="px-4 py-3 font-medium text-content-secondary">Role</th>
                    <th className="px-4 py-3 font-medium text-content-secondary hidden md:table-cell">Schedule</th>
                    <th className="px-4 py-3 font-medium text-content-secondary hidden md:table-cell">Start Date</th></tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {team.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-50">
                      <td className="px-4 py-3"><p className="font-medium text-content-primary">{m.employee.firstName} {m.employee.lastName}</p>
                        <p className="text-xs text-content-tertiary sm:hidden">{m.employee.designation || '—'}</p></td>
                      <td className="px-4 py-3 text-content-tertiary hidden sm:table-cell">{m.employee.designation || '—'}</td>
                      <td className="px-4 py-3 text-content-secondary">{m.role || '—'}</td>
                      <td className="px-4 py-3 text-content-tertiary hidden md:table-cell">{(m.workSchedule || '').replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-content-tertiary hidden md:table-cell">{fmtDate(m.startDate)}</td>
                    </tr>
                  ))}
                  {team.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-content-tertiary">No staff assigned</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Attendance */}
        {tab === 'attendance' && attendance && !loading && (
          <div className="space-y-6">
            <Card padding="none">
              <div className="px-4 py-3 bg-surface-50 border-b border-surface-200">
                <p className="text-sm font-medium text-content-secondary">Monthly summary — {attendance.month}/{attendance.year}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-content-tertiary"><tr>
                    <th className="px-4 py-3 font-medium">Employee</th><th className="px-4 py-3 font-medium text-right">Present</th>
                    <th className="px-4 py-3 font-medium text-right">Leave</th><th className="px-4 py-3 font-medium text-right">Absent</th>
                    <th className="px-4 py-3 font-medium text-right">Half-day</th><th className="px-4 py-3 font-medium text-right">Hours</th></tr></thead>
                  <tbody className="divide-y divide-surface-100">
                    {attendance.summary.map((s: any) => (
                      <tr key={s.employeeId} className="hover:bg-surface-50">
                        <td className="px-4 py-3 font-medium text-content-primary">{s.name}</td>
                        <td className="px-4 py-3 text-right">{s.present}</td><td className="px-4 py-3 text-right">{s.leave}</td>
                        <td className="px-4 py-3 text-right">{s.absent}</td><td className="px-4 py-3 text-right">{s.halfDay}</td>
                        <td className="px-4 py-3 text-right font-medium">{s.totalHours}h</td>
                      </tr>
                    ))}
                    {attendance.summary.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-content-tertiary">No staff assigned</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card padding="none">
              <div className="px-4 py-3 border-b border-surface-200"><h3 className="font-semibold text-sm">Daily records</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-content-tertiary bg-surface-50"><tr>
                    <th className="px-4 py-2.5 font-medium">Date</th><th className="px-4 py-2.5 font-medium">Employee</th>
                    <th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium hidden sm:table-cell">In</th>
                    <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Out</th><th className="px-4 py-2.5 font-medium text-right">Hours</th></tr></thead>
                  <tbody className="divide-y divide-surface-100">
                    {(attendance.records || []).map((r: any, i: number) => (
                      <tr key={i} className="hover:bg-surface-50">
                        <td className="px-4 py-2.5 text-content-tertiary">{fmtDate(r.date)}</td>
                        <td className="px-4 py-2.5 text-content-primary">{r.name}</td>
                        <td className="px-4 py-2.5"><Badge variant={attBadge(r.status)}>{r.status}</Badge></td>
                        <td className="px-4 py-2.5 text-content-tertiary hidden sm:table-cell">{fmtTime(r.checkIn)}</td>
                        <td className="px-4 py-2.5 text-content-tertiary hidden sm:table-cell">{fmtTime(r.checkOut)}</td>
                        <td className="px-4 py-2.5 text-right">{r.workHours ? `${Number(r.workHours)}h` : '—'}</td>
                      </tr>
                    ))}
                    {(attendance.records || []).length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-content-tertiary">No attendance this month</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* Leave */}
        {tab === 'leave' && !loading && (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 text-left border-b border-surface-200"><tr>
                  <th className="px-4 py-3 font-medium text-content-secondary">Employee</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">Type</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">From</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">To</th>
                  <th className="px-4 py-3 font-medium text-content-secondary text-right">Days</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">Status</th></tr></thead>
                <tbody className="divide-y divide-surface-100">
                  {leave.map((l) => (
                    <tr key={l.id} className="hover:bg-surface-50">
                      <td className="px-4 py-3 font-medium text-content-primary">{l.name}</td>
                      <td className="px-4 py-3 text-content-secondary">{l.leaveType?.name || '—'}</td>
                      <td className="px-4 py-3 text-content-tertiary">{fmtDate(l.startDate)}</td>
                      <td className="px-4 py-3 text-content-tertiary">{fmtDate(l.endDate)}</td>
                      <td className="px-4 py-3 text-right">{Number(l.days)}</td>
                      <td className="px-4 py-3"><Badge variant={leaveBadge(l.status)}>{l.status}</Badge></td>
                    </tr>
                  ))}
                  {leave.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-content-tertiary">No leave records</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Invoices list */}
        {tab === 'invoices' && !loading && !selectedInvoice && (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 text-left border-b border-surface-200"><tr>
                  <th className="px-4 py-3 font-medium text-content-secondary">Invoice #</th>
                  <th className="px-4 py-3 font-medium text-content-secondary text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-content-secondary">Status</th>
                  <th className="px-4 py-3 font-medium text-content-secondary hidden sm:table-cell">Date</th>
                  <th className="px-4 py-3 font-medium text-content-secondary hidden md:table-cell">Due</th>
                  <th className="px-4 py-3 font-medium text-content-secondary text-right">Action</th></tr></thead>
                <tbody className="divide-y divide-surface-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-surface-50">
                      <td className="px-4 py-3 font-mono font-medium">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 font-mono text-right">{money(inv.total, inv.currency)}</td>
                      <td className="px-4 py-3"><Badge variant={invoiceBadge(inv.status)}>{inv.status}</Badge></td>
                      <td className="px-4 py-3 text-content-tertiary hidden sm:table-cell">{fmtDate(inv.invoiceDate)}</td>
                      <td className="px-4 py-3 text-content-tertiary hidden md:table-cell">{fmtDate(inv.dueDate)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="xs" icon={<Eye size={14} />} onClick={() => setSelectedInvoice(inv)}>View</Button>
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-content-tertiary">No invoices yet</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Invoice detail */}
        {tab === 'invoices' && selectedInvoice && (
          <div className="space-y-4">
            <button onClick={() => setSelectedInvoice(null)}
              className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium">
              <ArrowLeft size={14} /> Back to invoices
            </button>
            <Card>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-bold text-content-primary">{selectedInvoice.invoiceNumber}</h3>
                <Badge variant={invoiceBadge(selectedInvoice.status)} className="px-3 py-1 text-sm w-fit">{selectedInvoice.status}</Badge>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 text-sm text-content-tertiary mb-6">
                <span>Date: {fmtDate(selectedInvoice.invoiceDate)}</span>
                <span>Due: {fmtDate(selectedInvoice.dueDate)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm mb-4">
                  <thead className="bg-surface-50 text-left"><tr>
                    <th className="px-3 py-2 font-medium text-content-secondary">Description</th>
                    <th className="px-3 py-2 font-medium text-right text-content-secondary">Qty</th>
                    <th className="px-3 py-2 font-medium text-right text-content-secondary">Rate</th>
                    <th className="px-3 py-2 font-medium text-right text-content-secondary">Amount</th></tr></thead>
                  <tbody className="divide-y divide-surface-100">
                    {(selectedInvoice.lineItems || []).map((li: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-content-primary">{li.description}</td>
                        <td className="px-3 py-2 text-right">{Number(li.quantity)}</td>
                        <td className="px-3 py-2 text-right">{money(li.rate)}</td>
                        <td className="px-3 py-2 text-right font-medium">{money(li.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-right pt-3 border-t border-surface-200 space-y-1">
                <p className="text-sm text-content-tertiary">Subtotal: {money(selectedInvoice.subtotal, selectedInvoice.currency)}</p>
                {Number(selectedInvoice.taxAmount) > 0 && (
                  <p className="text-sm text-content-tertiary">Tax ({Number(selectedInvoice.taxPercent)}%): {money(selectedInvoice.taxAmount, selectedInvoice.currency)}</p>
                )}
                <p className="text-lg font-bold text-content-primary">Total: {money(selectedInvoice.total, selectedInvoice.currency)}</p>
                {selectedInvoice.payoneerLink && (
                  <a href={selectedInvoice.payoneerLink} target="_blank" rel="noopener noreferrer"
                    className="inline-block mt-2 text-sm font-medium text-brand-600 hover:text-brand-700">Pay this invoice →</a>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {company && (company.website || company.phone || company.address) && (
        <footer className="border-t border-surface-200 bg-white px-4 md:px-6 py-4">
          <div className="max-w-[1100px] mx-auto text-xs text-content-tertiary flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
            <span className="font-medium text-content-secondary">{company.name}</span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {company.website && (
                <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{company.website}</a>
              )}
              {company.phone && <a href={`tel:${company.phone}`} className="hover:text-content-secondary">{company.phone}</a>}
              {company.address && <span>{company.address}</span>}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
