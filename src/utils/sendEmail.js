import axios from "axios";
import nodemailer from "nodemailer";

// Render free instances block outbound SMTP ports (25/465/587), so Gmail SMTP
// silently times out in production. When BREVO_API_KEY is set we send over
// Brevo's HTTPS API instead; SMTP is kept as a fallback for local development.

const SENDER_NAME = "Trazoo Global LLP";

// Where admin notifications go. Falls back to the sending mailbox.
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },

  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 12000,
});

const toList = (to) =>
  (Array.isArray(to) ? to : String(to).split(","))
    .map((e) => e.trim())
    .filter(Boolean);

const sendViaBrevo = async ({ to, subject, html, replyTo }) => {
  const senderEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  const { data } = await axios.post(
    "https://api.brevo.com/v3/smtp/email",
    {
      sender: { name: SENDER_NAME, email: senderEmail },
      to: toList(to).map((email) => ({ email })),
      subject,
      htmlContent: html,
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
    },
    {
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      timeout: 15000,
    }
  );

  return data;
};

const sendViaSmtp = ({ to, subject, html, replyTo }) =>
  transporter.sendMail({
    from: `"${SENDER_NAME}" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
  });

const sendEmail = async ({ to, subject, html, replyTo }) => {
  if (!to || toList(to).length === 0) {
    throw new Error("sendEmail: no recipient");
  }

  try {
    if (process.env.BREVO_API_KEY) {
      return await sendViaBrevo({ to, subject, html, replyTo });
    }
    return await sendViaSmtp({ to, subject, html, replyTo });
  } catch (error) {
    // Surface the provider's error body (e.g. unverified sender) in the logs
    const detail = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;
    console.error(`❌ Email to ${to} failed (${subject}):`, detail);
    throw error;
  }
};

export default sendEmail;
