const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const adapter = new FileSync(path.join(dataDir, 'db.json'));
const db = low(adapter);

const DEFAULT_EMAIL_SUBJECT = "¡Ganaste en la ruleta de Atilio's!";
const DEFAULT_EMAIL_BODY =
  '¡Felicitaciones! 🎉\n\n' +
  'Ganaste: {{premio}}\n\n' +
  'Mostrá este mail en el local para reclamar tu premio.\n\n' +
  '¡Gracias por participar!';

// Datos por defecto la primera vez que se corre la app
db.defaults({
  config: {
    // Clave unica: sirve tanto para entrar a jugar como para entrar al panel admin
    password: 'chispa2026',
    emailSubject: DEFAULT_EMAIL_SUBJECT,
    emailBody: DEFAULT_EMAIL_BODY,
    // Configuracion SMTP cargada desde el panel admin (alternativa a las
    // variables de entorno de Render). Si "host" esta vacio, el servidor usa
    // las variables de entorno como respaldo.
    smtp: { host: '', port: 587, user: '', pass: '', from: '', secure: false },
    // Configuracion de Brevo (API HTTPS): alternativa al SMTP para hostings
    // que bloquean los puertos de SMTP (como el plan free de Render).
    brevo: { apiKey: '', senderEmail: '', senderName: "Atilio's Sandwich Co." }
  },
  prizes: [
    { id: 1, label: '10% OFF', weight: 20, active: true, sendEmail: true, allowReplay: false },
    { id: 2, label: 'Envio Gratis', weight: 15, active: true, sendEmail: true, allowReplay: false },
    { id: 3, label: 'Segui participando', weight: 20, active: true, sendEmail: false, allowReplay: false },
    { id: 4, label: '2x1', weight: 10, active: true, sendEmail: true, allowReplay: false },
    { id: 5, label: 'Regalo Sorpresa', weight: 8, active: true, sendEmail: true, allowReplay: false },
    { id: 6, label: '15% OFF', weight: 12, active: true, sendEmail: true, allowReplay: false },
    { id: 7, label: 'Casi Casi', weight: 15, active: true, sendEmail: false, allowReplay: false },
    { id: 8, label: 'Premio Mayor', weight: 3, active: true, sendEmail: true, allowReplay: false },
    { id: 9, label: '20% OFF', weight: 7, active: true, sendEmail: true, allowReplay: false },
    { id: 10, label: 'Otra Vuelta', weight: 10, active: true, sendEmail: false, allowReplay: false }
  ],
  registrations: [],
  nextPrizeId: 11
}).write();

// -------- Migracion: completa campos nuevos en bases de datos ya existentes --------
// (db.defaults() solo agrega claves de primer nivel que no existan; si el archivo
// db.json ya tenia "config" o "prizes" de una version anterior, hay que rellenar
// a mano los campos nuevos que agregamos despues).
let needsWrite = false;

const prizesNow = db.get('prizes').value() || [];
prizesNow.forEach((p) => {
  if (p.sendEmail === undefined) {
    p.sendEmail = true;
    needsWrite = true;
  }
  if (p.allowReplay === undefined) {
    p.allowReplay = false;
    needsWrite = true;
  }
});
if (needsWrite) db.set('prizes', prizesNow).write();

if (db.get('config.emailSubject').value() === undefined) {
  db.set('config.emailSubject', DEFAULT_EMAIL_SUBJECT).write();
}
if (db.get('config.emailBody').value() === undefined) {
  db.set('config.emailBody', DEFAULT_EMAIL_BODY).write();
}
if (db.get('config.smtp').value() === undefined) {
  db.set('config.smtp', { host: '', port: 587, user: '', pass: '', from: '', secure: false }).write();
}
if (db.get('config.brevo').value() === undefined) {
  db.set('config.brevo', { apiKey: '', senderEmail: '', senderName: "Atilio's Sandwich Co." }).write();
}

module.exports = db;
