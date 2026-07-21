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
    const maxFont = n > 10 ? 34 : n > 7 ? 40 : 46;
    prizes.forEach((p, i) => {
      const angle = step * i + step / 2;
      const label = document.createElement('div');
      label.className = 'slice-label';
      label.style.transform = `rotate(${angle}deg)`;
      const span = document.createElement('span');
      span.textContent = p.label;
      // Una sola linea "de costado" siempre: el tamaño de letra se achica según
      // el largo del texto para que nunca se corte en dos renglones.
      const len = p.label.length;
      const fitFont = Math.round(340 / (len * 0.58));
      const fontSize = Math.max(20, Math.min(maxFont, fitFont));
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
