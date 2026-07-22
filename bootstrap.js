// Punto de entrada real de la app (ver package.json: "start": "node bootstrap.js").
// Antes de levantar server.js, intenta restaurar el ultimo estado guardado
// en MongoDB (si esta configurado MONGODB_URI) para que un reinicio del
// contenedor de Render no borre la config ni el registro de participantes.
const { pullFromMongo } = require('./mongoSync');

(async () => {
  await pullFromMongo();
  require('./server.js');
})();
