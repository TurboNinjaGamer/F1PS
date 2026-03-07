const nodemailer = require("nodemailer");

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || "noreply@f1ps.local";


let transporter = null;

if (SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}


async function sendLoginCode(email, code) {
  if (!transporter) {
    console.log(`LOGIN CODE for ${email}: ${code} (no SMTP configured)`);
    return;
  }

  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: "F1PS — your login code",
    text: `Your login code is: ${code}\n\nIt expires in 10 minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 400px;">
        <h2>F1PS Login Code</h2>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px;">${code}</p>
        <p>This code expires in 10 minutes.</p>
      </div>
    `,
  });
}


module.exports = { sendLoginCode };