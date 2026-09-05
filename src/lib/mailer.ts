import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || 'Sofa Sync <no-reply@sofasync.local>';

const isConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

export async function sendMail(opts: { to: string; subject: string; html: string; text: string }): Promise<void> {
  if (!transporter) {
    // No SMTP_HOST/SMTP_USER/SMTP_PASS configured - fall back to logging so local dev/QA
    // still has a way to grab the link, but this must never be mistaken for real delivery.
    console.log(`[DEV MODE - no SMTP configured] Email to ${opts.to}: ${opts.subject}\n${opts.text}`);
    return;
  }

  await transporter.sendMail({
    from: MAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

export function verificationEmail(link: string) {
  return {
    subject: 'Verify your Sofa Sync account',
    text: `Welcome to Sofa Sync! Verify your email by visiting: ${link}\n\nThis link expires in 24 hours.`,
    html: `<p>Welcome to Sofa Sync!</p><p><a href="${link}">Click here to verify your email</a>.</p><p>This link expires in 24 hours.</p>`,
  };
}

export function passwordResetEmail(link: string) {
  return {
    subject: 'Reset your Sofa Sync password',
    text: `Reset your password by visiting: ${link}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
    html: `<p>Reset your Sofa Sync password:</p><p><a href="${link}">Click here to set a new password</a>.</p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
  };
}
