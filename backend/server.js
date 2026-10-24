/**
 * REVA Travels — contact form backend
 * -----------------------------------
 * A small Express server with one job: receive the contact form's data
 * from the website, validate it, and email it to revatravels01@gmail.com
 * (or whichever address you set in .env). Nothing is stored on disk —
 * see README.md if you'd rather log submissions to a database later.
 *
 * Run it:
 *   1. npm install
 *   2. copy .env.example to .env and fill in your values
 *   3. npm start
 */

require('dotenv').config({ path: './env.revabackend' });
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// ---- Basic hardening -------------------------------------------------
// Only allow requests from your own site's origin(s). During local testing
// this stays permissive; set ALLOWED_ORIGIN in .env once you deploy.
const allowedOrigin = process.env.ALLOWED_ORIGIN; // e.g. https://revatravels.com
app.use(cors({
  origin: allowedOrigin ? allowedOrigin.split(',').map(o => o.trim()) : '*',
}));

app.use(express.json({ limit: '20kb' })); // form data is tiny; reject anything absurd

// Limit each IP to 5 submissions per 10 minutes — enough for a real
// visitor, not enough for a script hammering the endpoint.
const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many submissions — please try again later.' },
});

// ---- Mailer ------------------------------------------------------------
// Uses Gmail SMTP with an "app password" (not your normal Gmail password —
// see README.md for how to generate one). Swap this transporter for any
// other SMTP provider (SendGrid, Mailgun, your host's mail server, etc.)
// by changing the values in .env; the rest of the file doesn't need to change.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true, // true for port 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Basic email format check — good enough to catch typos and bots without
// dragging in a full validation library for one field.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

app.post('/api/contact', contactLimiter, async (req, res) => {
  const {
    first_name = '',
    last_name = '',
    email = '',
    destination = '',
    message = '',
    botcheck = '', // honeypot — real visitors never see or fill this field
  } = req.body || {};

  // Honeypot tripped: silently pretend success so the bot doesn't learn anything.
  if (botcheck) {
    return res.json({ success: true });
  }

  const firstName = String(first_name).trim();
  const lastName = String(last_name).trim();
  const emailAddr = String(email).trim();

  if (!firstName || !lastName || !emailAddr) {
    return res.status(400).json({ success: false, message: 'First name, last name, and email are required.' });
  }
  if (!EMAIL_RE.test(emailAddr)) {
    return res.status(400).json({ success: false, message: 'That email address doesn\'t look valid.' });
  }

  const destinationSafe = String(destination).trim() || 'Not specified';
  const messageSafe = String(message).trim() || '(no message provided)';

  try {
    await transporter.sendMail({
      from: `"REVA Travels Website" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_TO || process.env.SMTP_USER,
      replyTo: emailAddr, // hit "reply" in your inbox and it goes straight to the visitor
      subject: `New enquiry from ${firstName} ${lastName}`,
      text: [
        `Name: ${firstName} ${lastName}`,
        `Email: ${emailAddr}`,
        `Destination interest: ${destinationSafe}`,
        '',
        'Message:',
        messageSafe,
      ].join('\n'),
      html: `
        <h2>New enquiry from the REVA Travels website</h2>
        <p><b>Name:</b> ${escapeHtml(firstName)} ${escapeHtml(lastName)}</p>
        <p><b>Email:</b> ${escapeHtml(emailAddr)}</p>
        <p><b>Destination interest:</b> ${escapeHtml(destinationSafe)}</p>
        <p><b>Message:</b></p>
        <p>${escapeHtml(messageSafe).replace(/\n/g, '<br>')}</p>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to send contact email:', err);
    res.status(500).json({ success: false, message: 'Could not send the enquiry — please try again shortly.' });
  }
});

// Simple health check — useful once this is deployed, to confirm it's alive.
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`REVA Travels contact backend listening on port ${PORT}`);
});