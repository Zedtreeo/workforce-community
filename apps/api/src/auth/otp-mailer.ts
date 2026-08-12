import * as nodemailer from 'nodemailer';
import {
  baseLayout,
  heading,
  paragraph,
  bigNumber,
  alertBox,
} from '../modules/email/email-templates';

/**
 * Standalone OTP mailer for the Better Auth emailOTP plugin.
 * Lives outside Nest DI (auth.config is a module singleton), so it builds its
 * own transport from the same SMTP_* env the EmailService uses (ZeptoMail).
 */
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.zeptomail.in',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendLoginOtpEmail(
  email: string,
  otp: string,
  expiresMinutes = 5,
): Promise<void> {
  const body = [
    heading('Your sign-in code'),
    paragraph(
      `Use the code below to sign in. It expires in ${expiresMinutes} minutes and can be used once.`,
    ),
    bigNumber(otp, 'verification code'),
    alertBox(
      'If you didn’t request this, you can safely ignore this email — no one can sign in without the code.',
      'info',
    ),
  ].join('');

  const html = baseLayout(
    body,
    {},
    {
      previewText: `Your sign-in code is ${otp}`,
      footerText: 'This code was requested to sign in. Never share it with anyone.',
    },
  );

  const subject = `${otp} is your sign-in code`;
  const text = `Your sign-in code is ${otp}. It expires in ${expiresMinutes} minutes. If you didn't request it, ignore this email.`;

  // legelp.com mailboxes are hosted at Hostinger, which silently drops mail
  // RELAYED via ZeptoMail for its own domain (self-domain spoof protection). So
  // deliver OTPs to @legelp.com recipients through Hostinger's own mail API,
  // which is authorized for the domain. Falls back to ZeptoMail SMTP on failure.
  if (email.toLowerCase().endsWith('@legelp.com')) {
    const sent = await sendOtpViaHostinger(email, subject, html, text).catch(() => false);
    if (sent) return;
  }

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM_OTP || '"Legelp" <noreply@legelp.com>',
    to: email,
    subject,
    html,
    text,
  });
}

// ── Hostinger Agentic Mail direct-send path (for @legelp.com recipients) ──

const HOSTINGER_BASE = 'https://api.mail.hostinger.com';
let hostingerMailboxId: string | null = null;

/** Resolve (and cache) the resourceId of the mailbox we send OTPs from. */
async function getHostingerMailboxId(fromAddr: string): Promise<string | null> {
  if (hostingerMailboxId) return hostingerMailboxId;
  const token = process.env.HOSTINGER_MAIL_TOKEN;
  if (!token) return null;
  const res = await fetch(`${HOSTINGER_BASE}/api/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data: any = await res.json();
  const mb = (data?.data?.mailboxes ?? []).find(
    (m: any) => String(m.address).toLowerCase() === fromAddr.toLowerCase(),
  );
  hostingerMailboxId = mb?.resourceId ?? null;
  return hostingerMailboxId;
}

/** Send the OTP via Hostinger's mail API. Returns true on success. */
async function sendOtpViaHostinger(
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<boolean> {
  const token = process.env.HOSTINGER_MAIL_TOKEN;
  if (!token) return false;
  const fromAddr = process.env.HOSTINGER_OTP_MAILBOX || 'contact@legelp.com';
  const id = await getHostingerMailboxId(fromAddr);
  if (!id) return false;
  const res = await fetch(`${HOSTINGER_BASE}/api/v1/mailboxes/${id}/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: [to], subject, text, html, displayName: 'Legelp' }),
  });
  return res.ok;
}
