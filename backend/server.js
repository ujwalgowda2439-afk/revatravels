/**
 * REVA Travels — Contact Form Backend
 * Express server for contact form submissions and email enquiries.
 *
 * Run locally:
 *   npm install
 *   npm start
 *
 * Render:
 *   Build command: npm install
 *   Start command: npm start
 */

require('dotenv').config({
  path: './env.revabackend',
});

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// --------------------------------------------------
// CORS CONFIGURATION
// --------------------------------------------------

const allowedOrigins = process.env.ALLOWED_ORIGIN
  ? process.env.ALLOWED_ORIGIN.split(',').map(origin => origin.trim())
  : [
      'https://reva1.vercel.app',
      'http://localhost:3000',
      'http://localhost:5173',
    ];

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed by CORS'));
    },
  })
);

app.use(express.json({ limit: '20kb' }));

// --------------------------------------------------
// ROOT ROUTE
// --------------------------------------------------

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'REVA Travels Backend',
    status: 'running',
    message: 'REVA Travels contact backend is online.',
    endpoints: {
      health: '/api/health',
      contact: '/api/contact',
    },
  });
});

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    service: 'REVA Travels Backend',
    timestamp: new Date().toISOString(),
  });
});

// --------------------------------------------------
// CONTACT FORM RATE LIMITER
// --------------------------------------------------

const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many submissions. Please try again later.',
  },
});

// --------------------------------------------------
// EMAIL CONFIGURATION
// --------------------------------------------------

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: (Number(process.env.SMTP_PORT) || 465) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// --------------------------------------------------
// INPUT HELPERS
// --------------------------------------------------

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --------------------------------------------------
// CONTACT FORM API
// --------------------------------------------------

app.post('/api/contact', contactLimiter, async (req, res) => {
  const {
    first_name = '',
    last_name = '',
    email = '',
    destination = '',
    message = '',
    botcheck = '',
  } = req.body || {};

  // Silently accept submissions that trigger the honeypot.
  if (botcheck) {
    return res.status(200).json({ success: true });
  }

  const firstName = String(first_name).trim();
  const lastName = String(last_name).trim();
  const emailAddr = String(email).trim();

  if (!firstName || !lastName || !emailAddr) {
    return res.status(400).json({
      success: false,
      message: 'First name, last name, and email are required.',
    });
  }

  if (!EMAIL_RE.test(emailAddr)) {
    return res.status(400).json({
      success: false,
      message: 'Please enter a valid email address.',
    });
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('Email configuration is missing.');

    return res.status(500).json({
      success: false,
      message: 'The email service is not configured. Please try again later.',
    });
  }

  const destinationSafe =
    String(destination).trim() || 'Not specified';

  const messageSafe =
    String(message).trim() || '(no message provided)';

  try {
    await transporter.sendMail({
      from:
        '"REVA Travels Website" <' +
        process.env.SMTP_USER +
        '>',

      to: process.env.CONTACT_TO || process.env.SMTP_USER,
      replyTo: emailAddr,

      subject:
        'New enquiry from ' + firstName + ' ' + lastName,

      text: [
        'Name: ' + firstName + ' ' + lastName,
        'Email: ' + emailAddr,
        'Destination interest: ' + destinationSafe,
        '',
        'Message:',
        messageSafe,
      ].join('\n'),

      html:
        '<h2>New enquiry from the REVA Travels website</h2>' +
        '<p><strong>Name:</strong> ' +
        escapeHtml(firstName) +
        ' ' +
        escapeHtml(lastName) +
        '</p>' +
        '<p><strong>Email:</strong> ' +
        escapeHtml(emailAddr) +
        '</p>' +
        '<p><strong>Destination interest:</strong> ' +
        escapeHtml(destinationSafe) +
        '</p>' +
        '<p><strong>Message:</strong></p>' +
        '<p>' +
        escapeHtml(messageSafe).replace(/\n/g, '<br>') +
        '</p>',
    });

    return res.status(200).json({
      success: true,
      message: 'Your enquiry has been sent successfully.',
    });
  } catch (err) {
    console.error('Failed to send contact email:', err);

    return res.status(500).json({
      success: false,
      message: 'Could not send your enquiry. Please try again shortly.',
    });
  }
});

// --------------------------------------------------
// UNKNOWN ROUTES
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found.',
    path: req.path,
  });
});

// --------------------------------------------------
// ERROR HANDLER
// --------------------------------------------------

app.use((err, req, res, next) => {
  if (err.message === 'Origin not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'This website origin is not permitted.',
    });
  }

  console.error('Backend error:', err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred.',
  });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    'REVA Travels backend listening on port ' + PORT
  );
});
```
