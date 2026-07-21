const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const multer = require('multer');
const sizeOf = require('image-size');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// -------- Banner del mail (zocalo) --------
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const BANNER_PATH = path.join(uploadsDir, 'email-banner.jpg');

function bannerExists() {
  try {
    return fs.existsSync(BANNER_PATH) && fs.statSync(BANNER_PATH).size > 0;
  } catch (e) {
    return false;
  }
}
const BANNER_MAX_WIDTH = 800;
const BANNER_MAX_HEIGHT = 400;

const bannerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg') return cb(null, true);
    cb(new Error('El banner debe ser un archivo JPG'));
  }
});

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

// Devuelve la configuracion SMTP activa: primero la cargada desde el panel
// admin (guardada en la base), y si no hay nada cargado ahi, cae a las
// variables de entorno de Render (compatibilidad con la configuracion
// anterior). Devuelve null si no hay SMTP configurado por ningun lado.
function getSmtpConfig() {
  const dbConfig = db.get('config.smtp').value() || {};
  if (dbConfig.host) {
    return {
      source: 'db',
      host: dbConfig.host,
      port: Number(dbConfig.port) || 587,
      secure: !!dbConfig.secure,
      user: dbConfig.user || '',
      pass: dbConfig.pass || '',
      from: dbConfig.from || dbConfig.user || ''
    };
  }
  if (process.env.SMTP_HOST) {
    return {
      source: 'env',
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || process.env.SMTP_USER || ''
    };
  }
  return null;
}

function getTransporter() {
  const cfg = getSmtpConfig();
  if (!cfg) return null; // Email no configurado todavia: la app sigue funcionando sin mandar mail.

  const key = [cfg.source, cfg.host, cfg.port, cfg.user, cfg.secure].join('|');
  if (cachedTransporter && cachedTransporterKey === key) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined
  });
  cachedTransporterKey = key;
  return cachedTransporter;
}

function buildEmailHtml(bodyText) {
  const safeBody = String(bodyText || '').replace(/\n/g, '<br>');
  const logoUrl = (process.env.PUBLIC_URL || 'https://ruleta-chispa.onrender.com') + '/images/logo-atilios-white.png';
  const hasBanner = bannerExists();
  const bannerUrl = (process.env.PUBLIC_URL || 'https://ruleta-chispa.onrender.com') + '/uploads/email-banner.jpg?v=' + Date.now();
  const bannerHtml = hasBanner
    ? `<div style="line-height:0;"><img src="${bannerUrl}" alt="" width="480" style="width:100%;max-width:480px;height:auto;display:block;" /></div>`
    : '';
  return `
  <div style="background:#0c2c42;padding:40px 0;font-family:Georgia,'Times New Roman',serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <div style="background:#1c4b6e;padding:30px 20px;text-align:center;">
        <img src="${logoUrl}" alt="Atilio's Sandwich Co." width="220" style="max-width:220px;height:auto;display:inline-block;" />
      </div>
      <div style="padding:36px 30px;color:#1c2b36;font-size:17px;line-height:1.6;">
        ${safeBody}
      </div>
      ${bannerHtml}
      <div style="padding:18px 30px;background:#f2f6f8;color:#8393a0;font-size:12px;text-align:center;">
        Este mail fue enviado automaticamente desde la ruleta de premios de Atilio's Sandwich Co.
      </div>
    </div>
  </div>`;
}

async function sendPrizeEmail(to, prizeLabel) {
  const transporter = getTransporter();
  if (!transporter) return { sent: false, reason: 'SMTP no configurado' };
  const cfg = getSmtpConfig();

  // Fecha del dia en que se manda el mail (no la fecha en que jugo la persona),
  // para el placeholder {{fecha}} usado en la frase de validez del premio.
  const fecha = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

  const subjectTemplate = db.get('config.emailSubject').value() || '¡Ganaste!';
  const bodyTemplate = db.get('config.emailBody').value() || 'Ganaste: {{premio}}';
  const subject = subjectTemplate.replace(/{{premio}}/g, prizeLabel).replace(/{{fecha}}/g, fecha);
  const bodyText = bodyTemplate.replace(/{{premio}}/g, prizeLabel).replace(/{{fecha}}/g, fecha);

  try {
    await transporter.sendMail({
      from: cfg.from,
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

// Reenvia el mail de premio a un participante ya registrado (por si no le llego,
// o para reenviarlo si lo pide de nuevo)
app.post('/api/admin/registrations/:id/resend-email', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const reg = db.get('registrations').find({ id }).value();
  if (!reg) return res.status(404).json({ ok: false, error: 'Registro no encontrado' });
  if (!getSmtpConfig()) {
    return res.status(400).json({ ok: false, error: 'SMTP no configurado en el servidor todavia' });
  }
  const result = await sendPrizeEmail(reg.email, reg.prizeLabel);
  if (result.sent) {
    db.get('registrations').find({ id }).assign({ emailSent: true }).write();
    return res.json({ ok: true });
  }
  return res.status(500).json({ ok: false, error: result.reason || 'No se pudo enviar el mail' });
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
    smtpConfigured: !!getSmtpConfig()
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
  if (!getSmtpConfig()) {
    return res.status(400).json({ ok: false, error: 'SMTP no configurado en el servidor todavia' });
  }
  const result = await sendPrizeEmail(String(to).trim().toLowerCase(), 'Premio de prueba');
  if (result.sent) return res.json({ ok: true });
  return res.status(500).json({ ok: false, error: result.reason || 'No se pudo enviar el mail' });
});

// -------- Admin: configuracion SMTP (se guarda en la base, no en el codigo) --------
app.get('/api/admin/smtp-config', requireAuth, (req, res) => {
  const cfg = db.get('config.smtp').value() || {};
  const envAvailable = !!process.env.SMTP_HOST;
  res.json({
    host: cfg.host || '',
    port: cfg.port || 587,
    user: cfg.user || '',
    from: cfg.from || '',
    secure: !!cfg.secure,
    hasPassword: !!cfg.pass,
    configuredHere: !!cfg.host,
    usingEnvFallback: !cfg.host && envAvailable
  });
});

app.post('/api/admin/smtp-config', requireAuth, (req, res) => {
  const { host, port, user, pass, from, secure } = req.body || {};
  if (!host) {
    return res.status(400).json({ ok: false, error: 'Falta el host SMTP' });
  }
  const existing = db.get('config.smtp').value() || {};
  const updated = {
    host: String(host).trim(),
    port: Number(port) || 587,
    user: user !== undefined ? String(user).trim() : (existing.user || ''),
    from: from !== undefined ? String(from).trim() : (existing.from || ''),
    secure: !!secure,
    // Si no mandan una clave nueva, se conserva la que ya estaba guardada
    // (asi Maru no tiene que reescribir la clave cada vez que edita otro campo).
    pass: (pass && String(pass).trim()) ? String(pass).trim() : (existing.pass || '')
  };
  db.set('config.smtp', updated).write();
  cachedTransporter = null;
  cachedTransporterKey = null;
  res.json({ ok: true });
});

app.delete('/api/admin/smtp-config', requireAuth, (req, res) => {
  db.set('config.smtp', { host: '', port: 587, user: '', pass: '', from: '', secure: false }).write();
  cachedTransporter = null;
  cachedTransporterKey = null;
  res.json({ ok: true });
});

// -------- Admin: banner (zocalo) del mail de premio --------
app.get('/api/admin/email-banner', requireAuth, (req, res) => {
  const has = bannerExists();
  res.json({ hasBanner: has, url: has ? ('/uploads/email-banner.jpg?v=' + Date.now()) : null });
});

app.post('/api/admin/email-banner', requireAuth, (req, res) => {
  bannerUpload.single('banner')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ ok: false, error: err.message || 'No se pudo subir el banner' });
    }
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Falta el archivo del banner' });
    }
    let dimensions;
    try {
      dimensions = sizeOf(req.file.buffer);
    } catch (e) {
      return res.status(400).json({ ok: false, error: 'El archivo no parece ser una imagen JPG valida' });
    }
    if (dimensions.width > BANNER_MAX_WIDTH || dimensions.height > BANNER_MAX_HEIGHT) {
      return res.status(400).json({
        ok: false,
        error: `La imagen es de ${dimensions.width}x${dimensions.height}px. El máximo permitido es ${BANNER_MAX_WIDTH}x${BANNER_MAX_HEIGHT}px.`
      });
    }
    fs.writeFileSync(BANNER_PATH, req.file.buffer);
    res.json({ ok: true, url: '/uploads/email-banner.jpg?v=' + Date.now() });
  });
});

app.delete('/api/admin/email-banner', requireAuth, (req, res) => {
  try {
    if (fs.existsSync(BANNER_PATH)) fs.unlinkSync(BANNER_PATH);
    return res.json({ ok: true });
  } catch (err) {
    // Si por algun motivo no se puede borrar el archivo, lo vaciamos en vez de
    // fallar: un JPG de 0 bytes no es una imagen valida, asi que buildEmailHtml
    // (via fs.existsSync + sizeOf mas adelante) deja de incluirlo igual.
    try {
      fs.writeFileSync(BANNER_PATH, Buffer.alloc(0));
    } catch (err2) {
      console.error('No se pudo borrar ni vaciar el banner:', err2.message);
      return res.status(500).json({ ok: false, error: 'No se pudo quitar el banner' });
    }
    return res.json({ ok: true });
  }
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
