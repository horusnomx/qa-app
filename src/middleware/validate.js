const VALID_TASK_STATUSES  = ['pending', 'in_progress', 'done'];
const VALID_ISSUE_TYPES    = ['epic', 'story', 'task', 'bug'];
const VALID_PRIORITIES     = ['critical', 'high', 'medium', 'low'];
const VALID_ISSUE_STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];
const VALID_ROLES          = ['admin', 'member', 'viewer'];

const validators = {
  register({ username, email, password, confirm_password }) {
    const errors = [];
    if (!username || username.trim().length < 3)  errors.push('El usuario debe tener al menos 3 caracteres.');
    if (username && username.trim().length > 30)  errors.push('El usuario no puede superar 30 caracteres.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email inválido.');
    if (!password || password.length < 6)         errors.push('La contraseña debe tener al menos 6 caracteres.');
    if (password !== confirm_password)             errors.push('Las contraseñas no coinciden.');
    return errors;
  },

  login({ email, password }) {
    const errors = [];
    if (!email)    errors.push('El email es requerido.');
    if (!password) errors.push('La contraseña es requerida.');
    return errors;
  },

  task({ title, status }) {
    const errors = [];
    if (!title || title.trim().length === 0)  errors.push('El título es obligatorio.');
    if (title && title.trim().length > 100)   errors.push('El título no puede superar 100 caracteres.');
    if (status && !VALID_TASK_STATUSES.includes(status)) errors.push('Estado inválido.');
    return errors;
  },

  project({ name, key }) {
    const errors = [];
    if (!name || name.trim().length < 2)   errors.push('El nombre debe tener al menos 2 caracteres.');
    if (name && name.trim().length > 80)   errors.push('El nombre no puede superar 80 caracteres.');
    if (!key || !/^[A-Z]{2,10}$/.test(key.toUpperCase().replace(/[^A-Z]/g, '')))
      errors.push('La clave debe tener 2-10 letras (ej: QA, SHOP, MYPROJ).');
    return errors;
  },

  issue({ title, type, priority, status }) {
    const errors = [];
    if (!title || title.trim().length === 0)  errors.push('El título es obligatorio.');
    if (title && title.trim().length > 200)   errors.push('El título no puede superar 200 caracteres.');
    if (type   && !VALID_ISSUE_TYPES.includes(type))     errors.push('Tipo de issue inválido.');
    if (priority && !VALID_PRIORITIES.includes(priority)) errors.push('Prioridad inválida.');
    if (status && !VALID_ISSUE_STATUSES.includes(status)) errors.push('Estado inválido.');
    return errors;
  },

  sprint({ name }) {
    const errors = [];
    if (!name || name.trim().length === 0) errors.push('El nombre del sprint es obligatorio.');
    if (name && name.trim().length > 80)   errors.push('El nombre no puede superar 80 caracteres.');
    return errors;
  },

  label({ name, color }) {
    const errors = [];
    if (!name || name.trim().length === 0) errors.push('El nombre de la etiqueta es obligatorio.');
    if (name && name.trim().length > 30)   errors.push('El nombre no puede superar 30 caracteres.');
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) errors.push('Color inválido (formato: #rrggbb).');
    return errors;
  },

  comment({ body }) {
    const errors = [];
    if (!body || body.trim().length === 0) errors.push('El comentario no puede estar vacío.');
    if (body && body.trim().length > 5000) errors.push('El comentario no puede superar 5000 caracteres.');
    return errors;
  },

  workLog({ hours }) {
    const errors = [];
    const h = parseFloat(hours);
    if (isNaN(h) || h <= 0) errors.push('Las horas deben ser un número positivo.');
    if (h > 24)              errors.push('No se pueden registrar más de 24 horas por entrada.');
    return errors;
  },

  memberRole({ role }) {
    const errors = [];
    if (!role || !VALID_ROLES.includes(role)) errors.push('Rol inválido.');
    return errors;
  }
};

module.exports = validators;
