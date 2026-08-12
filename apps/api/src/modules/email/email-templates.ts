/**
 * Production-grade HTML email template engine.
 *
 * - Table-based layout for maximum email client compatibility
 * - Dark mode support via @media (prefers-color-scheme: dark)
 * - Dynamic tenant branding (logo, company name, accent color)
 * - Responsive (mobile-friendly with fluid widths)
 * - Tested against: Gmail, Outlook, Apple Mail, Yahoo, Thunderbird
 */

export interface TenantBrand {
  companyName: string;
  logo?: string | null;
  accentColor?: string; // hex, e.g. '#2563eb'
}

const DEFAULT_BRAND: TenantBrand = {
  companyName: 'HRMS Platform',
  accentColor: '#2563eb',
};

// ── Base Layout ──────────────────────────────────────────

export function baseLayout(
  body: string,
  brand: Partial<TenantBrand> = {},
  options: { previewText?: string; footerText?: string } = {},
): string {
  const b: TenantBrand = { ...DEFAULT_BRAND, ...brand };
  const accent = b.accentColor || '#2563eb';
  const previewText = options.previewText || '';
  const footer = options.footerText || 'This is an automated notification. Please do not reply to this email.';

  const logoHtml = b.logo
    ? `<img src="${b.logo}" alt="${b.companyName}" style="max-height:40px;max-width:180px;display:block;" />`
    : `<span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${escapeHtml(b.companyName)}</span>`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="color-scheme" content="light dark"/>
  <meta name="supported-color-schemes" content="light dark"/>
  <title>${escapeHtml(b.companyName)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }

    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #1a1a2e !important; }
      .email-card { background-color: #16213e !important; }
      .email-text { color: #e2e8f0 !important; }
      .email-text-muted { color: #94a3b8 !important; }
      .email-text-heading { color: #f1f5f9 !important; }
      .email-table-header { background-color: #1e293b !important; }
      .email-table-border { border-color: #334155 !important; }
      .email-footer { background-color: #0f172a !important; }
      .email-divider { border-color: #334155 !important; }
    }

    /* Responsive */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .email-padding { padding-left: 16px !important; padding-right: 16px !important; }
      .email-stack { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <!-- Preview text -->
  ${previewText ? `<div style="display:none;font-size:1px;color:#f1f5f9;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${escapeHtml(previewText)}</div>` : ''}

  <!-- Outer wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="email-bg" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:24px 8px;">

        <!-- Email container -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="email-container" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:${accent};border-radius:12px 12px 0 0;padding:20px 32px;" class="email-padding">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>${logoHtml}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="email-card email-padding" style="background-color:#ffffff;padding:32px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="email-footer email-padding" style="background-color:#f8fafc;border-radius:0 0 12px 12px;padding:20px 32px;border-top:1px solid #e2e8f0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td class="email-text-muted" style="color:#94a3b8;font-size:12px;line-height:18px;text-align:center;">
                    ${escapeHtml(footer)}
                    <br/>
                    &copy; ${new Date().getFullYear()} ${escapeHtml(b.companyName)}. All rights reserved.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Component Helpers ────────────────────────────────────

export function heading(text: string, color?: string): string {
  return `<h2 class="email-text-heading" style="margin:0 0 16px;font-size:22px;font-weight:700;color:${color || '#1e293b'};line-height:28px;">${escapeHtml(text)}</h2>`;
}

export function paragraph(text: string): string {
  return `<p class="email-text" style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155;">${text}</p>`;
}

export function dataTable(rows: Array<{ label: string; value: string }>): string {
  const rowsHtml = rows
    .map(
      (r) => `
      <tr>
        <td class="email-table-header email-table-border" style="padding:10px 14px;border:1px solid #e2e8f0;background-color:#f8fafc;font-weight:600;font-size:14px;color:#475569;width:40%;">${escapeHtml(r.label)}</td>
        <td class="email-text email-table-border" style="padding:10px 14px;border:1px solid #e2e8f0;font-size:14px;color:#334155;">${r.value}</td>
      </tr>`,
    )
    .join('');

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:16px 0 24px;">
    ${rowsHtml}
  </table>`;
}

export function ctaButton(text: string, url: string, color?: string): string {
  const bg = color || '#2563eb';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr>
      <td style="border-radius:8px;background-color:${bg};">
        <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;border:1px solid ${bg};">${escapeHtml(text)}</a>
      </td>
    </tr>
  </table>`;
}

export function statusBadge(text: string, color: string): string {
  return `<span style="display:inline-block;padding:4px 12px;border-radius:20px;background-color:${color};color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.3px;">${escapeHtml(text)}</span>`;
}

export function bigNumber(value: string, label: string): string {
  return `<div style="text-align:center;margin:16px 0;">
    <div class="email-text-heading" style="font-size:36px;font-weight:800;color:#1e293b;line-height:1.1;">${escapeHtml(value)}</div>
    <div class="email-text-muted" style="font-size:13px;color:#64748b;margin-top:4px;">${escapeHtml(label)}</div>
  </div>`;
}

export function divider(): string {
  return `<hr class="email-divider" style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>`;
}

export function alertBox(message: string, type: 'info' | 'warning' | 'error' | 'success'): string {
  const colors = {
    info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
    warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
    error: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
    success: { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
  };
  const c = colors[type];
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;">
    <tr>
      <td style="padding:14px 18px;background-color:${c.bg};border-left:4px solid ${c.border};border-radius:4px;">
        <span style="font-size:14px;color:${c.text};line-height:22px;">${message}</span>
      </td>
    </tr>
  </table>`;
}

// ── Utilities ────────────────────────────────────────────

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate a plain-text version of an email for clients that don't render HTML.
 */
export function plainTextFallback(sections: Array<{ heading?: string; body: string }>): string {
  return sections
    .map((s) => {
      const h = s.heading ? `${s.heading}\n${'─'.repeat(s.heading.length)}\n` : '';
      return h + s.body;
    })
    .join('\n\n')
    + '\n\n---\nThis is an automated notification. Please do not reply to this email.';
}
