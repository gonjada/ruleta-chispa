// -------- Respaldo/restauracion contra MongoDB Atlas (free tier) --------
// Render (plan free) usa disco efimero: cuando el servicio queda inactivo y
// se reinicia, todo lo que este en data/db.json y public/uploads se borra.
// Este modulo mantiene una copia remota en MongoDB Atlas y la restaura al
// arrancar, para que la config (Brevo/SMTP, premios, clave, banner) y el
// registro de participantes sobrevivan a esos reinicios.
//
// No hace falta tocar el hosting propio ni el DNS: solo se necesita crear un
// cluster gratis (M0) en https://cloud.mongodb.com y cargar el connection
// string como variable de entorno MONGODB_URI en Render (Settings -> Environment).
// Si MONGODB_URI no esta configurada, la app sigue funcionando igual que antes
// (sin respaldo remoto).

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const BANNER_FILE = path.join(__dirname, 'public', 'uploads', 'email-banner.jpg');
const DB_NAME = 'ruleta';
const COLLECTION = 'estado';
const DOC_ID = 'main';

let lastSnapshotKey = '';
let syncing = false;

function readLocalSnapshot() {
  let dbJson = null;
  try {
    dbJson = fs.readFileSync(DB_FILE, 'utf8');
  } catch (e) {
    // todavia no existe el archivo local
  }
  let bannerBase64 = null;
  try {
    if (fs.existsSync(BANNER_FILE) && fs.statSync(BANNER_FILE).size > 0) {
      bannerBase64 = fs.readFileSync(BANNER_FILE).toString('base64');
    }
  } catch (e) {
    // sin banner cargado
  }
  return { dbJson, bannerBase64 };
}

async function withClient(fn) {
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

// Se llama una sola vez al arrancar, antes de levantar Express: trae el
// ultimo estado guardado en Mongo (si existe) y lo escribe en el disco local
// para que db.js (lowdb) lo cargue como si nunca se hubiera perdido.
async function pullFromMongo() {
  if (!MONGODB_URI) {
    console.log('MONGODB_URI no configurada: sin respaldo remoto. Si Render reinicia el disco, se pierde la config y el registro de participantes.');
    return;
  }
  try {
    await withClient(async (client) => {
      const doc = await client.db(DB_NAME).collection(COLLECTION).findOne({ _id: DOC_ID });
      if (!doc) {
        console.log('No hay respaldo previo en MongoDB, arranca con valores por defecto.');
        return;
      }
      if (doc.dbJson) {
        fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
        fs.writeFileSync(DB_FILE, doc.dbJson);
        console.log('Datos restaurados desde MongoDB (config, premios, participantes).');
      }
      if (doc.bannerBase64) {
        fs.mkdirSync(path.dirname(BANNER_FILE), { recursive: true });
        fs.writeFileSync(BANNER_FILE, Buffer.from(doc.bannerBase64, 'base64'));
        console.log('Banner de mail restaurado desde MongoDB.');
      }
      lastSnapshotKey = JSON.stringify({ dbJson: doc.dbJson || null, bannerBase64: doc.bannerBase64 || null });
    });
  } catch (err) {
    console.error('No se pudo restaurar desde MongoDB, sigo con el archivo local:', err.message);
  }
}

// Sube el estado actual a Mongo si cambio desde la ultima vez. Se usa tanto
// en el intervalo periodico como despues de acciones importantes (un giro).
async function pushToMongo() {
  if (!MONGODB_URI) return;
  if (syncing) return; // evita solapar sincronizaciones
  const snapshot = readLocalSnapshot();
  const snapshotKey = JSON.stringify(snapshot);
  if (snapshotKey === lastSnapshotKey) return; // sin cambios, no gasto escritura
  syncing = true;
  try {
    await withClient(async (client) => {
      await client.db(DB_NAME).collection(COLLECTION).updateOne(
        { _id: DOC_ID },
        { $set: { dbJson: snapshot.dbJson, bannerBase64: snapshot.bannerBase64, updatedAt: new Date() } },
        { upsert: true }
      );
    });
    lastSnapshotKey = snapshotKey;
  } catch (err) {
    console.error('Error guardando respaldo en MongoDB:', err.message);
  } finally {
    syncing = false;
  }
}

// Sincronizacion periodica + guardado final antes de que Render apague el
// contenedor (SIGTERM en un redeploy o al escalar a cero por inactividad).
function startAutoSync(intervalMs = 20000) {
  if (!MONGODB_URI) return;
  setInterval(() => { pushToMongo(); }, intervalMs);

  const finalSync = async (signal) => {
    console.log(`Señal ${signal} recibida, guardando estado en MongoDB antes de salir...`);
    await pushToMongo();
    process.exit(0);
  };
  process.on('SIGTERM', () => finalSync('SIGTERM'));
  process.on('SIGINT', () => finalSync('SIGINT'));
}

module.exports = { pullFromMongo, pushToMongo, startAutoSync };
