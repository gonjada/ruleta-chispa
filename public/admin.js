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

  const brevoConfigStatus = document.getElementById('brevo-config-status');
  const brevoApiKeyInput = document.getElementById('brevo-api-key');
  const brevoSenderEmailInput = document.getElementById('brevo-sender-email');
  const brevoSenderNameInput = document.getElementById('brevo-sender-name');
  const saveBrevoBtn = document.getElementById('save-brevo-btn');
  const clearBrevoBtn = document.getElementById('clear-brevo-btn');
  const brevoConfigMsg = document.getElementById('brevo-config-msg');

  const smtpConfigStatus = document.getElementById('smtp-config-status');
  const smtpHostInput = document.getElementById('smtp-host');
  const smtpPortInput = document.getElementById('smtp-port');
  const smtpUserInput = document.getElementById('smtp-user');
  const smtpPassInput = document.getElementById('smtp-pass');
  const smtpFromInput = document.getElementById('smtp-from');
  const smtpSecureInput = document.getElementById('smtp-secure');
  const saveSmtpBtn = document.getElementById('save-smtp-btn');
  const clearSmtpBtn = document.getElementById('clear-smtp-btn');
  const smtpConfigMsg = document.getElementById('smtp-config-msg');

  const bannerPreviewWrap = document.getElementById('banner-preview-wrap');
  const bannerPreview = document.getElementById('banner-preview');
  const bannerStatus = document.getElementById('banner-status');
  const bannerFileInput = document.getElementById('banner-file');
  const uploadBannerBtn = document.getElementById('upload-banner-btn');
  const removeBannerBtn = document.getElementById('remove-banner-btn');
  const bannerMsg = document.getElementById('banner-msg');

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
      loadBrevoConfig();
      loadSmtpConfig();
      loadBanner();
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
      loadBrevoConfig();
      loadSmtpConfig();
      loadBanner();
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
        <td><input type="checkbox" ${p.allowReplay ? 'checked' : ''} data-field="allowReplay" title="Si lo gana, puede volver a girar con el mismo email" /></td>
        <td><button class="delete-btn">Eliminar</button></td>
      `;

      const labelInput = tr.querySelector('[data-field=label]');
      const weightInput = tr.querySelector('[data-field=weight]');
      const activeInput = tr.querySelector('[data-field=active]');
      const sendEmailInput = tr.querySelector('[data-field=sendEmail]');
      const allowReplayInput = tr.querySelector('[data-field=allowReplay]');
      const deleteBtn = tr.querySelector('.delete-btn');

      const save = () => updatePrize(p.id, {
        label: labelInput.value,
        weight: Number(weightInput.value),
        active: activeInput.checked,
        sendEmail: sendEmailInput.checked,
        allowReplay: allowReplayInput.checked
      });

      labelInput.addEventListener('change', save);
      weightInput.addEventListener('change', save);
      activeInput.addEventListener('change', save);
      sendEmailInput.addEventListener('change', save);
      allowReplayInput.addEventListener('change', save);
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
        <td><button class="row-delete-btn resend-btn" data-id="${r.id}">Reenviar mail</button></td>
        <td><button class="row-delete-btn" data-id="${r.id}">Borrar</button></td>
      `;
      const resendBtn = tr.querySelector('.resend-btn');
      resendBtn.addEventListener('click', () => resendEmail(r.id, resendBtn));
      tr.querySelector('.row-delete-btn:not(.resend-btn)').addEventListener('click', () => deleteRegistration(r.id));
      regsBody.appendChild(tr);
    });
  }

  async function deleteRegistration(id) {
    if (!confirm('¿Borrar esta participación? La persona va a poder volver a girar con ese email.')) return;
    await fetch(`/api/admin/registrations/${id}`, { method: 'DELETE' });
    loadRegistrations();
  }

  async function resendEmail(id, btn) {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    try {
      const res = await fetch(`/api/admin/registrations/${id}/resend-email`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        btn.textContent = 'Enviado ✓';
      } else {
        btn.textContent = 'Error';
        btn.title = data.error || 'No se pudo enviar el mail';
        alert(data.error || 'No se pudo enviar el mail');
      }
    } catch (e) {
      btn.textContent = 'Error';
      alert('Error de conexión');
    } finally {
      setTimeout(() => {
        btn.textContent = original;
        btn.disabled = false;
        btn.title = '';
      }, 2500);
    }
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
      smtpStatus.textContent = '⚠ Todavía no configuraste el envío de mail. Completá la sección "Configuración SMTP" de arriba. Los premios se siguen registrando igual, pero no se manda el mail.';
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

  // ---------- Brevo (API HTTPS) ----------
  async function loadBrevoConfig() {
    const res = await fetch('/api/admin/brevo-config');
    if (res.status === 401) { showView(loginView); return; }
    const data = await res.json();
    brevoSenderEmailInput.value = data.senderEmail || '';
    brevoSenderNameInput.value = data.senderName || '';
    brevoApiKeyInput.value = '';
    brevoApiKeyInput.placeholder = data.hasApiKey
      ? '•••••••• (dejar vacío para no cambiarla)'
      : '(sin API key guardada)';

    if (data.hasApiKey) {
      brevoConfigStatus.textContent = '✓ Brevo configurado — se usa por sobre el SMTP';
      brevoConfigStatus.style.color = '#2a8a4a';
    } else {
      brevoConfigStatus.textContent = 'Todavía no cargaste tu API key de Brevo';
      brevoConfigStatus.style.color = '#7a8a99';
    }
  }

  saveBrevoBtn.addEventListener('click', async () => {
    const senderEmail = brevoSenderEmailInput.value.trim();
    if (!senderEmail) {
      brevoConfigMsg.textContent = 'Completá al menos el email remitente';
      brevoConfigMsg.style.color = '#d21f1f';
      return;
    }
    const payload = {
      senderEmail,
      senderName: brevoSenderNameInput.value.trim()
    };
    if (brevoApiKeyInput.value.trim()) payload.apiKey = brevoApiKeyInput.value.trim();

    const res = await fetch('/api/admin/brevo-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) {
      brevoConfigMsg.textContent = 'Configuración de Brevo guardada ✓';
      brevoConfigMsg.style.color = '#2a8a4a';
      loadBrevoConfig();
      loadEmailTemplate();
    } else {
      brevoConfigMsg.textContent = data.error || 'Error al guardar';
      brevoConfigMsg.style.color = '#d21f1f';
    }
    setTimeout(() => brevoConfigMsg.textContent = '', 3000);
  });

  clearBrevoBtn.addEventListener('click', async () => {
    if (!confirm('¿Borrar la configuración de Brevo? Si hay SMTP configurado abajo, la app va a volver a usar eso.')) return;
    await fetch('/api/admin/brevo-config', { method: 'DELETE' });
    loadBrevoConfig();
    loadEmailTemplate();
  });

  // ---------- Configuración SMTP ----------
  async function loadSmtpConfig() {
    const res = await fetch('/api/admin/smtp-config');
    if (res.status === 401) { showView(loginView); return; }
    const data = await res.json();
    smtpHostInput.value = data.host || '';
    smtpPortInput.value = data.port || 587;
    smtpUserInput.value = data.user || '';
    smtpFromInput.value = data.from || '';
    smtpSecureInput.checked = !!data.secure;
    smtpPassInput.value = '';
    smtpPassInput.placeholder = data.hasPassword
      ? '•••••••• (dejar vacío para no cambiarla)'
      : '(sin contraseña guardada)';

    if (data.configuredHere) {
      smtpConfigStatus.textContent = '✓ Configuración SMTP guardada acá en el panel';
      smtpConfigStatus.style.color = '#2a8a4a';
    } else if (data.usingEnvFallback) {
      smtpConfigStatus.textContent = 'ℹ Usando variables de entorno configuradas en Render (no hay nada guardado acá todavía)';
      smtpConfigStatus.style.color = '#7a8a99';
    } else {
      smtpConfigStatus.textContent = '⚠ Todavía no configuraste el envío de mail';
      smtpConfigStatus.style.color = '#c21c1c';
    }
  }

  saveSmtpBtn.addEventListener('click', async () => {
    const host = smtpHostInput.value.trim();
    if (!host) {
      smtpConfigMsg.textContent = 'Completá al menos el host SMTP';
      smtpConfigMsg.style.color = '#d21f1f';
      return;
    }
    const payload = {
      host,
      port: Number(smtpPortInput.value) || 587,
      user: smtpUserInput.value.trim(),
      from: smtpFromInput.value.trim(),
      secure: smtpSecureInput.checked
    };
    if (smtpPassInput.value.trim()) payload.pass = smtpPassInput.value.trim();

    const res = await fetch('/api/admin/smtp-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) {
      smtpConfigMsg.textContent = 'Configuración SMTP guardada ✓';
      smtpConfigMsg.style.color = '#2a8a4a';
      loadSmtpConfig();
      loadEmailTemplate();
    } else {
      smtpConfigMsg.textContent = data.error || 'Error al guardar';
      smtpConfigMsg.style.color = '#d21f1f';
    }
    setTimeout(() => smtpConfigMsg.textContent = '', 3000);
  });

  clearSmtpBtn.addEventListener('click', async () => {
    if (!confirm('¿Borrar la configuración SMTP guardada acá? Si hay variables SMTP en Render, la app va a volver a usarlas.')) return;
    await fetch('/api/admin/smtp-config', { method: 'DELETE' });
    loadSmtpConfig();
    loadEmailTemplate();
  });

  // ---------- Banner del mail (zócalo) ----------
  async function loadBanner() {
    const res = await fetch('/api/admin/email-banner');
    if (res.status === 401) { showView(loginView); return; }
    const data = await res.json();
    if (data.hasBanner) {
      bannerPreview.src = data.url;
      bannerPreviewWrap.classList.remove('hidden');
      bannerStatus.textContent = '✓ Banner cargado, se incluye en el mail de premio';
      bannerStatus.style.color = '#2a8a4a';
    } else {
      bannerPreviewWrap.classList.add('hidden');
      bannerStatus.textContent = 'Todavía no subiste ningún banner';
      bannerStatus.style.color = '#7a8a99';
    }
  }

  uploadBannerBtn.addEventListener('click', async () => {
    const file = bannerFileInput.files[0];
    if (!file) {
      bannerMsg.textContent = 'Elegí un archivo JPG primero';
      bannerMsg.style.color = '#d21f1f';
      return;
    }
    uploadBannerBtn.disabled = true;
    bannerMsg.textContent = 'Subiendo...';
    bannerMsg.style.color = '#7a8a99';
    try {
      const formData = new FormData();
      formData.append('banner', file);
      const res = await fetch('/api/admin/email-banner', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.ok) {
        bannerMsg.textContent = 'Banner subido ✓';
        bannerMsg.style.color = '#2a8a4a';
        bannerFileInput.value = '';
        loadBanner();
      } else {
        bannerMsg.textContent = data.error || 'No se pudo subir el banner';
        bannerMsg.style.color = '#d21f1f';
      }
    } catch (e) {
      bannerMsg.textContent = 'Error de conexión';
      bannerMsg.style.color = '#d21f1f';
    } finally {
      uploadBannerBtn.disabled = false;
    }
  });

  removeBannerBtn.addEventListener('click', async () => {
    if (!confirm('¿Quitar el banner del mail de premio?')) return;
    await fetch('/api/admin/email-banner', { method: 'DELETE' });
    loadBanner();
  });

  checkSession();
})();
