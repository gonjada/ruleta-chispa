(function () {
  const loginView = document.getElementById('login-view');
  const adminView = document.getElementById('admin-view');
  const loginPassword = document.getElementById('login-password');
  const loginBtn = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');

  const prizesBody = document.getElementById('prizes-body');
  const prizesMsg = document.getElementById('prizes-msg');
  const newLabel = document.getElementById('new-prize-label');
  const newWeight = document.getElementById('new-prize-weight');
  const addPrizeBtn = document.getElementById('add-prize-btn');

  const regsBody = document.getElementById('regs-body');
  const regCount = document.getElementById('reg-count');
  const refreshRegsBtn = document.getElementById('refresh-regs');
  const clearRegsBtn = document.getElementById('clear-regs');

  const newPassword = document.getElementById('new-password');
  const changePasswordBtn = document.getElementById('change-password-btn');
  const passwordMsg = document.getElementById('password-msg');

  const smtpStatus = document.getElementById('smtp-status');
  const emailSubjectInput = document.getElementById('email-subject');
  const emailBodyInput = document.getElementById('email-body');
  const saveEmailTemplateBtn = document.getElementById('save-email-template-btn');
  const testEmailTo = document.getElementById('test-email-to');
  const sendTestEmailBtn = document.getElementById('send-test-email-btn');
  const emailTemplateMsg = document.getElementById('email-template-msg');

  function showView(view) {
    [loginView, adminView].forEach(v => v.classList.remove('active'));
    view.classList.add('active');
  }

  async function checkSession() {
    const res = await fetch('/api/session');
    const data = await res.json();
    if (data.authenticated) {
      showView(adminView);
      loadPrizes();
      loadRegistrations();
      loadEmailTemplate();
    } else {
      showView(loginView);
    }
  }

  loginBtn.addEventListener('click', doLogin);
  loginPassword.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  async function doLogin() {
    loginError.textContent = '';
    const password = loginPassword.value.trim();
    if (!password) { loginError.textContent = 'Ingresá la clave'; return; }
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (data.ok) {
      showView(adminView);
      loadPrizes();
      loadRegistrations();
      loadEmailTemplate();
    } else {
      loginError.textContent = 'Clave incorrecta';
    }
  }

  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    showView(loginView);
  });

  // ---------- Premios ----------
  async function loadPrizes() {
    const res = await fetch('/api/admin/prizes');
    if (res.status === 401) { showView(loginView); return; }
    const data = await res.json();
    renderPrizes(data.prizes || []);
  }

  function renderPrizes(prizes) {
    const total = prizes.filter(p => p.active).reduce((s, p) => s + Number(p.weight || 0), 0);
    prizesBody.innerHTML = '';
    prizes.forEach(p => {
      const tr = document.createElement('tr');
      if (!p.active) tr.classList.add('inactive-row');

      const prob = total > 0 && p.active ? ((Number(p.weight) / total) * 100).toFixed(1) + '%' : '—';

      tr.innerHTML = `
        <td><input type="text" value="${escapeHtml(p.label)}" data-field="label" /></td>
        <td><input type="number" min="0" value="${p.weight}" data-field="weight" /></td>
        <td class="prob-cell">${prob}</td>
        <td><input type="checkbox" ${p.active ? 'checked' : ''} data-field="active" /></td>
        <td><input type="checkbox" ${p.sendEmail !== false ? 'checked' : ''} data-field="sendEmail" title="Enviar mail con el premio cuando alguien lo gane" /></td>
        <td><button class="delete-btn">Eliminar</button></td>
      `;

      const labelInput = tr.querySelector('[data-field=label]');
      const weightInput = tr.querySelector('[data-field=weight]');
      const activeInput = tr.querySelector('[data-field=active]');
      const sendEmailInput = tr.querySelector('[data-field=sendEmail]');
      const deleteBtn = tr.querySelector('.delete-btn');

      const save = () => updatePrize(p.id, {
        label: labelInput.value,
        weight: Number(weightInput.value),
        active: activeInput.checked,
        sendEmail: sendEmailInput.checked
      });

      labelInput.addEventListener('change', save);
      weightInput.addEventListener('change', save);
      activeInput.addEventListener('change', save);
      sendEmailInput.addEventListener('change', save);
      deleteBtn.addEventListener('click', () => deletePrize(p.id));

      prizesBody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async function updatePrize(id, updates) {
    await fetch(`/api/admin/prizes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    prizesMsg.textContent = 'Guardado ✓';
    setTimeout(() => prizesMsg.textContent = '', 1500);
    loadPrizes();
  }

  async function deletePrize(id) {
    if (!confirm('¿Eliminar este premio?')) return;
    await fetch(`/api/admin/prizes/${id}`, { method: 'DELETE' });
    loadPrizes();
  }

  addPrizeBtn.addEventListener('click', async () => {
    const label = newLabel.value.trim();
    const weight = Number(newWeight.value) || 1;
    if (!label) { prizesMsg.textContent = 'Escribí el texto del premio'; return; }
    await fetch('/api/admin/prizes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, weight })
    });
    newLabel.value = '';
    newWeight.value = 10;
    loadPrizes();
  });

  // ---------- Registro de participantes ----------
  async function loadRegistrations() {
    const res = await fetch('/api/admin/registrations');
    if (res.status === 401) { showView(loginView); return; }
    const data = await res.json();
    const regs = data.registrations || [];
    regCount.textContent = `${regs.length} participaciones`;
    regsBody.innerHTML = '';
    regs.forEach(r => {
      const tr = document.createElement('tr');
      const date = new Date(r.date);
      tr.innerHTML = `
        <td>${escapeHtml(r.email)}</td>
        <td>${escapeHtml(r.prizeLabel)}</td>
        <td>${date.toLocaleString('es-AR')}</td>
        <td><button class="row-delete-btn" data-id="${r.id}">Borrar</button></td>
      `;
      tr.querySelector('.row-delete-btn').addEventListener('click', () => deleteRegistration(r.id));
      regsBody.appendChild(tr);
    });
  }

  async function deleteRegistration(id) {
    if (!confirm('¿Borrar esta participación? La persona va a poder volver a girar con ese email.')) return;
    await fetch(`/api/admin/registrations/${id}`, { method: 'DELETE' });
    loadRegistrations();
  }

  refreshRegsBtn.addEventListener('click', loadRegistrations);

  clearRegsBtn.addEventListener('click', async () => {
    if (!confirm('¿Vaciar TODO el registro de participantes? Esta acción no se puede deshacer y todos van a poder volver a girar.')) return;
    await fetch('/api/admin/registrations', { method: 'DELETE' });
    loadRegistrations();
  });

  // ---------- Clave ----------
  changePasswordBtn.addEventListener('click', async () => {
    const pass = newPassword.value.trim();
    if (pass.length < 4) { passwordMsg.textContent = 'Mínimo 4 caracteres'; passwordMsg.style.color = '#d21f1f'; return; }
    const res = await fetch('/api/admin/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: pass })
    });
    const data = await res.json();
    if (data.ok) {
      passwordMsg.textContent = 'Clave actualizada ✓';
      passwordMsg.style.color = '#2a8a4a';
      newPassword.value = '';
    } else {
      passwordMsg.textContent = data.error || 'Error';
      passwordMsg.style.color = '#d21f1f';
    }
  });

  // ---------- Email de premio ----------
  async function loadEmailTemplate() {
    const res = await fetch('/api/admin/email-template');
    if (res.status === 401) { showView(loginView); return; }
    const data = await res.json();
    emailSubjectInput.value = data.subject || '';
    emailBodyInput.value = data.body || '';
    if (data.smtpConfigured) {
      smtpStatus.textContent = '✓ Envío de mail configurado';
      smtpStatus.style.color = '#2a8a4a';
    } else {
      smtpStatus.textContent = '⚠ Todavía no configuraste el envío de mail (faltan las variables SMTP en el servidor). Los premios se siguen registrando igual, pero no se manda el mail.';
      smtpStatus.style.color = '#c21c1c';
    }
  }

  saveEmailTemplateBtn.addEventListener('click', async () => {
    const subject = emailSubjectInput.value.trim();
    const body = emailBodyInput.value.trim();
    if (!subject || !body) {
      emailTemplateMsg.textContent = 'Completá el asunto y el cuerpo del mail';
      emailTemplateMsg.style.color = '#d21f1f';
      return;
    }
    const res = await fetch('/api/admin/email-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body })
    });
    const data = await res.json();
    if (data.ok) {
      emailTemplateMsg.textContent = 'Plantilla guardada ✓';
      emailTemplateMsg.style.color = '#2a8a4a';
    } else {
      emailTemplateMsg.textContent = data.error || 'Error al guardar';
      emailTemplateMsg.style.color = '#d21f1f';
    }
    setTimeout(() => emailTemplateMsg.textContent = '', 2500);
  });

  sendTestEmailBtn.addEventListener('click', async () => {
    const to = testEmailTo.value.trim();
    if (!to) {
      emailTemplateMsg.textContent = 'Escribí un email para mandar la prueba';
      emailTemplateMsg.style.color = '#d21f1f';
      return;
    }
    sendTestEmailBtn.disabled = true;
    emailTemplateMsg.textContent = 'Enviando...';
    emailTemplateMsg.style.color = '#7a8a99';
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to })
      });
      const data = await res.json();
      if (data.ok) {
        emailTemplateMsg.textContent = 'Mail de prueba enviado ✓';
        emailTemplateMsg.style.color = '#2a8a4a';
      } else {
        emailTemplateMsg.textContent = data.error || 'No se pudo enviar';
        emailTemplateMsg.style.color = '#d21f1f';
      }
    } catch (e) {
      emailTemplateMsg.textContent = 'Error de conexión';
      emailTemplateMsg.style.color = '#d21f1f';
    } finally {
      sendTestEmailBtn.disabled = false;
    }
  });

  checkSession();
})();
