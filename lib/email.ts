import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 'missing');

// ─── HTML templates ───────────────────────────────────────────────────────────

function resetEmailHtml(name: string, resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fc;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f4f7fc;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%"
             style="max-width:480px;background:#ffffff;border-radius:16px;
                    overflow:hidden;box-shadow:0 8px 32px rgba(15,42,97,0.12);">

        <!-- Header -->
        <tr>
          <td style="background:#0f2a61;padding:28px 32px;">
            <p style="margin:0;color:#9cb4de;font-size:11px;font-weight:700;
                      letter-spacing:1.4px;text-transform:uppercase;">SecureShare</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:800;
                       font-family:system-ui,-apple-system,sans-serif;">
              Reset your password
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;color:#0f1f3c;font-size:15px;font-weight:600;">
              Hi ${escHtml(name)},
            </p>
            <p style="margin:0 0 24px;color:#66758f;font-size:14px;line-height:1.6;">
              We received a request to reset the password for your SecureShare account.
              Click the button below — this link expires in
              <strong style="color:#0f1f3c;">15 minutes</strong>.
            </p>

            <!-- CTA button -->
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center" style="padding:4px 0 28px;">
                  <a href="${resetUrl}"
                     style="display:inline-block;padding:14px 36px;background:#0f4da8;
                            color:#ffffff;font-size:15px;font-weight:800;border-radius:10px;
                            text-decoration:none;letter-spacing:0.2px;">
                    Reset Password
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 6px;color:#66758f;font-size:12px;">
              Or copy this link into your browser:
            </p>
            <p style="margin:0 0 24px;word-break:break-all;color:#0f4da8;font-size:12px;">
              ${resetUrl}
            </p>

            <hr style="border:none;border-top:1px solid #e5eaf4;margin:0 0 20px;">
            <p style="margin:0;color:#66758f;font-size:12px;line-height:1.6;">
              If you didn't request a password reset, you can safely ignore this email —
              your password will not change.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#f4f7fc;border-top:1px solid #e5eaf4;">
            <p style="margin:0;color:#66758f;font-size:11px;text-align:center;">
              SecureShare &middot; Encrypted File Sharing Platform
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function otpEmailHtml(name: string, otp: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your verification code</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fc;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f4f7fc;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%"
             style="max-width:480px;background:#ffffff;border-radius:16px;
                    overflow:hidden;box-shadow:0 8px 32px rgba(15,42,97,0.12);">

        <!-- Header -->
        <tr>
          <td style="background:#0f2a61;padding:28px 32px;">
            <p style="margin:0;color:#9cb4de;font-size:11px;font-weight:700;
                      letter-spacing:1.4px;text-transform:uppercase;">SecureShare</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:800;
                       font-family:system-ui,-apple-system,sans-serif;">
              Verification code
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;color:#0f1f3c;font-size:15px;font-weight:600;">
              Hi ${escHtml(name)},
            </p>
            <p style="margin:0 0 24px;color:#66758f;font-size:14px;line-height:1.6;">
              Use the code below to verify your identity. It expires in
              <strong style="color:#0f1f3c;">10 minutes</strong>.
            </p>

            <!-- OTP code block -->
            <div style="text-align:center;padding:20px 0 28px;">
              <span style="display:inline-block;padding:18px 44px;background:#e8f1ff;
                           color:#0f4da8;font-size:34px;font-weight:800;border-radius:12px;
                           letter-spacing:10px;font-family:monospace,monospace;">
                ${escHtml(otp)}
              </span>
            </div>

            <hr style="border:none;border-top:1px solid #e5eaf4;margin:0 0 20px;">
            <p style="margin:0;color:#66758f;font-size:12px;line-height:1.6;">
              If you didn't request this code, please ignore this email and
              consider securing your account.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#f4f7fc;border-top:1px solid #e5eaf4;">
            <p style="margin:0;color:#66758f;font-size:11px;text-align:center;">
              SecureShare &middot; Encrypted File Sharing Platform
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function emailVerificationHtml(name: string, verifyUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fc;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f4f7fc;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%"
             style="max-width:480px;background:#ffffff;border-radius:16px;
                    overflow:hidden;box-shadow:0 8px 32px rgba(15,42,97,0.12);">
        <tr>
          <td style="background:#0f2a61;padding:28px 32px;">
            <p style="margin:0;color:#9cb4de;font-size:11px;font-weight:700;
                      letter-spacing:1.4px;text-transform:uppercase;">SecureShare</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:800;
                       font-family:system-ui,-apple-system,sans-serif;">
              Verify your email
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;color:#0f1f3c;font-size:15px;font-weight:600;">
              Hi ${escHtml(name)},
            </p>
            <p style="margin:0 0 24px;color:#66758f;font-size:14px;line-height:1.6;">
              Welcome to SecureShare! Please verify your email address to activate your account.
              This link expires in <strong style="color:#0f1f3c;">24 hours</strong>.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center" style="padding:4px 0 28px;">
                  <a href="${verifyUrl}"
                     style="display:inline-block;padding:14px 36px;background:#0f4da8;
                            color:#ffffff;font-size:15px;font-weight:800;border-radius:10px;
                            text-decoration:none;letter-spacing:0.2px;">
                    Verify Email Address
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;color:#66758f;font-size:12px;">Or copy this link:</p>
            <p style="margin:0 0 24px;word-break:break-all;color:#0f4da8;font-size:12px;">${verifyUrl}</p>
            <hr style="border:none;border-top:1px solid #e5eaf4;margin:0 0 20px;">
            <p style="margin:0;color:#66758f;font-size:12px;line-height:1.6;">
              If you didn't create an account, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#f4f7fc;border-top:1px solid #e5eaf4;">
            <p style="margin:0;color:#66758f;font-size:11px;text-align:center;">
              SecureShare &middot; Encrypted File Sharing Platform
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function utmVerificationHtml(name: string, verifyUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unlock your Student plan</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fc;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f4f7fc;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="100%"
             style="max-width:480px;background:#ffffff;border-radius:16px;
                    overflow:hidden;box-shadow:0 8px 32px rgba(15,42,97,0.12);">
        <tr>
          <td style="background:#0f2a61;padding:28px 32px;">
            <p style="margin:0;color:#9cb4de;font-size:11px;font-weight:700;
                      letter-spacing:1.4px;text-transform:uppercase;">SecureShare</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:800;
                       font-family:system-ui,-apple-system,sans-serif;">
              Unlock Student (Edu) Plan
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;color:#0f1f3c;font-size:15px;font-weight:600;">
              Hi ${escHtml(name)},
            </p>
            <p style="margin:0 0 24px;color:#66758f;font-size:14px;line-height:1.6;">
              Verify this UTM email address to unlock the <strong style="color:#0f1f3c;">Student (Edu)</strong> plan
              — 25 GB storage at no cost. This link expires in
              <strong style="color:#0f1f3c;">30 minutes</strong>.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center" style="padding:4px 0 28px;">
                  <a href="${verifyUrl}"
                     style="display:inline-block;padding:14px 36px;background:#0f4da8;
                            color:#ffffff;font-size:15px;font-weight:800;border-radius:10px;
                            text-decoration:none;letter-spacing:0.2px;">
                    Verify UTM Email &amp; Unlock Plan
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;color:#66758f;font-size:12px;">Or copy this link:</p>
            <p style="margin:0 0 24px;word-break:break-all;color:#0f4da8;font-size:12px;">${verifyUrl}</p>
            <hr style="border:none;border-top:1px solid #e5eaf4;margin:0 0 20px;">
            <p style="margin:0;color:#66758f;font-size:12px;line-height:1.6;">
              If you didn't request this, ignore this email — your account will not be changed.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:#f4f7fc;border-top:1px solid #e5eaf4;">
            <p style="margin:0;color:#66758f;font-size:11px;text-align:center;">
              SecureShare &middot; Encrypted File Sharing Platform
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Public send functions ────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY is not set — skipping email send.');
    console.info(`[email][dev] Password reset URL for ${to}: ${resetUrl}`);
    return;
  }

  const from = process.env.EMAIL_FROM ?? 'SecureShare <noreply@secureshare.app>';

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: 'Reset your SecureShare password',
    html: resetEmailHtml(name, resetUrl),
  });

  if (error) {
    console.error('[email] Failed to send password reset email', { to, error });
    throw new Error('Email delivery failed');
  }

  console.info('[email] Password reset email sent', { to, messageId: data?.id });
}

export async function sendOtpEmail(
  to: string,
  name: string,
  otp: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY is not set — skipping OTP email.');
    console.info(`[email][dev] OTP for ${to}: ${otp}`);
    return;
  }

  const from = process.env.EMAIL_FROM ?? 'SecureShare <noreply@secureshare.app>';

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: 'Your SecureShare verification code',
    html: otpEmailHtml(name, otp),
  });

  if (error) {
    console.error('[email] Failed to send OTP email', { to, error });
    throw new Error('Email delivery failed');
  }

  console.info('[email] OTP email sent', { to, messageId: data?.id });
}

export async function sendEmailVerificationEmail(
  to: string,
  name: string,
  verifyUrl: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email verification send.');
    console.info(`[email][dev] Email verification URL for ${to}: ${verifyUrl}`);
    return;
  }
  const from = process.env.EMAIL_FROM ?? 'SecureShare <noreply@secureshare.app>';
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: 'Verify your SecureShare email address',
    html: emailVerificationHtml(name, verifyUrl),
  });
  if (error) {
    console.error('[email] Failed to send email verification', { to, error });
    throw new Error('Email delivery failed');
  }
  console.info('[email] Email verification sent', { to, messageId: data?.id });
}

export async function sendUtmVerificationEmail(
  to: string,
  name: string,
  verifyUrl: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping UTM verification send.');
    console.info(`[email][dev] UTM verification URL for ${to}: ${verifyUrl}`);
    return;
  }
  const from = process.env.EMAIL_FROM ?? 'SecureShare <noreply@secureshare.app>';
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: 'Verify your UTM email to unlock the Student plan',
    html: utmVerificationHtml(name, verifyUrl),
  });
  if (error) {
    console.error('[email] Failed to send UTM verification', { to, error });
    throw new Error('Email delivery failed');
  }
  console.info('[email] UTM verification email sent', { to, messageId: data?.id });
}
