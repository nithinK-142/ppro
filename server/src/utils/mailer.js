const nodemailer = require('nodemailer');
const env = require('../config/env');

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  requireTLS: env.SMTP_REQUIRE_TLS,
  connectionTimeout: env.SMTP_CONNECTION_TIMEOUT_MS,
  greetingTimeout: env.SMTP_GREETING_TIMEOUT_MS,
  socketTimeout: env.SMTP_SOCKET_TIMEOUT_MS
});

async function sendOtp(email, code) {
  if (env.NODE_ENV === 'test') return;

  const expiresIn = env.OTP_EXPIRES_MINUTES;

  await transporter.sendMail({
    from: env.MAIL_FROM,
    to: email,
    subject: 'Your PadosiPro verification code',
    text: [
      'Verify your email for PadosiPro.',
      '',
      `Your verification code: ${code}`,
      '',
      `This code expires in ${expiresIn} minutes.`,
      '',
      "If you didn't request this email, you can ignore it."
    ].join('\n'),
    html: `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Verify your email</title>
        </head>
        <body style="margin:0;padding:0;background:#f5f3ee;color:#1d1d1b;font-family:Arial,Helvetica,sans-serif;">
          <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
            Your PadosiPro verification code is ready.
          </div>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f3ee;">
            <tr>
              <td align="center" style="padding:40px 16px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e1d8;border-radius:18px;overflow:hidden;">
                  <tr>
                    <td style="padding:30px 32px 24px;border-bottom:1px solid #eeeae2;">
                      <div style="font-size:15px;line-height:20px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#a64f38;">
                        PadosiPro
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:36px 32px 12px;">
                      <h1 style="margin:0;font-size:30px;line-height:36px;font-weight:700;color:#1d1d1b;">
                        Verify your email
                      </h1>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 32px 28px;">
                      <p style="margin:0;font-size:16px;line-height:25px;color:#66645f;">
                        Enter the verification code below in the PadosiPro app to verify your email address.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 32px 28px;">
                      <div style="padding:22px 20px;background:#f7f3ec;border:1px solid #e3ddd1;border-radius:14px;text-align:center;">
                        <div style="margin-bottom:8px;font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#8a867d;">
                          Verification code
                        </div>
                        <div style="font-size:34px;line-height:40px;font-weight:700;letter-spacing:8px;color:#1d1d1b;font-family:Arial,Helvetica,sans-serif;">
                          ${code}
                        </div>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 32px 34px;">
                      <p style="margin:0 0 10px;font-size:14px;line-height:21px;color:#66645f;">
                        This code expires in ${expiresIn} minutes.
                      </p>
                      <p style="margin:0;font-size:13px;line-height:20px;color:#8a867d;">
                        If you didn't request this email, you can ignore it.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:20px 32px;background:#1d1d1b;">
                      <p style="margin:0;font-size:12px;line-height:18px;color:#c9c6bf;">
                        This is an automated message. Please don't reply to this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `
  });
}

module.exports = { sendOtp };
