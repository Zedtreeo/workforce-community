'use client';

import Link from 'next/link';
import { DashboardLayout } from '../../components/dashboard-layout';
import { Card, PageHeader } from '../../components/ui';
import { CalendarClock, Clock, Receipt, Activity, TreePalm, ArrowRight } from 'lucide-react';

const reports = [
  {
    title: 'Attendance Report',
    description: 'Daily attendance records by employee — present, absent, leave, WFH, half-day breakdown',
    href: '/reports/attendance',
    icon: <CalendarClock size={22} />,
  },
  {
    title: 'Work Hours Report',
    description: 'Time log analysis from remote monitoring — total hours, daily breakdown, session count',
    href: '/reports/work-hours',
    icon: <Clock size={22} />,
  },
  {
    title: 'Client Billing Summary',
    description: 'Revenue overview per client — total billed, collected, outstanding, invoice breakdown',
    href: '/reports/billing',
    icon: <Receipt size={22} />,
  },
  {
    title: 'Productivity Report',
    description: 'Employee activity analysis — avg activity %, keystrokes, clicks, work hours ranked',
    href: '/reports/productivity',
    icon: <Activity size={22} />,
  },
  {
    title: 'Leave Summary',
    description: 'Leave balances and usage per employee — entitled, used, available, recent requests',
    href: '/reports/leaves',
    icon: <TreePalm size={22} />,
  },
];

export default function ReportsPage() {
  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        <PageHeader
          title="Reports & Analytics"
          description="Generate and export operational reports"
          breadcrumbs={[{ label: 'Reports' }]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((report) => (
            <Link key={report.href} href={report.href}>
              <Card hover className="h-full">
                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                    {report.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-content-primary group-hover:text-brand-600 transition-colors">{report.title}</h3>
                    <p className="text-sm text-content-tertiary mt-1">{report.description}</p>
                  </div>
                  <ArrowRight size={16} className="text-content-tertiary shrink-0 mt-1" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
