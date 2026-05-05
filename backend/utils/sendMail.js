const nodemailer = require("nodemailer");

const isSmtpConfigured = () => {
  const mail = process.env.SMPT_MAIL && String(process.env.SMPT_MAIL).trim();
  const pass =
    process.env.SMPT_PASSWORD && String(process.env.SMPT_PASSWORD).trim();
  if (!mail || !pass) return false;
  const host = process.env.SMPT_HOST && String(process.env.SMPT_HOST).trim();
  const service =
    process.env.SMPT_SERVICE && String(process.env.SMPT_SERVICE).trim();
  return Boolean(host || service);
};

const sendMail = async (options) => {
  if (!isSmtpConfigured()) {
    throw new Error(
      "SMTP is not configured. Set SMPT_MAIL, SMPT_PASSWORD, and either SMPT_HOST (plus SMPT_PORT) or SMPT_SERVICE in backend/config/.env — or use RESET_PASSWORD_DEV_LINK=true for local dev only."
    );
  }

  const host = process.env.SMPT_HOST && String(process.env.SMPT_HOST).trim();
  const service =
    process.env.SMPT_SERVICE && String(process.env.SMPT_SERVICE).trim();
  const transportOpts = {
    auth: {
      user: process.env.SMPT_MAIL,
      pass: process.env.SMPT_PASSWORD,
    },
  };
  if (service) {
    transportOpts.service = service;
  }
  if (host) {
    transportOpts.host = host;
    if (process.env.SMPT_PORT) {
      transportOpts.port = Number(process.env.SMPT_PORT);
    }
  }

  const transporter = nodemailer.createTransport(transportOpts);
  const mailOptions = {
    from: process.env.SMPT_MAIL,
    to: options.email,
    subject: options.subject,
    text: options.message,
  };
  await transporter.sendMail(mailOptions);
};

sendMail.isSmtpConfigured = isSmtpConfigured;
module.exports = sendMail;
