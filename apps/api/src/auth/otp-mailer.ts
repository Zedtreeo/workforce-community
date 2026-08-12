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
 * own transport from the SMTP_* env — any SMTP server works; the docker-compose
 * quickstart points it at the bundled Mailpit mail-catcher.
 */
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025', 10),
      secure: process.env.SMTP_SECURE === 'true',
      // Mailpit / dev SMTP needs no auth; real SMTP sets SMTP_USER/PASS.
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
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

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || 'Zedtreeo Workforce <no-reply@example.com>',
    to: email,
    subject,
    html,
    text,
  });
}
