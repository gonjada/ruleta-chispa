# Ruleta de Premios — Chispa Creativa

Web app de ruleta de premios con clave de acceso, pantalla optimizada para celular/tablet (1080x1920) y panel de administración.

**Ya está deployada y online:**
- Ruleta: https://ruleta-chispa.onrender.com
- Panel admin: https://ruleta-chispa.onrender.com/admin
- Repo: https://github.com/gonjada/ruleta-chispa
- Clave actual: `chispa2026` (cambiala desde el panel admin apenas puedas)

Nota: es el plan free de Render, así que si nadie la usa por un rato "se duerme" y la primera visita tarda ~50 segundos en cargar. Para un evento en vivo, conviene visitar el link un ratito antes para "despertarla", o upgradear a un plan pago si te importa que cargue siempre al instante.

## ¿Qué incluye?

- **Pantalla de juego**: pide clave de ingreso, después el visitante carga su email y gira la ruleta con el botón "¡Girá la Ruleta y Ganá!".
- **Backend real** (Node.js + Express): guarda los premios, sus probabilidades y el registro de todos los que jugaron, compartido entre todos los dispositivos.
- **Panel de administración** (`/admin`): editar el texto de cada premio, su probabilidad (peso), activarlos/desactivarlos, agregar o eliminar premios, ver y exportar (CSV) el registro de participantes, y cambiar la clave de acceso.
- **Un giro por email**: si alguien intenta jugar de nuevo con el mismo mail, la app le avisa y le muestra qué premio ganó la primera vez (no gira de nuevo). Desde el panel admin podés borrar un participante puntual o vaciar todo el registro si necesitás volver a probar.
- **Una sola clave** sirve tanto para entrar a jugar como para entrar al panel admin (como pediste). La clave por defecto es `chispa2026` — cambiala apenas lo subas.
- **Mail automático al ganador**: cuando alguien gana un premio, se le puede mandar un mail automático con el premio. Es personalizable (asunto y cuerpo del mensaje) y podés elegir premio por premio si manda mail o no, con un tilde en el panel admin. Ver la sección "Cómo configurar el envío de mails" más abajo.

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

## Cómo configurar el envío de mails

El mail al ganador se manda por SMTP. Por seguridad, el asistente no puede cargar tus credenciales de mail — las tenés que agregar vos misma directamente en Render (nunca se escriben en el código ni las ve nadie más que vos).

**Pasos:**

1. Conseguí credenciales SMTP. Opciones simples:
   - **Brevo (ex Sendinblue)**: plan gratis, 300 mails/día. Te registrás en [brevo.com](https://www.brevo.com), y en "SMTP & API" te dan host, usuario y clave SMTP.
   - **Gmail con "contraseña de aplicación"**: más simple si ya tenés Gmail, pero menos robusto para volumen. Se genera desde la configuración de seguridad de tu cuenta de Google.
2. En Render, entrá al servicio `ruleta-chispa` → **Environment** → agregá estas variables:

   | Variable | Ejemplo |
   |---|---|
   | `SMTP_HOST` | `smtp-relay.brevo.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_SECURE` | `false` |
   | `SMTP_USER` | tu usuario SMTP |
   | `SMTP_PASS` | tu clave SMTP |
   | `SMTP_FROM` | `Atilio's Sandwich Co. <noreply@atilios.com>` |

3. Guardá — Render reinicia el servicio solo.
4. Entrá a `/admin` → sección **"Email de premio"**: ahí ves si quedó configurado ("✓ Envío de mail configurado"), podés editar el asunto y el cuerpo del mail (con `{{premio}}` como comodín para el nombre del premio ganado), y mandar un mail de prueba a tu propia casilla antes de lanzarlo.
5. En la tabla de premios, cada uno tiene un tilde **"Enviar mail"** — destildalo en los premios que no querés que generen mail (por ejemplo "Segui participando" o "Casi Casi").

Si no configurás estas variables, la app funciona igual (la ruleta gira, el premio se registra), simplemente no se manda ningún mail.

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
├── server.js          → servidor Express, toda la API y el envío de mails
├── db.js              → base de datos (lowdb, archivo JSON)
├── package.json
├── data/db.json        → acá se guardan premios, clave, registro y plantilla de mail
└── public/
    ├── index.html   → pantalla de juego (login + ruleta)
    ├── admin.html   → panel de administración
    ├── style.css    → estilos de la ruleta
    ├── admin.css    → estilos del panel admin
    ├── app.js       → lógica de la ruleta y el giro
    └── admin.js     → lógica del panel admin
```

## Sobre el logo de Atilio's

El logo del pie de página y del header del mail está recreado en HTML/CSS con tipografía (fuente "Bitter"), no es el archivo de imagen real del logo — el asistente no tuvo acceso al archivo de imagen que pegaste en el chat, solo lo vio como referencia visual. Si me pasás el logo como archivo adjunto (PNG con fondo transparente, idealmente en blanco), lo reemplazo por la imagen real.

## Posibles mejoras a futuro

- Logo real de Atilio's como imagen (en vez de texto estilizado).
- Sonido al girar / ganar.

Si querés que sume alguna de estas, avisame.
