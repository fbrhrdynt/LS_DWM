import nodemailer from 'nodemailer';

function bool(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

export function mailConfiguration() {
  return {
    configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM),
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: bool(process.env.SMTP_SECURE),
    from: process.env.SMTP_FROM || '',
    userConfigured: Boolean(process.env.SMTP_USER)
  };
}

function transporter() {
  const config = mailConfiguration();
  if (!config.configured) return null;

  const auth = process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || ''
      }
    : undefined;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function sendPasswordResetEmail({ to, name, resetUrl, ttlMinutes }) {
  const tx = transporter();
  if (!tx) return { sent: false, reason: 'smtp-not-configured' };

  const appName = process.env.APP_NAME || 'DWM';
  const safeName = escapeHtml(name || 'User');
  const safeUrl = escapeHtml(resetUrl);

  await tx.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `${appName} password reset`,
    text:
      `Hello ${name || 'User'},\n\n` +
      `A password reset was requested for your ${appName} account.\n\n` +
      `${resetUrl}\n\n` +
      `This link expires in ${ttlMinutes} minutes. If you did not request it, ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1f2937">
        <h2 style="margin-bottom:8px">${escapeHtml(appName)} password reset</h2>
        <p>Hello ${safeName},</p>
        <p>A password reset was requested for your ${escapeHtml(appName)} account.</p>
        <p style="margin:24px 0">
          <a href="${safeUrl}" style="background:#1473e6;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px">
            Reset password
          </a>
        </p>
        <p>This link expires in ${Number(ttlMinutes)} minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `
  });

  return { sent: true };
}
