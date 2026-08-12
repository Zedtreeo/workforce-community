'use client';

import { DashboardLayout } from '../../../components/dashboard-layout';
import { Card, PageHeader } from '../../../components/ui';
import { CalendarClock, Clock, Wifi, Shield } from 'lucide-react';

export default function AttendanceAppPage() {
  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1000px] mx-auto space-y-6">
        <PageHeader
          title="Attendance App"
          breadcrumbs={[{ label: 'My Portal', href: '/portal' }, { label: 'Attendance App' }]}
        />

        <Card>
          <div className="space-y-3">
            <p className="text-content-secondary text-sm leading-relaxed">
              <strong className="text-content-primary">Desktop Agent</strong> runs in the background and adds <em>periodic screenshots</em>, active-application detection, and keystroke / mouse activity tracking on top of basic clock-in.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
              <strong>macOS users:</strong> the desktop agent is not code-signed yet, so installing requires Terminal commands and macOS permission resets. Until we ship the signed build, use the <a href="/portal/attendance" className="font-semibold underline text-amber-900">Web Clock In/Out</a> on the Attendance page — one click, no install.
            </div>
            <p className="text-xs text-content-tertiary">
              Windows and Linux users: install below. Setup takes ~2 minutes.
            </p>
          </div>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <CalendarClock size={22} className="text-brand-600" />, label: 'Auto Clock-In', desc: 'Starts when you begin work' },
            { icon: <Clock size={22} className="text-brand-600" />, label: 'Time Tracking', desc: 'Accurate work hours' },
            { icon: <Wifi size={22} className="text-brand-600" />, label: 'Online Sync', desc: 'Syncs with your portal' },
            { icon: <Shield size={22} className="text-brand-600" />, label: 'Shift Aware', desc: 'Follows your schedule' },
          ].map((f) => (
            <Card key={f.label} className="text-center py-4">
              <div className="flex justify-center mb-2">{f.icon}</div>
              <p className="text-sm font-semibold text-content-primary">{f.label}</p>
              <p className="text-xs text-content-tertiary mt-0.5">{f.desc}</p>
            </Card>
          ))}
        </div>

        {/* Source / GitHub link */}
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-content-primary">Built from open source</h3>
              <p className="text-xs text-content-tertiary mt-1">
                The HRMS Monitor agent is open. View source, file issues, or build your own version on GitHub.
              </p>
            </div>
            <a
              href="https://github.com/LegelpTech-Outsourcing-Pvt-Ltd/legelp"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-content-primary bg-surface-100 hover:bg-surface-200 rounded-lg border border-surface-300 flex-shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              View on GitHub
            </a>
          </div>
        </Card>

        {/* Download Section */}
        <div>
          <h3 className="text-sm font-semibold text-content-secondary mb-3">Download for your platform</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                os: 'macOS (Apple Silicon)',
                desc: 'macOS 12+, M1/M2/M3 — advanced setup',
                note: 'Requires Terminal — use Web Clock In instead',
                url: '/uploads/__agent-builds__/HRMS-Monitor-mac-arm64.zip',
                steps: [
                  { kind: 'text', body: 'Download and unzip the file (double-click in Finder).' },
                  { kind: 'text', body: 'Drag "HRMS Monitor.app" into the Applications folder.' },
                  { kind: 'text', body: 'Because the app is not notarized yet, macOS will block it on first launch. Remove the quarantine flag in Terminal:' },
                  { kind: 'cmd',  body: 'xattr -dr com.apple.quarantine /Applications/"HRMS Monitor.app"' },
                  { kind: 'text', body: '⚠️  If you previously installed an older version of HRMS Monitor, run these BEFORE launching — they reset macOS\'s permission cache so it will re-prompt for Screen Recording on first launch:' },
                  { kind: 'cmd',  body: 'tccutil reset ScreenCapture com.hrms.monitor' },
                  { kind: 'cmd',  body: 'tccutil reset Accessibility com.hrms.monitor' },
                  { kind: 'text', body: 'Now double-click "HRMS Monitor.app" in Applications. Sign in with your portal email + password.' },
                  { kind: 'text', body: 'Click "Start Tracking" — macOS will prompt for these two permissions on first capture:' },
                  { kind: 'perm', body: 'Screen Recording — required for periodic screenshots (without this, the dashboard will show "No image")' },
                  { kind: 'perm', body: 'Accessibility — required for keystroke / mouse activity tracking' },
                  { kind: 'text', body: 'If macOS does NOT prompt, the dashboard will show a yellow banner with a button to open System Settings → Screen Recording directly. Toggle HRMS Monitor ON there, then Quit & Reopen.' },
                ],
              },
              {
                os: 'macOS (Intel)',
                desc: 'macOS 12+ Intel-based Mac',
                note: '.zip archive',
                url: '/uploads/__agent-builds__/HRMS-Monitor-mac-x64.zip',
                steps: [
                  { kind: 'text', body: 'Same setup as Apple Silicon. Download, unzip, drag to Applications.' },
                  { kind: 'cmd',  body: 'xattr -dr com.apple.quarantine ~/Downloads/"HRMS Monitor.app"' },
                  { kind: 'text', body: 'Drag "HRMS Monitor.app" into Applications and launch. Sign in with your portal credentials.' },
                  { kind: 'perm', body: 'Grant Screen Recording + Accessibility in System Settings.' },
                ],
              },
              {
                os: 'Linux',
                desc: 'Ubuntu, Debian, Fedora (64-bit)',
                note: '.AppImage',
                url: '/uploads/__agent-builds__/HRMS-Monitor-linux-x64.AppImage',
                steps: [
                  { kind: 'text', body: 'Download the .AppImage file.' },
                  { kind: 'text', body: 'Make it executable:' },
                  { kind: 'cmd',  body: 'chmod +x ~/Downloads/HRMS-Monitor-linux-x64.AppImage' },
                  { kind: 'text', body: 'Run it:' },
                  { kind: 'cmd',  body: './HRMS-Monitor-linux-x64.AppImage' },
                  { kind: 'text', body: 'If you get a FUSE error on Ubuntu 22.04+, install libfuse2:' },
                  { kind: 'cmd',  body: 'sudo apt install libfuse2' },
                  { kind: 'text', body: 'Sign in with your portal credentials. Screen capture works automatically on X11/Wayland.' },
                ],
              },
              {
                os: 'Windows',
                desc: 'Windows 10/11 (64-bit)',
                note: 'NSIS installer (~74 MB)',
                url: '/uploads/__agent-builds__/HRMS-Monitor-win-x64.exe',
                recommended: true,
                steps: [
                  { kind: 'text', body: 'Download HRMS-Monitor-win-x64.exe from the button above.' },
                  { kind: 'text', body: 'Because the installer is not code-signed yet, Windows SmartScreen will show a blue warning when you double-click it.' },
                  { kind: 'text', body: 'Click "More info" on the blue SmartScreen panel, then click the "Run anyway" button that appears.' },
                  { kind: 'text', body: 'The NSIS installer opens — pick the install location (default is fine) and click Install. It takes about 10 seconds.' },
                  { kind: 'text', body: 'A desktop shortcut and Start Menu entry are created. Launch HRMS Monitor and sign in with your portal email + password.' },
                  { kind: 'text', body: 'On first capture, Windows may show a "Defender SmartScreen" toast — allow it. No additional permissions are required for screen capture on Windows.' },
                ],
              },
            ].map((p) => (
              <Card key={p.os} className={`py-5 px-4 ${p.recommended ? 'ring-2 ring-brand-500' : ''}`}>
                {p.recommended && (
                  <span className="text-xs font-medium text-brand-600 mb-2 block text-center">Recommended</span>
                )}
                <p className="text-lg font-bold text-content-primary text-center">{p.os}</p>
                <p className="text-xs text-content-tertiary mt-1 text-center">{p.desc}</p>
                <p className="text-xs text-content-tertiary text-center">{p.note}</p>
                <div className="mt-3 mb-4 text-center">
                  {p.url ? (
                    <a
                      href={p.url}
                      download
                      className="inline-block px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700"
                    >
                      Download
                    </a>
                  ) : (
                    <button
                      disabled
                      className="px-4 py-2 text-sm font-medium text-content-tertiary bg-surface-100 rounded-lg cursor-not-allowed"
                    >
                      Coming Soon
                    </button>
                  )}
                </div>
                {p.steps.length > 0 && (
                  <details className="mt-3 group">
                    <summary className="cursor-pointer text-xs font-semibold text-brand-600 hover:underline">
                      Setup instructions ↓
                    </summary>
                    <ol className="mt-3 space-y-2 text-xs text-content-secondary list-decimal list-inside">
                      {p.steps.map((step, i) => (
                        <li key={i} className={step.kind === 'cmd' ? 'list-none ml-0' : step.kind === 'perm' ? 'list-none ml-0' : ''}>
                          {step.kind === 'cmd' ? (
                            <pre className="bg-gray-900 text-green-300 text-xs p-2 rounded-md overflow-x-auto font-mono whitespace-pre-wrap break-all">
                              {step.body}
                            </pre>
                          ) : step.kind === 'perm' ? (
                            <div className="flex items-start gap-2 px-2 py-1 bg-warning/10 rounded-md">
                              <span className="text-warning font-semibold">⚠</span>
                              <span>{step.body}</span>
                            </div>
                          ) : (
                            <span>{step.body}</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Setup Instructions */}
        <Card>
          <h3 className="text-sm font-semibold text-content-primary mb-3">Setup Instructions</h3>
          <ol className="space-y-2 text-sm text-content-secondary list-decimal list-inside">
            <li>Download the app for your operating system above</li>
            <li>Install and launch the application</li>
            <li>Sign in with your portal credentials (same email & password)</li>
            <li>The app will automatically track your attendance going forward</li>
          </ol>
          <p className="text-xs text-content-tertiary mt-3">
            The app syncs your attendance data with the portal. You can view your clock-in/out times
            on the Attendance page.
          </p>
        </Card>
      </div>
    </DashboardLayout>
  );
}
