const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from:    process.env.EMAIL_FROM || 'Collabify <noreply@collabify.io>',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });
    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error('Email error:', err.message);
    throw err;
  }
};

// Email templates
const emailTemplates = {
  inviteToWorkspace: ({ inviterName, workspaceName, inviteUrl }) => ({
    subject: `${inviterName} invited you to ${workspaceName} on Collabify`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#4F46E5;font-size:28px;margin:0;">Collabify</h1>
        </div>
        <h2 style="color:#1F2937;">You've been invited!</h2>
        <p style="color:#6B7280;font-size:16px;">
          <strong>${inviterName}</strong> has invited you to join the workspace
          <strong>${workspaceName}</strong> on Collabify.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${inviteUrl}" style="background:#4F46E5;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
            Accept Invitation
          </a>
        </div>
        <p style="color:#9CA3AF;font-size:14px;">This invitation expires in 7 days.</p>
      </div>
    `,
  }),

  resetPassword: ({ name, resetUrl }) => ({
    subject: 'Reset your Collabify password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#4F46E5;font-size:28px;margin:0;">Collabify</h1>
        </div>
        <h2 style="color:#1F2937;">Reset your password</h2>
        <p style="color:#6B7280;font-size:16px;">Hi ${name}, click below to reset your password.</p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${resetUrl}" style="background:#4F46E5;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
            Reset Password
          </a>
        </div>
        <p style="color:#9CA3AF;font-size:14px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>
    `,
  }),

  welcomeEmail: ({ name }) => ({
    subject: 'Welcome to Collabify!',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;margin-bottom:32px;">
          <h1 style="color:#4F46E5;font-size:28px;margin:0;">Collabify</h1>
        </div>
        <h2 style="color:#1F2937;">Welcome, ${name}! 🎉</h2>
        <p style="color:#6B7280;font-size:16px;">
          Your account has been created. Start collaborating with your team today.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="${process.env.CLIENT_URL}" style="background:#4F46E5;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
            Get Started
          </a>
        </div>
      </div>
    `,
  }),
};

module.exports = { sendEmail, emailTemplates };
