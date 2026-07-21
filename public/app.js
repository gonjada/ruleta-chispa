(function () {
  const stage = document.getElementById('stage');
  const screenLogin = document.getElementById('screen-login');
  const screenGame = document.getElementById('screen-game');
  const loginPassword = document.getElementById('login-password');
  const loginBtn = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');
  const emailInput = document.getElementById('email-input');
  const emailError = document.getElementById('email-error');
  const spinBtn = document.getElementById('spin-btn');
  const wheelEl = document.getElementById('wheel');
  const modal = document.getElementById('prize-modal');
  const modalClose = document.getElementById('modal-close');
  const prizeText = document.getElementById('prize-text');

  let currentRotation = 0;
  let spinning = false;

  function scaleStage() {
    const scale = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
    stage.style.transform = `scale(${scale})`;
    stage.style.left = (window.innerWidth - 1080 * scale) / 2 + 'px';
    stage.style.top = (window.innerHeight - 1920 * scale) / 2 + 'px';
  }
  window.addEventListener('resize', scaleStage);
  scaleStage();

  function showScreen(el) {
    [screenLogin, screenGame].forEach(s => s.classList.remove('active'));
    el.classList.add('active');
  }

  function validateEmail(email) {
    return /^\S+@\S+\.\S+$/.test(email);
  }

  async function buildWheel() {
    const res = await fetch('/api/prizes');
    const data = await res.json();
    const prizes = data.prizes || [];
    const n = prizes.length;
    if (!n) return;
    const step = 360 / n;

    const gradientParts = prizes.map((_, i) => {
      const hue = (48 + i * (360 / n)) % 360;
      const color = `hsl(${hue}, 88%, 56%)`;
      return `${color} ${i * step}deg ${(i + 1) * step}deg`;
    });
    wheelEl.style.background = `conic-gradient(${gradientParts.join(',')})`;

    wheelEl.innerHTML = '';
    prizes.forEach((p, i) => {
      const angle = step * i + step / 2;
      const label = document.createElement('div');
      label.className = 'slice-label';
      // El contenedor solo se encarga de UBICAR el texto en el sector correcto.
      label.style.transform = `rotate(${angle}deg)`;

      const span = document.createElement('span');
      span.textContent = p.label;

      // Orientacion "radial" (girada 90° respecto de como estaba antes): el
      // texto corre a lo largo del radio en vez de a lo largo del arco. Esto
      // evita que los premios se pisen entre sectores vecinos (el texto ocupa
      // poco ancho tangencial) y es como pidió Maru, en el estilo del "20% OFF"
      // de referencia. Se suma un giro de 180° extra para los premios de la
      // mitad "inferior" (ángulo entre 180° y 360°) para que no queden cabeza
      // abajo, sin mover su posición (la rotación es sobre el propio centro
      // del span, no sobre el centro de la ruleta).
      const normalized = ((angle % 360) + 360) % 360;
      const needsFlip = normalized > 180 && normalized < 360;
      const spanRotation = -90 + (needsFlip ? 180 : 0);
      span.style.transform = `rotate(${spanRotation}deg)`;

      // Tamaño de letra y salto de renglón según el largo del texto: los
      // premios cortos ("2x1", "20% OFF") entran en un renglón grande; los
      // largos ("Segui participando") se acomodan en dos renglones más chicos.
      const len = p.label.length;
      let fontSize;
      if (len <= 7) fontSize = 42;
      else if (len <= 12) fontSize = 32;
      else fontSize = 26;
      span.style.fontSize = fontSize + 'px';

      label.appendChild(span);
      wheelEl.appendChild(label);
    });

    wheelEl.dataset.total = n;
  }

  async function checkSession() {
    const res = await fetch('/api/session');
    const data = await res.json();
    if (data.authenticated) {
      showScreen(screenGame);
      buildWheel();
    } else {
      showScreen(screenLogin);
    }
  }

  loginBtn.addEventListener('click', doLogin);
  loginPassword.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  async function doLogin() {
    loginError.textContent = '';
    const password = loginPassword.value.trim();
    if (!password) { loginError.textContent = 'Ingresá la clave'; return; }
    loginBtn.disabled = true;
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.ok) {
        showScreen(screenGame);
        buildWheel();
      } else {
        loginError.textContent = 'Clave incorrecta';
      }
    } catch (e) {
      loginError.textContent = 'Error de conexión';
    } finally {
      loginBtn.disabled = false;
    }
  }

  spinBtn.addEventListener('click', async () => {
    if (spinning) return;
    emailError.textContent = '';
    const email = emailInput.value.trim();
    if (!validateEmail(email)) {
      emailError.textContent = 'Ingresá un email válido';
      return;
    }

    spinning = true;
    spinBtn.disabled = true;

    try {
      const res = await fetch('/api/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (!data.ok) {
        if (data.alreadyPlayed) {
          emailError.textContent = `Ya jugaste con este email. Tu premio fue: ${data.prizeLabel}`;
        } else {
          emailError.textContent = data.error || 'No se pudo girar la ruleta';
        }
        spinning = false;
        spinBtn.disabled = false;
        return;
      }

      const total = data.total;
      const step = 360 / total;
      const targetCenter = data.index * step + step / 2;
      const randomOffset = (Math.random() - 0.5) * step * 0.6;
      const desiredFinalMod = (360 - (targetCenter + randomOffset) + 360) % 360;
      const currentMod = ((currentRotation % 360) + 360) % 360;
      let delta = desiredFinalMod - currentMod;
      if (delta < 0) delta += 360;
      const extraSpins = 6 * 360;
      currentRotation = currentRotation + extraSpins + delta;

      wheelEl.style.transition = 'transform 4.6s cubic-bezier(0.15, 0.65, 0.25, 1)';
      wheelEl.style.transform = `rotate(${currentRotation}deg)`;

      setTimeout(() => {
        prizeText.textContent = data.label;
        modal.classList.remove('hidden');
        spinning = false;
        spinBtn.disabled = false;
      }, 4700);

    } catch (e) {
      emailError.textContent = 'Error de conexión';
      spinning = false;
      spinBtn.disabled = false;
    }
  });

  modalClose.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  checkSession();
})();
