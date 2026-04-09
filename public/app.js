// ══════════════════════════════════════════════════════════════════════════════
//  QA App — Frontend Logic
//  Cada página llama a su initXxx() en DOMContentLoaded.
// ══════════════════════════════════════════════════════════════════════════════

// ── Tema (ejecuta inmediatamente para evitar flash) ───────────────────────────
(function () {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

// ── Constantes ─────────────────────────────────────────────────────────────────
const API = '/api';

const TIPO_ICONS   = { historia: '📗', bug: '🐛', tarea: '✅', epica: '⚡' };
const TIPO_LABELS  = { historia: 'Historia', bug: 'Bug', tarea: 'Tarea', epica: 'Épica' };
const PRIO_COLORS  = { critica: '#dc3545', alta: '#fd7e14', media: '#ffc107', baja: '#adb5bd' };
const PRIO_LABELS  = { critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja' };
const STATUS_LABELS = { backlog: 'Backlog', en_progreso: 'En Progreso', en_revision: 'En Revisión', listo: 'Listo' };

// ── Helpers de auth ──────────────────────────────────────────────────────────
function getToken()  { return localStorage.getItem('qa_token'); }
function getUser()   { return JSON.parse(localStorage.getItem('qa_user') || 'null'); }
function setAuth(token, user) {
  localStorage.setItem('qa_token', token);
  localStorage.setItem('qa_user', JSON.stringify(user));
}
function clearAuth() {
  localStorage.removeItem('qa_token');
  localStorage.removeItem('qa_user');
}

function requireAuth() {
  if (!getToken()) { window.location.href = '/index.html'; return false; }
  return true;
}

function logout() {
  clearAuth();
  window.location.href = '/index.html';
}

// ── API fetch helper ──────────────────────────────────────────────────────────
async function api(method, endpoint, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  const token = getToken();
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body)  opts.body = JSON.stringify(body);

  const res = await fetch(API + endpoint, opts);

  if (res.status === 401) {
    clearAuth();
    window.location.href = '/index.html';
    return null;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

// ── Theme toggle ──────────────────────────────────────────────────────────────
window.toggleTheme = function () {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = next === 'dark' ? '☀️' : '🌙';
  });
};

function syncThemeButton() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = current === 'dark' ? '☀️' : '🌙';
  });
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
window.showModal = function (id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
};
window.hideModal = function (id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
};

function showError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

// ── Formateo de fecha ─────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function avatarInitials(username) {
  return (username || '?').slice(0, 2).toUpperCase();
}

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE: LOGIN / REGISTER
// ══════════════════════════════════════════════════════════════════════════════
function initLogin() {
  syncThemeButton();

  // Redirigir si ya está autenticado
  if (getToken()) { window.location.href = '/proyectos.html'; return; }

  const panelLogin    = document.getElementById('panel-login');
  const panelRegistro = document.getElementById('panel-registro');
  const irARegistro   = document.getElementById('ir-a-registro');
  const irALogin      = document.getElementById('ir-a-login');

  irARegistro?.addEventListener('click', (e) => {
    e.preventDefault();
    panelLogin.style.display    = 'none';
    panelRegistro.style.display = 'block';
    showError('login-error', '');
  });

  irALogin?.addEventListener('click', (e) => {
    e.preventDefault();
    panelRegistro.style.display = 'none';
    panelLogin.style.display    = 'block';
    showError('register-error', '');
  });

  // ── Login form ──
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('login-error', '');
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Iniciando…';
    try {
      const data = await api('POST', '/auth/login', {
        email:    document.getElementById('login-email').value.trim(),
        password: document.getElementById('login-password').value
      });
      setAuth(data.token, data.user);
      window.location.href = '/proyectos.html';
    } catch (err) {
      showError('login-error', err.message);
      btn.disabled = false;
      btn.textContent = 'Iniciar sesión';
    }
  });

  // ── Register form ──
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('register-error', '');
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Creando cuenta…';
    try {
      const data = await api('POST', '/auth/register', {
        username: document.getElementById('reg-username').value.trim(),
        email:    document.getElementById('reg-email').value.trim(),
        password: document.getElementById('reg-password').value
      });
      setAuth(data.token, data.user);
      window.location.href = '/proyectos.html';
    } catch (err) {
      showError('register-error', err.message);
      btn.disabled = false;
      btn.textContent = 'Crear cuenta';
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE: PROYECTOS
// ══════════════════════════════════════════════════════════════════════════════
async function initProyectos() {
  syncThemeButton();
  if (!requireAuth()) return;

  const user = getUser();
  const userNameEl = document.getElementById('user-name');
  if (userNameEl) userNameEl.textContent = user?.username || '';

  injectAdminLink();
  await renderProyectos();

  // Botón nuevo proyecto
  document.getElementById('btn-nuevo-proyecto')?.addEventListener('click', () => {
    showError('proj-error', '');
    document.getElementById('form-nuevo-proyecto')?.reset();
    showModal('modal-proyecto');
    document.getElementById('proj-nombre')?.focus();
  });

  // Auto-generar clave desde nombre
  document.getElementById('proj-nombre')?.addEventListener('input', (e) => {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
    // Toma las primeras letras de cada palabra, hasta 6 chars
    const words = e.target.value.trim().split(/\s+/);
    let clave = words.map(w => w[0] || '').join('').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
    if (!clave) clave = raw.slice(0, 6);
    document.getElementById('proj-clave').value = clave;
  });

  // Forzar mayúsculas en clave
  document.getElementById('proj-clave')?.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
  });

  // Form crear proyecto
  document.getElementById('form-nuevo-proyecto')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('proj-error', '');
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await api('POST', '/proyectos', {
        nombre:      document.getElementById('proj-nombre').value.trim(),
        clave:       document.getElementById('proj-clave').value.trim(),
        descripcion: document.getElementById('proj-descripcion').value.trim()
      });
      hideModal('modal-proyecto');
      await renderProyectos();
    } catch (err) {
      showError('proj-error', err.message);
    } finally {
      btn.disabled = false;
    }
  });

  // Cerrar modal al hacer clic fuera
  document.getElementById('modal-proyecto')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideModal('modal-proyecto');
  });
}

async function renderProyectos() {
  const grid = document.getElementById('proyectos-grid');
  grid.innerHTML = '<div class="empty-state">Cargando proyectos…</div>';

  try {
    const proyectos = await api('GET', '/proyectos');
    if (!proyectos || proyectos.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" data-testid="empty-proyectos">
          <p>No tienes proyectos todavía.</p>
          <p>¡Crea el primero con el botón <strong>+ Nuevo proyecto</strong>!</p>
        </div>`;
      return;
    }

    grid.innerHTML = proyectos.map(p => `
      <a href="/board.html?proyecto=${p.id}" class="project-card"
         data-testid="project-card-${p.clave}" data-proyecto-id="${p.id}">
        <div class="project-card-header">
          <span class="project-key-badge" data-testid="project-key-${p.clave}">${p.clave}</span>
          <span class="role-badge role-${p.rol}" data-testid="project-rol-${p.clave}">${p.rol}</span>
        </div>
        <div class="project-card-name" data-testid="project-nombre-${p.clave}">${esc(p.nombre)}</div>
        <div class="project-card-desc">${esc(p.descripcion || 'Sin descripción')}</div>
        <div class="project-card-stats">
          <span data-testid="project-issues-${p.clave}">${p.issues_abiertos} issue${p.issues_abiertos !== 1 ? 's' : ''} abierto${p.issues_abiertos !== 1 ? 's' : ''}</span>
        </div>
      </a>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE: BOARD
// ══════════════════════════════════════════════════════════════════════════════
async function initBoard() {
  syncThemeButton();
  if (!requireAuth()) return;

  const params = new URLSearchParams(window.location.search);
  const proyectoId = params.get('proyecto');
  if (!proyectoId) { window.location.href = '/proyectos.html'; return; }

  const user = getUser();
  const userNameEl = document.getElementById('user-name');
  if (userNameEl) userNameEl.textContent = user?.username || '';

  try {
    const proyecto = await api('GET', `/proyectos/${proyectoId}`);
    if (!proyecto) return;

    document.title = `${proyecto.clave} Board — QA App`;
    document.getElementById('proyecto-nombre').textContent = proyecto.nombre;
    document.getElementById('proyecto-clave-breadcrumb').textContent = proyecto.clave;
    document.getElementById('nav-proyecto-link') &&
      (document.getElementById('nav-proyecto-link').href = `/board.html?proyecto=${proyectoId}`);

    window._proyectoActual = proyecto;

    // Cargar miembros para filtro y modal
    const miembros = await api('GET', `/proyectos/${proyectoId}/miembros`);
    window._miembros = miembros || [];

    const filterAsig = document.getElementById('filter-asignado');
    const modalAsig  = document.getElementById('issue-asignado');
    miembros.forEach(m => {
      if (filterAsig) filterAsig.innerHTML += `<option value="${m.id}">${m.username}</option>`;
      if (modalAsig)  modalAsig.innerHTML  += `<option value="${m.id}">${m.username}</option>`;
    });

    await renderBoard(proyectoId);

    // Botón crear issue
    document.getElementById('btn-nuevo-issue')?.addEventListener('click', () => {
      showError('issue-modal-error', '');
      document.getElementById('form-nuevo-issue')?.reset();
      showModal('modal-issue');
      document.getElementById('issue-titulo')?.focus();
    });

    // Limpiar filtros
    document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
      document.getElementById('filter-tipo').value = '';
      document.getElementById('filter-prioridad').value = '';
      document.getElementById('filter-asignado').value = '';
      renderBoard(proyectoId);
    });

    // Filtros
    ['filter-tipo', 'filter-prioridad', 'filter-asignado'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => renderBoard(proyectoId));
    });

    // Form crear issue
    document.getElementById('form-nuevo-issue')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('issue-modal-error', '');
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        await api('POST', `/proyectos/${proyectoId}/issues`, {
          titulo:      document.getElementById('issue-titulo').value.trim(),
          descripcion: document.getElementById('issue-descripcion').value.trim(),
          tipo:        document.getElementById('issue-tipo').value,
          prioridad:   document.getElementById('issue-prioridad').value,
          status:      document.getElementById('issue-status').value,
          asignado_a:  document.getElementById('issue-asignado').value || null
        });
        hideModal('modal-issue');
        await renderBoard(proyectoId);
      } catch (err) {
        showError('issue-modal-error', err.message);
      } finally {
        btn.disabled = false;
      }
    });

    // Cerrar modal fuera
    document.getElementById('modal-issue')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) hideModal('modal-issue');
    });

  } catch (err) {
    document.getElementById('board-alert').innerHTML =
      `<div class="alert alert-error">${esc(err.message)}</div>`;
  }
}

async function renderBoard(proyectoId) {
  const tipo      = document.getElementById('filter-tipo')?.value || '';
  const prioridad = document.getElementById('filter-prioridad')?.value || '';
  const asignado  = document.getElementById('filter-asignado')?.value || '';

  const qs = new URLSearchParams();
  if (tipo)      qs.set('tipo', tipo);
  if (prioridad) qs.set('prioridad', prioridad);
  if (asignado)  qs.set('asignado', asignado);

  const issues = await api('GET', `/proyectos/${proyectoId}/issues?${qs}`);
  if (!issues) return;

  const cols = { backlog: [], en_progreso: [], en_revision: [], listo: [] };
  issues.forEach(i => { if (cols[i.status]) cols[i.status].push(i); });

  Object.keys(cols).forEach(status => {
    const cards = document.getElementById(`cards-${status}`);
    const count = document.getElementById(`count-${status}`);
    if (!cards) return;

    count && (count.textContent = cols[status].length);

    if (cols[status].length === 0) {
      cards.innerHTML = '<div class="board-empty" data-testid="board-empty">Sin issues</div>';
    } else {
      cards.innerHTML = cols[status].map(issue => issueCardHTML(issue)).join('');
    }
  });

  initDragDrop(proyectoId);
}

function issueCardHTML(issue) {
  const clave     = issue.proyecto?.clave || '';
  const prioColor = PRIO_COLORS[issue.prioridad] || '#adb5bd';
  const tipoIcon  = TIPO_ICONS[issue.tipo] || '✅';
  const asignado  = issue.asignado;

  return `
    <div class="issue-card" data-id="${issue.id}" data-status="${issue.status}"
         data-testid="issue-card-${clave}-${issue.numero}">
      <div class="issue-card-meta">
        <span class="issue-key" data-testid="issue-key-${clave}-${issue.numero}">${clave}-${issue.numero}</span>
        <span class="type-icon" title="${TIPO_LABELS[issue.tipo] || ''}">${tipoIcon}</span>
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${prioColor};flex-shrink:0;"
              title="${PRIO_LABELS[issue.prioridad] || ''}"></span>
      </div>
      <a href="/issue.html?id=${issue.id}" class="issue-card-title"
         data-testid="issue-title-${clave}-${issue.numero}">${esc(issue.titulo)}</a>
      <div class="issue-card-footer">
        ${asignado
          ? `<span class="avatar-chip" title="${esc(asignado.username)}"
                   data-testid="avatar-${clave}-${issue.numero}">${avatarInitials(asignado.username)}</span>`
          : ''}
        <span style="font-size:.7rem;font-weight:600;color:${prioColor};"
              data-testid="prio-${clave}-${issue.numero}">${PRIO_LABELS[issue.prioridad] || ''}</span>
      </div>
    </div>`;
}

function initDragDrop(proyectoId) {
  if (typeof Sortable === 'undefined') return;

  document.querySelectorAll('.board-cards').forEach(container => {
    if (container._sortable) { container._sortable.destroy(); }

    container._sortable = Sortable.create(container, {
      group:      'board',
      animation:  150,
      ghostClass: 'sortable-ghost',
      dragClass:  'sortable-drag',
      onEnd: async (evt) => {
        const issueId   = evt.item.dataset.id;
        const newStatus = evt.to.closest('.board-column')?.dataset.status;
        if (!newStatus || !issueId) return;

        try {
          await api('PATCH', `/issues/${issueId}/status`, { status: newStatus });
          // Actualizar contadores sin re-renderizar todo
          const oldStatus = evt.from.closest('.board-column')?.dataset.status;
          if (oldStatus) {
            const oldCount = document.getElementById(`count-${oldStatus}`);
            if (oldCount) oldCount.textContent = evt.from.querySelectorAll('.issue-card').length;
          }
          const newCount = document.getElementById(`count-${newStatus}`);
          if (newCount) newCount.textContent = evt.to.querySelectorAll('.issue-card').length;

          // Quitar mensaje "Sin issues" si la columna destino tenía ese estado
          const emptyMsg = evt.to.querySelector('.board-empty');
          if (emptyMsg) emptyMsg.remove();

          // Agregar mensaje "Sin issues" si la columna origen quedó vacía
          if (evt.from.querySelectorAll('.issue-card').length === 0) {
            evt.from.innerHTML = '<div class="board-empty">Sin issues</div>';
          }
        } catch (err) {
          console.error('Drag & drop error:', err.message);
          // Revertir visualmente re-renderizando
          renderBoard(proyectoId);
        }
      }
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE: ISSUE DETAIL
// ══════════════════════════════════════════════════════════════════════════════
async function initIssue() {
  syncThemeButton();
  if (!requireAuth()) return;

  const params  = new URLSearchParams(window.location.search);
  const issueId = params.get('id');
  if (!issueId) { window.location.href = '/proyectos.html'; return; }

  const user = getUser();
  const userNameEl = document.getElementById('user-name');
  if (userNameEl) userNameEl.textContent = user?.username || '';

  try {
    const [issue, comentarios, historial] = await Promise.all([
      api('GET', `/issues/${issueId}`),
      api('GET', `/issues/${issueId}/comentarios`),
      api('GET', `/issues/${issueId}/historial`)
    ]);
    if (!issue) return;

    window._issueActual = issue;

    // Cargar miembros
    const miembros = await api('GET', `/proyectos/${issue.proyecto_id}/miembros`);
    window._miembros = miembros || [];

    // Mostrar contenido
    document.getElementById('issue-loading').style.display = 'none';
    document.getElementById('issue-container').style.display = 'block';

    renderIssueDetail(issue, comentarios, historial, miembros);
    bindIssueEvents(issueId, issue);

  } catch (err) {
    document.getElementById('issue-loading').textContent = `Error: ${err.message}`;
  }
}

function renderIssueDetail(issue, comentarios, historial, miembros) {
  const clave = issue.proyecto?.clave || '';

  // Navegación
  document.title = `${clave}-${issue.numero} — QA App`;
  setTextContent('nav-issue-key', `${clave}-${issue.numero}`);
  const navLink = document.getElementById('nav-proyecto-link');
  if (navLink) {
    navLink.textContent = issue.proyecto?.nombre || clave;
    navLink.href = `/board.html?proyecto=${issue.proyecto_id}`;
  }
  const breadProj = document.getElementById('breadcrumb-proyecto');
  if (breadProj) {
    breadProj.textContent = issue.proyecto?.nombre || clave;
    breadProj.href = `/board.html?proyecto=${issue.proyecto_id}`;
  }
  setTextContent('breadcrumb-issue-key', `${clave}-${issue.numero}`);

  // Cabecera del issue
  setTextContent('issue-key-display', `${clave}-${issue.numero}`);

  const tipoBadge = document.getElementById('issue-tipo-badge');
  if (tipoBadge) {
    tipoBadge.textContent = `${TIPO_ICONS[issue.tipo] || ''} ${TIPO_LABELS[issue.tipo] || issue.tipo}`;
  }

  const prioBadge = document.getElementById('issue-prioridad-badge');
  if (prioBadge) {
    prioBadge.textContent = PRIO_LABELS[issue.prioridad] || issue.prioridad;
    prioBadge.style.background = PRIO_COLORS[issue.prioridad] || '#adb5bd';
    prioBadge.style.color = ['critica', 'alta'].includes(issue.prioridad) ? '#fff' : '#333';
  }

  // Título
  const tituloDisplay = document.getElementById('issue-titulo-display');
  const tituloEdit    = document.getElementById('issue-titulo-edit');
  if (tituloDisplay) tituloDisplay.textContent = issue.titulo;
  if (tituloEdit)    tituloEdit.value          = issue.titulo;

  // Descripción
  const descDisplay = document.getElementById('issue-desc-display');
  const descEdit    = document.getElementById('issue-desc-edit');
  if (descDisplay) {
    if (issue.descripcion) {
      descDisplay.textContent = issue.descripcion;
    } else {
      descDisplay.innerHTML = '<span style="color:var(--text-muted);">Sin descripción — haz clic para agregar</span>';
    }
  }
  if (descEdit) descEdit.value = issue.descripcion || '';

  // Sidebar
  setSelectValue('sidebar-status',    issue.status);
  setSelectValue('sidebar-tipo',      issue.tipo);
  setSelectValue('sidebar-prioridad', issue.prioridad);

  // Poblar asignado
  const sideAsig = document.getElementById('sidebar-asignado');
  if (sideAsig) {
    sideAsig.innerHTML = '<option value="">Sin asignar</option>';
    (miembros || []).forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.username;
      sideAsig.appendChild(opt);
    });
    sideAsig.value = issue.asignado_a || '';
  }

  // Campos readonly
  const reportadoEl = document.getElementById('sidebar-reportado');
  if (reportadoEl) {
    reportadoEl.textContent = issue.reportado?.username || '—';
  }
  setTextContent('sidebar-created', fmtDate(issue.created_at));
  setTextContent('sidebar-updated', fmtDate(issue.updated_at));

  // Comentarios
  renderComentarios(comentarios || []);

  // Historial
  renderHistorial(historial || []);
}

function renderComentarios(comentarios) {
  const lista = document.getElementById('lista-comentarios');
  if (!lista) return;
  const user = getUser();

  if (comentarios.length === 0) {
    lista.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem;">Sin comentarios aún.</p>';
    return;
  }

  lista.innerHTML = comentarios.map(c => `
    <div class="comment" data-testid="comentario-${c.id}">
      <div class="comment-header">
        <span class="avatar-chip" style="width:1.4rem;height:1.4rem;font-size:.6rem;">
          ${avatarInitials(c.usuario?.username)}
        </span>
        <strong>${esc(c.usuario?.username || '?')}</strong>
        <span class="comment-date">${fmtDate(c.created_at)}</span>
        ${c.usuario?.id === user?.id
          ? `<button class="btn btn-danger btn-sm" style="margin-left:auto;"
               onclick="eliminarComentario('${c.id}')"
               data-testid="btn-eliminar-comentario-${c.id}">Eliminar</button>`
          : ''}
      </div>
      <div class="comment-body" data-testid="cuerpo-comentario-${c.id}">${esc(c.cuerpo)}</div>
    </div>
  `).join('');
}

function renderHistorial(historial) {
  const el = document.getElementById('historial-status');
  if (!el) return;

  if (historial.length === 0) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem;">Sin cambios de status registrados.</p>';
    return;
  }

  el.innerHTML = historial.map(h => `
    <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;font-size:.85rem;"
         data-testid="historial-item-${h.id}">
      <span class="avatar-chip" style="width:1.4rem;height:1.4rem;font-size:.6rem;">
        ${avatarInitials(h.usuario?.username)}
      </span>
      <span><strong>${esc(h.usuario?.username || '?')}</strong> cambió de</span>
      <span class="status-badge status-${h.status_anterior}">${STATUS_LABELS[h.status_anterior] || h.status_anterior}</span>
      <span>→</span>
      <span class="status-badge status-${h.status_nuevo}">${STATUS_LABELS[h.status_nuevo] || h.status_nuevo}</span>
      <span class="comment-date">${fmtDate(h.created_at)}</span>
    </div>
  `).join('');
}

function bindIssueEvents(issueId, issue) {
  // ── Edición de título (click en display) ──
  const tituloDisplay = document.getElementById('issue-titulo-display');
  const tituloEdit    = document.getElementById('issue-titulo-edit');
  const btnGuardar    = document.getElementById('btn-guardar-issue');
  const btnCancelar   = document.getElementById('btn-cancelar-edicion');

  tituloDisplay?.addEventListener('click', () => {
    tituloDisplay.style.display = 'none';
    tituloEdit.style.display    = 'block';
    btnGuardar.style.display    = 'inline-flex';
    btnCancelar.style.display   = 'inline-flex';
    tituloEdit.focus();
  });

  // ── Edición de descripción (click en display) ──
  const descDisplay = document.getElementById('issue-desc-display');
  const descEdit    = document.getElementById('issue-desc-edit');

  descDisplay?.addEventListener('click', () => {
    descDisplay.style.display = 'none';
    descEdit.style.display    = 'block';
    btnGuardar.style.display  = 'inline-flex';
    btnCancelar.style.display = 'inline-flex';
    descEdit.focus();
  });

  // ── Cancelar edición ──
  btnCancelar?.addEventListener('click', () => {
    tituloEdit.style.display    = 'none';
    tituloDisplay.style.display = 'block';
    descEdit.style.display      = 'none';
    descDisplay.style.display   = 'block';
    btnGuardar.style.display    = 'none';
    btnCancelar.style.display   = 'none';
    // Restaurar valores
    tituloEdit.value = window._issueActual?.titulo || '';
    descEdit.value   = window._issueActual?.descripcion || '';
  });

  // ── Guardar cambios de título/descripción ──
  btnGuardar?.addEventListener('click', async () => {
    btnGuardar.disabled = true;
    try {
      const updated = await api('PUT', `/issues/${issueId}`, {
        titulo:      tituloEdit.style.display !== 'none' ? tituloEdit.value.trim() : undefined,
        descripcion: descEdit.style.display   !== 'none' ? descEdit.value.trim()   : undefined
      });
      window._issueActual = updated;

      // Actualizar display
      tituloDisplay.textContent = updated.titulo;
      tituloEdit.style.display    = 'none';
      tituloDisplay.style.display = 'block';
      if (updated.descripcion) {
        descDisplay.textContent = updated.descripcion;
      } else {
        descDisplay.innerHTML = '<span style="color:var(--text-muted);">Sin descripción — haz clic para agregar</span>';
      }
      descEdit.style.display  = 'none';
      descDisplay.style.display = 'block';
      btnGuardar.style.display  = 'none';
      btnCancelar.style.display = 'none';
      setTextContent('sidebar-updated', fmtDate(updated.updated_at));
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      btnGuardar.disabled = false;
    }
  });

  // ── Guardar sidebar (status/tipo/prioridad/asignado) ──
  document.getElementById('btn-guardar-sidebar')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-guardar-sidebar');
    btn.disabled = true;
    btn.textContent = 'Guardando…';
    try {
      const updated = await api('PUT', `/issues/${issueId}`, {
        status:    document.getElementById('sidebar-status').value,
        tipo:      document.getElementById('sidebar-tipo').value,
        prioridad: document.getElementById('sidebar-prioridad').value,
        asignado_a: document.getElementById('sidebar-asignado').value || null
      });
      window._issueActual = updated;

      // Actualizar badges de cabecera
      const tipoBadge = document.getElementById('issue-tipo-badge');
      if (tipoBadge) tipoBadge.textContent = `${TIPO_ICONS[updated.tipo] || ''} ${TIPO_LABELS[updated.tipo] || updated.tipo}`;

      const prioBadge = document.getElementById('issue-prioridad-badge');
      if (prioBadge) {
        prioBadge.textContent = PRIO_LABELS[updated.prioridad] || updated.prioridad;
        prioBadge.style.background = PRIO_COLORS[updated.prioridad] || '#adb5bd';
        prioBadge.style.color = ['critica', 'alta'].includes(updated.prioridad) ? '#fff' : '#333';
      }

      setTextContent('sidebar-updated', fmtDate(updated.updated_at));

      // Refrescar historial si cambió el status
      const historial = await api('GET', `/issues/${issueId}/historial`);
      renderHistorial(historial || []);
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar';
    }
  });

  // ── Eliminar issue ──
  document.getElementById('btn-eliminar-issue')?.addEventListener('click', async () => {
    if (!confirm(`¿Eliminar el issue ${issue.proyecto?.clave}-${issue.numero}? Esta acción no se puede deshacer.`)) return;
    try {
      await api('DELETE', `/issues/${issueId}`);
      window.location.href = `/board.html?proyecto=${issue.proyecto_id}`;
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });

  // ── Comentario form ──
  document.getElementById('comentario-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const textarea = document.getElementById('input-comentario');
    const cuerpo = textarea.value.trim();
    if (!cuerpo) return;

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await api('POST', `/issues/${issueId}/comentarios`, { cuerpo });
      textarea.value = '';
      const comentarios = await api('GET', `/issues/${issueId}/comentarios`);
      renderComentarios(comentarios || []);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

window.eliminarComentario = async function (comentarioId) {
  if (!confirm('¿Eliminar este comentario?')) return;
  try {
    await api('DELETE', `/comentarios/${comentarioId}`);
    // Re-cargar comentarios
    const params  = new URLSearchParams(window.location.search);
    const issueId = params.get('id');
    const comentarios = await api('GET', `/issues/${issueId}/comentarios`);
    renderComentarios(comentarios || []);
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

// ── Utilidades DOM ────────────────────────────────────────────────────────────
function setTextContent(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setSelectValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

// Escapa HTML para prevenir XSS
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Inyectar link de Admin en navbar si el usuario es admin ───────────────────
function injectAdminLink() {
  const user = getUser();
  if (!user?.is_admin) return;
  const links = document.querySelector('.navbar-links');
  if (!links || links.querySelector('[href="/admin.html"]')) return;
  const a = document.createElement('a');
  a.href = '/admin.html';
  a.textContent = '⚙ Admin';
  a.setAttribute('data-testid', 'nav-admin');
  links.appendChild(a);
}

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE: FORGOT PASSWORD
// ══════════════════════════════════════════════════════════════════════════════
function initForgotPassword() {
  syncThemeButton();

  document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('forgot-error', '');
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Procesando…';

    try {
      const data = await api('POST', '/auth/forgot-password', {
        email: document.getElementById('forgot-email').value.trim()
      });

      document.getElementById('panel-solicitar').style.display = 'none';
      document.getElementById('panel-resultado').style.display = 'block';

      const urlEl = document.getElementById('reset-url-display');
      urlEl.textContent = data.reset_url;
      urlEl.href        = data.reset_url;
    } catch (err) {
      showError('forgot-error', err.message);
      btn.disabled = false;
      btn.textContent = 'Enviar link de reset';
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE: RESET PASSWORD
// ══════════════════════════════════════════════════════════════════════════════
function initResetPassword() {
  syncThemeButton();

  const params = new URLSearchParams(window.location.search);
  const token  = params.get('token');

  if (!token) {
    document.getElementById('panel-reset').style.display        = 'none';
    document.getElementById('panel-token-invalido').style.display = 'block';
    return;
  }

  document.getElementById('reset-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('reset-error', '');

    const password  = document.getElementById('nueva-password').value;
    const confirmar = document.getElementById('confirmar-password').value;

    if (password !== confirmar) {
      showError('reset-error', 'Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      showError('reset-error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Actualizando…';

    try {
      await api('POST', '/auth/reset-password', { token, password });
      document.getElementById('panel-reset').style.display  = 'none';
      document.getElementById('panel-exito').style.display  = 'block';
    } catch (err) {
      if (err.message.includes('inválido') || err.message.includes('expirado')) {
        document.getElementById('panel-reset').style.display         = 'none';
        document.getElementById('panel-token-invalido').style.display = 'block';
      } else {
        showError('reset-error', err.message);
        btn.disabled = false;
        btn.textContent = 'Cambiar contraseña';
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  PAGE: ADMIN PANEL
// ══════════════════════════════════════════════════════════════════════════════
async function initAdmin() {
  syncThemeButton();
  if (!requireAuth()) return;

  const user = getUser();
  if (!user?.is_admin) {
    window.location.href = '/proyectos.html';
    return;
  }

  const userNameEl = document.getElementById('user-name');
  if (userNameEl) userNameEl.textContent = user.username;

  injectAdminLink();
  await renderTablaUsuarios();
}

async function renderTablaUsuarios() {
  const wrapper = document.getElementById('tabla-usuarios-wrapper');
  wrapper.innerHTML = '<p style="color:var(--text-muted);">Cargando…</p>';

  try {
    const usuarios = await api('GET', '/admin/usuarios');
    const totalEl  = document.getElementById('total-usuarios');
    if (totalEl) totalEl.textContent = `${usuarios.length} usuario${usuarios.length !== 1 ? 's' : ''}`;

    if (usuarios.length === 0) {
      wrapper.innerHTML = '<p style="color:var(--text-muted);">No hay usuarios registrados.</p>';
      return;
    }

    wrapper.innerHTML = `
      <table class="issues-table" data-testid="tabla-usuarios">
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Registro</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${usuarios.map(u => `
            <tr data-testid="usuario-row-${u.id}">
              <td>
                <strong data-testid="usuario-username-${u.id}">${esc(u.username)}</strong>
              </td>
              <td style="color:var(--text-muted);" data-testid="usuario-email-${u.id}">
                ${esc(u.email)}
              </td>
              <td>
                ${u.is_admin
                  ? '<span class="badge role-badge role-owner" data-testid="badge-admin">Admin</span>'
                  : '<span class="badge role-badge role-member" data-testid="badge-member">Member</span>'}
              </td>
              <td style="font-size:.82rem;color:var(--text-muted);">
                ${fmtDate(u.created_at)}
              </td>
              <td>
                <div class="actions">
                  <button class="btn btn-secondary btn-sm"
                          onclick="generarTempPassword('${u.id}', '${esc(u.username)}')"
                          data-testid="btn-temp-pass-${u.id}">
                    🔑 Temp password
                  </button>
                  ${!u.is_admin
                    ? `<button class="btn btn-sm" style="background:#6610f2;"
                               onclick="toggleAdmin('${u.id}', true)"
                               data-testid="btn-make-admin-${u.id}">
                        Hacer admin
                       </button>`
                    : getUser()?.id !== u.id
                      ? `<button class="btn btn-secondary btn-sm"
                                 onclick="toggleAdmin('${u.id}', false)"
                                 data-testid="btn-quitar-admin-${u.id}">
                          Quitar admin
                         </button>`
                      : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    wrapper.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  }
}

window.generarTempPassword = async function (userId, username) {
  if (!confirm(`¿Generar una contraseña temporal para ${username}? Esto reemplazará su contraseña actual.`)) return;

  try {
    const data = await api('POST', `/admin/usuarios/${userId}/reset-password`);

    document.getElementById('temp-pass-usuario').textContent = `${data.usuario.username} (${data.usuario.email})`;
    document.getElementById('temp-pass-value').textContent   = data.temp_password;
    showModal('modal-temp-pass');
  } catch (err) {
    const alertEl = document.getElementById('admin-alert');
    alertEl.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    setTimeout(() => alertEl.innerHTML = '', 4000);
  }
};

window.toggleAdmin = async function (userId, makeAdmin) {
  const accion = makeAdmin ? 'promover a admin' : 'quitar rol de admin';
  if (!confirm(`¿Quieres ${accion} a este usuario?`)) return;

  try {
    await api('PATCH', `/admin/usuarios/${userId}/admin`, { is_admin: makeAdmin });
    await renderTablaUsuarios();
  } catch (err) {
    const alertEl = document.getElementById('admin-alert');
    alertEl.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    setTimeout(() => alertEl.innerHTML = '', 4000);
  }
};
