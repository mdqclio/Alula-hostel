// Validación pura del body de la Function `crearUsuario`. Sin dependencias de
// Firebase ni de red: recibe el body y la lista de rolIds válidos y devuelve un
// resultado testeable. Se usa desde functions/index.js y se cubre con Vitest.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {any} body  Body crudo de la request ({ email, password, nombre, rolId }).
 * @param {string[]} rolesIds  Ids de roles existentes en alula/roles.
 * @returns {{valid:true, value:{email:string,password:string,nombre:string,rolId:string}}
 *           | {valid:false, error:string, mensaje:string}}
 */
export function validateCrearUsuarioBody(body, rolesIds = []) {
  const b = (body && typeof body === 'object') ? body : {};
  const email = typeof b.email === 'string' ? b.email.trim() : '';
  const nombre = typeof b.nombre === 'string' ? b.nombre.trim() : '';
  const rolId = typeof b.rolId === 'string' ? b.rolId : '';
  const password = typeof b.password === 'string' ? b.password : '';

  if (!email || !EMAIL_RE.test(email)) {
    return { valid: false, error: 'email_invalido', mensaje: 'Email con formato inválido.' };
  }
  // Mínimo de Firebase Auth: 6 caracteres.
  if (typeof b.password !== 'string' || password.length < 6) {
    return { valid: false, error: 'password_corta', mensaje: 'La contraseña debe tener al menos 6 caracteres.' };
  }
  if (nombre.length < 1 || nombre.length > 80) {
    return { valid: false, error: 'nombre_invalido', mensaje: 'El nombre debe tener entre 1 y 80 caracteres.' };
  }
  if (!rolId || !rolesIds.includes(rolId)) {
    return { valid: false, error: 'rol_inexistente', mensaje: 'El rol indicado no existe.' };
  }

  return { valid: true, value: { email, password, nombre, rolId } };
}
