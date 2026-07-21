const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const adapter = new FileSync(path.join(dataDir, 'db.json'));
const db = low(adapter);

// Datos por defecto la primera vez que se corre la app
db.defaults({
  config: {
    // Clave unica: sirve tanto para entrar a jugar como para entrar al panel admin
    password: 'chispa2026'
  },
  prizes: [
    { id: 1, label: '10% OFF', weight: 20, active: true },
    { id: 2, label: 'Envio Gratis', weight: 15, active: true },
    { id: 3, label: 'Segui participando', weight: 20, active: true },
    { id: 4, label: '2x1', weight: 10, active: true },
    { id: 5, label: 'Regalo Sorpresa', weight: 8, active: true },
    { id: 6, label: '15% OFF', weight: 12, active: true },
    { id: 7, label: 'Casi Casi', weight: 15, active: true },
    { id: 8, label: 'Premio Mayor', weight: 3, active: true },
    { id: 9, label: '20% OFF', weight: 7, active: true },
    { id: 10, label: 'Otra Vuelta', weight: 10, active: true }
  ],
  registrations: [],
  nextPrizeId: 11
}).write();

module.exports = db;
