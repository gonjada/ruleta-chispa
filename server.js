const express = require('express');
const session = require('express-session');
const path = require('path');
const nodemailer = require('nodemailer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'chispa-creativa-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 12 } // 12hs
}));

// -------- Helpers --------
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ ok: false, error: 'No autenticado' });
}

function pickWeightedPrize(activePrizes) {
  const total = activePrizes.reduce((sum, p) => sum + Number(p.weight || 0), 0);
  if (total <= 0) return activePrizes[Math.floor(Math.random() * activePrizes.length)];
  let r = Math.random() * total;
  for (const p of activePrizes) {
    const w = Number(p.weight || 0);
    if (r < w) return p;
    r -= w;
  }
  return activePrizes[activePrizes.length - 1];
}

// -------- Email de premio --------
let cachedTransporter = null;
let cachedTransporterKey = null;

function getTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null; // Email no configurado todavia: la app sigue funcionando sin mandar mail.

  const key = [host, process.env.SMTP_PORT, process.env.SMTP_USER].join('|');
  if (cachedTransporter && cachedTransporterKey === key) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  });
  cachedTransporterKey = key;
  return cachedTransporter;
}

function buildEmailHtml(bodyText) {
  const safeBody = String(bodyText || '').replace(/\n/g, '<br>');
  const logoUrl = (process.env.PUBLIC_URL || 'https://ruleta-chispa.onrender.com') + '/images/logo-atilios-white.png';
  return `
  <div style="background:#0c2c42;padding:40px 0;font-family:Georgia,'Times New Roman',serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <div style="background:#1c4b6e;padding:30px 20px;text-align:center;">
        <img src="${logoUrl}" alt="Atilio's Sandwich Co." width="220" style="max-width:220px;height:auto;display:inline-block;" />
      </div>
      <div style="padding:36px 30px;color:#1c2b36;font-size:17px;line-height:1.6;">
        ${safeBody}
      </div>
      <div style="padding:18px 30px;background:#f2f6f8;color:#8393a0;font-size:12px;text-align:center;">
        Este mail fue enviado automaticamente desde la ruleta de premios de Atilio's Sandwich Co.
      </div>
    </div>
  </div>`;
}

async function sendPrizeEmail(to, prizeLabel) {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, reason: 'SMTP no configurado' };

  const subjectTemplate = db.get('config.emailSubject').value() || '¡Ganaste!';
  const bodyTemplate = db.get('config.emailBody').value() || 'Ganaste: {{premio}}';
  const subject = subjectTemplate.replace(/{{premio}}/g, prizeLabel);
  const bodyText = bodyTemplate.replace(/{{premio}}/g, prizeLabel);

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text: bodyText,
      html: buildEmailHtml(bodyText)
    });
    return { sent: true };
  } catch (err) {
    console.error('Error enviando mail de premio:', err.message);
    return { sent: false, reason: err.message };
  }
}

// -------- Auth --------
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  const real = db.get('config.password').value();
  if (password && password === real) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: 'Clave incorrecta' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/session', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

// -------- Prizes (publico, solo para pintar la ruleta) --------
app.get('/api/prizes', requireAuth, (req, res) => {
  const prizes = db.get('prizes')
    .filter({ active: true })
    .map(p => ({ id: p.id, label: p.label }))
    .value();
  res.json({ prizes });
});

// -------- Spin --------
app.post('/api/spin', requireAuth, async (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Email invalido' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();

  const previous = db.get('registrations').find({ email: normalizedEmail }).value();
  if (previous) {
    return res.status(409).json({
      ok: false,
      alreadyPlayed: true,
      error: 'Ya jugaste con este email',
      prizeLabel: previous.prizeLabel
    });
  }

  const activePrizes = db.get('prizes').filter({ active: true }).value();
  if (!activePrizes.length) {
    return res.status(400).json({ ok: false, error: 'No hay premios configurados' });
  }

  const winner = pickWeightedPrize(activePrizes);
  const index = activePrizes.findIndex(p => p.id === winner.id);

  const registration = {
    id: Date.now(),
    email: normalizedEmail,
    prizeId: winner.id,
    prizeLabel: winner.label,
    date: new Date().toISOString(),
    emailSent: false
  };
  db.get('registrations').push(registration).write();

  res.json({
    ok: true,
    prizeId: winner.id,
    label: winner.label,
    index,
    total: activePrizes.length
  });

  // El mail se manda despues de responder, para no hacer esperar al usuario girando la ruleta.
  if (winner.sendEmail !== false) {
    try {
      const result = await sendPrizeEmail(normalizedEmail, winner.label);
      if (result.sent) {
        db.get('registrations').find({ id: registration.id }).assign({ emailSent: true }).write();
      }
    } catch (err) {
      console.error('Error en envio de mail post-giro:', err.message);
    }
  }
});

// -------- Admin: premios --------
app.get('/api/admin/prizes', requireAuth, (req, res) => {
  res.json({ prizes: db.get('prizes').value() });
});

app.post('/api/admin/prizes', requireAuth, (req, res) => {
  // Crea un premio nuevo
  const { label, weight, sendEmail } = req.body || {};
  if (!label) return res.status(400).json({ ok: false, error: 'Falta el texto del premio' });
  const nextId = db.get('nextPrizeId').value();
  const prize = {
    id: nextId,
    label: String(label).trim(),
    weight: Number(weight) || 1,
    active: true,
    sendEmail: sendEmail === undefined ? true : !!sendEmail
  };
  db.get('prizes').push(prize).write();
  db.set('nextPrizeId', nextId + 1).write();
  res.json({ ok: true, prize });
});

app.put('/api/admin/prizes/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { label, weight, active, sendEmail } = req.body || {};
  const prize = db.get('prizes').find({ id }).value();
  if (!prize) return res.status(404).json({ ok: false, error: 'Premio no encontrado' });
  const updates = {};
  if (label !== undefined) updates.label = String(label).trim();
  if (weight !== undefined) updates.weight = Number(weight);
  if (active !== undefined) updates.active = !!active;
  if (sendEmail !== undefined) updates.sendEmail = !!sendEmail;
  db.get('prizes').find({ id }).assign(updates).write();
  res.json({ ok: true, prize: db.get('prizes').find({ id }).value() });
});

app.delete('/api/admin/prizes/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  db.get('prizes').remove({ id }).write();
  res.json({ ok: true });
});

// -------- Admin: registro de participantes --------
app.get('/api/admin/registrations', requireAuth, (req, res) => {
  const regs = db.get('registrations').orderBy('date', 'desc').value();
  res.json({ registrations: regs });
});

// Vacia todo el registro (util para testear sin quedar bloqueado por "ya jugaste")
app.delete('/api/admin/registrations', requireAuth, (req, res) => {
  db.set('registrations', []).write();
  res.json({ ok: true });
});

// Elimina un participante puntual del registro (le permite volver a jugar)
app.delete('/api/admin/registrations/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  db.get('registrations').remove({ id }).write();
  res.json({ ok: true });
});

app.get('/api/admin/registrations.csv', requireAuth, (req, res) => {
  const regs = db.get('registrations').orderBy('date', 'desc').value();
  const rows = [['email', 'premio', 'fecha']];
  regs.forEach(r => rows.push([r.email, r.prizeLabel, r.date]));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="registro-ruleta.csv"');
  res.send(csv);
});

// -------- Admin: plantilla de email de premio --------
app.get('/api/admin/email-template', requireAuth, (req, res) => {
  res.json({
    subject: db.get('config.emailSubject').value() || '',
    body: db.get('config.emailBody').value() || '',
    smtpConfigured: !!process.env.SMTP_HOST
  });
});

app.post('/api/admin/email-template', requireAuth, (req, res) => {
  const { subject, body } = req.body || {};
  if (!subject || !body) {
    return res.status(400).json({ ok: false, error: 'Faltan el asunto o el cuerpo del mail' });
  }
  db.set('config.emailSubject', String(subject)).write();
  db.set('config.emailBody', String(body)).write();
  res.json({ ok: true });
});

app.post('/api/admin/test-email', requireAuth, async (req, res) => {
  const { to } = req.body || {};
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
    return res.status(400).json({ ok: false, error: 'Email invalido' });
  }
  if (!process.env.SMTP_HOST) {
    return res.status(400).json({ ok: false, error: 'SMTP no configurado en el servidor todavia' });
  }
  const result = await sendPrizeEmail(String(to).trim().toLowerCase(), 'Premio de prueba');
  if (result.sent) return res.json({ ok: true });
  return res.status(500).json({ ok: false, error: result.reason || 'No se pudo enviar el mail' });
});

// -------- Admin: cambiar la clave --------
app.post('/api/admin/password', requireAuth, (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ ok: false, error: 'La clave debe tener al menos 4 caracteres' });
  }
  db.set('config.password', newPassword).write();
  res.json({ ok: true });
});

// -------- Archivos estaticos --------
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

app.get('/admin', (req, res) => {
  res.sendFile('admin.html', { root: publicDir }, (err) => {
    if (err) {
      console.error('Error sirviendo admin.html:', err.message);
      if (!res.headersSent) res.status(500).send('Error interno');
    }
  });
});

// Fallback para cualquier otra ruta (SPA): usamos app.use en vez de app.get('*', ...)
// para evitar problemas de compatibilidad de path-to-regexp con distintas versiones de Express.
app.use((req, res) => {
  res.sendFile('index.html', { root: publicDir }, (err) => {
    if (err) {
      console.error('Error sirviendo index.html:', err.message);
      if (!res.headersSent) res.status(500).send('Error interno');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Ruleta corriendo en http://localhost:${PORT}`);
});
