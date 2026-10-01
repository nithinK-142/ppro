const nodemailer = require('nodemailer');
const env = require('../config/env');

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  requireTLS: env.SMTP_REQUIRE_TLS
});

async function sendOtp(email, code) {
  if (env.NODE_ENV === 'test') return;

  await transporter.sendMail({
    from: env.MAIL_FROM,
    to: email,
    subject: 'Your PadosiPro verification code',
    text: `Your PadosiPro verification code is ${code}. It expires in ${env.OTP_EXPIRES_MINUTES} minutes.`,
    html: `<p>Your PadosiPro verification code is <strong>${code}</strong>.</p><p>It expires in ${env.OTP_EXPIRES_MINUTES} minutes.</p>`
  });
}

module.exports = { sendOtp };
