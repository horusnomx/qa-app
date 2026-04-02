// public/app.js
// Conecta las páginas HTML con la API REST.

const API = 'https://qa-app-production.up.railway.app';

// ── Utilidades ───────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('token');
}

function getUsuario() {
  try {
    return JSON.parse(localStorage.getItem('usuario'));
  } catch {
    return null;
  }
}

function mostrarError(elementId, mensaje) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = mensaje;
  el.classList.remove('hidden');
}

function ocultarMensaje(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.classList.add('hidden');
}

// ── Página: index.html (Login) ───────────────────────────────────────────────

const loginForm = document.getElementById('login-form');
if (loginForm) {
  // Si ya hay sesión, ir directo a tareas
  if (getToken()) window.location.href = 'tareas.html';

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarMensaje('error-message');

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const res  = await fetch(`${API}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        mostrarError('error-message', data.mensaje || 'Error al iniciar sesión.');
        return;
      }

      localStorage.setItem('token',   data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      window.location.href = 'tareas.html';

    } catch {
      mostrarError('error-message', 'No se pudo conectar con el servidor.');
    }
  });
}

// ── Página: registro.html ────────────────────────────────────────────────────

const registroForm = document.getElementById('registro-form');
if (registroForm) {
  registroForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarMensaje('error-message');
    ocultarMensaje('success-message');

    const nombre   = document.getElementById('nombre').value.trim();
    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const res  = await fetch(`${API}/api/auth/registro`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nombre, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        mostrarError('error-message', data.mensaje || 'Error al registrarse.');
        return;
      }

      const ok = document.getElementById('success-message');
      ok.textContent = '¡Cuenta creada! Redirigiendo...';
      ok.classList.remove('hidden');

      setTimeout(() => { window.location.href = 'index.html'; }, 1500);

    } catch {
      mostrarError('error-message', 'No se pudo conectar con el servidor.');
    }
  });
}

// ── Página: tareas.html ──────────────────────────────────────────────────────

const listaTareas = document.getElementById('lista-tareas');
if (listaTareas) {
  const token   = getToken();
  const usuario = getUsuario();

  // Redirigir si no hay sesión
  if (!token) {
    window.location.href = 'index.html';
  }

  // Mostrar nombre de usuario
  const userNombre = document.querySelector('[data-testid="user-nombre"]');
  if (userNombre && usuario) userNombre.textContent = usuario.nombre;

  // Logout
  document.querySelector('[data-testid="btn-logout"]').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = 'index.html';
  });

  let filtroActual = null;

  // ── Cargar tareas ──────────────────────────────────────────────────────────

  async function cargarTareas(status = null) {
    const url = status ? `${API}/api/tareas?status=${status}` : `${API}/api/tareas`;

    try {
      const res  = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = 'index.html';
        return;
      }

      const data = await res.json();
      renderizarTareas(data.tareas, data.total);

    } catch {
      listaTareas.innerHTML = '<p class="error-banner">Error al cargar las tareas.</p>';
    }
  }

  function renderizarTareas(tareas, total) {
    const totalEl  = document.querySelector('[data-testid="total-tareas"]');
    const emptyEl  = document.getElementById('empty-state');

    if (totalEl) totalEl.textContent = `Total: ${total}`;

    listaTareas.innerHTML = '';

    if (tareas.length === 0) {
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');

    tareas.forEach(tarea => {
      const card = document.createElement('div');
      card.className = `tarea-card ${tarea.status}`;
      card.dataset.testid = `tarea-card-${tarea.id}`;
      card.innerHTML = `
        <div class="tarea-info">
          <strong data-testid="tarea-titulo-${tarea.id}">${tarea.titulo}</strong>
          <span class="badge ${tarea.status}" data-testid="tarea-status-${tarea.id}">${tarea.status}</span>
          ${tarea.descripcion ? `<p>${tarea.descripcion}</p>` : ''}
        </div>
        <div class="tarea-acciones">
          <button
            data-testid="btn-toggle-${tarea.id}"
            onclick="toggleStatus(${tarea.id}, '${tarea.status}', '${tarea.titulo}', '${(tarea.descripcion || '').replace(/'/g, "\\'")}')">
            ${tarea.status === 'pendiente' ? 'Completar' : 'Reabrir'}
          </button>
          <button
            class="btn-eliminar"
            data-testid="btn-eliminar-${tarea.id}"
            onclick="eliminarTarea(${tarea.id})">
            Eliminar
          </button>
        </div>
      `;
      listaTareas.appendChild(card);
    });
  }

  // ── Crear tarea ────────────────────────────────────────────────────────────

  document.getElementById('nueva-tarea-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarMensaje('form-error');

    const titulo      = document.getElementById('titulo').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();
    const status      = document.getElementById('status').value;

    if (!titulo) {
      mostrarError('form-error', 'El título es obligatorio.');
      return;
    }

    try {
      const res = await fetch(`${API}/api/tareas`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ titulo, descripcion, status }),
      });

      if (!res.ok) {
        const data = await res.json();
        mostrarError('form-error', data.mensaje || 'Error al crear la tarea.');
        return;
      }

      document.getElementById('titulo').value      = '';
      document.getElementById('descripcion').value = '';
      document.getElementById('status').value      = 'pendiente';
      cargarTareas(filtroActual);

    } catch {
      mostrarError('form-error', 'No se pudo conectar con el servidor.');
    }
  });

  // ── Toggle status ──────────────────────────────────────────────────────────

  window.toggleStatus = async (id, statusActual, titulo, descripcion) => {
    const nuevoStatus = statusActual === 'pendiente' ? 'completada' : 'pendiente';

    await fetch(`${API}/api/tareas/${id}`, {
      method:  'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({ titulo, descripcion, status: nuevoStatus }),
    });

    cargarTareas(filtroActual);
  };

  // ── Eliminar tarea ─────────────────────────────────────────────────────────

  window.eliminarTarea = async (id) => {
    await fetch(`${API}/api/tareas/${id}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    cargarTareas(filtroActual);
  };

  // ── Filtros ────────────────────────────────────────────────────────────────

  document.querySelectorAll('.filtro').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filtro').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');

      const testid = btn.dataset.testid;
      if (testid === 'btn-filtro-pendiente')  filtroActual = 'pendiente';
      else if (testid === 'btn-filtro-completada') filtroActual = 'completada';
      else filtroActual = null;

      cargarTareas(filtroActual);
    });
  });

  // Carga inicial
  cargarTareas();
}
