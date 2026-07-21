# Ruleta de Premios — Chispa Creativa

Web app de ruleta de premios con clave de acceso, pantalla optimizada para celular/tablet (1080x1920) y panel de administración.

## ¿Qué incluye?

- **Pantalla de juego**: pide clave de ingreso, después el visitante carga su email y gira la ruleta con el botón "¡Girá la Ruleta y Ganá!".
- **Backend real** (Node.js + Express): guarda los premios, sus probabilidades y el registro de todos los que jugaron, compartido entre todos los dispositivos.
- **Panel de administración** (`/admin`): editar el texto de cada premio, su probabilidad (peso), activarlos/desactivarlos, agregar o eliminar premios, ver y exportar (CSV) el registro de participantes, y cambiar la clave de acceso.
- **Un giro por email**: si alguien intenta jugar de nuevo con el mismo mail, la app le avisa y le muestra qué premio ganó la primera vez (no gira de nuevo). Desde el panel admin podés borrar un participante puntual o vaciar todo el registro si necesitás volver a probar.
- **Una sola clave** sirve tanto para entrar a jugar como para entrar al panel admin (como pediste). La clave por defecto es `chispa2026` — cambiala apenas lo subas.

## Cómo probarlo en tu computadora

Necesitás tener [Node.js](https://nodejs.org) instalado (versión 18 o superior).

```bash
cd ruleta-app
npm install
npm start
```

Abrí en el navegador:
- Ruleta: `http://localhost:3000`
- Panel admin: `http://localhost:3000/admin`

Clave por defecto: **chispa2026**

## Cómo configurar los premios

1. Entrá a `/admin` con la clave.
2. En "Premios y probabilidades" podés:
   - Editar el texto de cada premio (se actualiza en la ruleta al instante).
   - Cambiar el "peso" de cada uno — la probabilidad se calcula automáticamente como `peso del premio / suma de todos los pesos`. Por ejemplo, si un premio tiene peso 20 y el total de todos los premios activos suma 100, ese premio va a salir el 20% de las veces.
   - Desactivar un premio sin borrarlo (deja de aparecer en la ruleta pero no perdés la configuración).
   - Agregar premios nuevos o eliminar los que no uses.
3. En "Registro de participantes" ves cada email, el premio que ganó y la fecha/hora. Podés exportarlo a CSV con un clic.
4. En "Clave de acceso" podés cambiar la clave en cualquier momento.

## Cómo publicarlo online (para que la gente lo use desde su celular)

La forma más simple y gratuita es con **Render**:

1. Subí esta carpeta a un repositorio de GitHub.
2. Entrá a [render.com](https://render.com) → "New" → "Web Service" → conectá el repo.
3. Configuración:
   - **Build command**: `npm install`
   - **Start command**: `npm start`
4. Deploy. Render te da una URL pública (ej: `https://ruleta-chispa.onrender.com`) que podés compartir por QR o link — se ve perfecto en celular porque está pensada para pantalla vertical tipo mobile.

Alternativas equivalentes: Railway, Fly.io o un VPS propio. Si preferís, te puedo ayudar a dejarlo desplegado paso a paso.

### Importante sobre los datos

Los premios, la clave y el registro de participantes se guardan en el archivo `data/db.json`. En Render (plan free) el disco no es 100% persistente entre reinicios del servicio — si vas a usar esto para un evento real y te importa no perder el registro, avisame y le agrego un "disco persistente" (Render lo ofrece pago) o lo paso a una base de datos en la nube (por ejemplo, Postgres gratis en Neon o Supabase). Para probarlo o usarlo en un evento corto, funciona perfecto tal cual está.

## Estructura del proyecto

```
ruleta-app/
├── server.js          → servidor Express y toda la API
├── db.js              → base de datos (lowdb, archivo JSON)
├── package.json
├── data/db.json        → acá se guardan premios, clave y registro
└── public/
    ├── index.html   → pantalla de juego (login + ruleta)
    ├── admin.html   → panel de administración
    ├── style.css    → estilos de la ruleta
    ├── admin.css    → estilos del panel admin
    ├── app.js       → lógica de la ruleta y el giro
    └── admin.js     → lógica del panel admin
```

## Posibles mejoras a futuro

- Logo de marca en la pantalla de juego.
- Sonido al girar / ganar.
- Envío automático de mail al ganador.

Si querés que sume alguna de estas, avisame.
