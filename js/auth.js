// ===================== AUTH =====================
import { auth, DB, loadAllData } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { showNotif } from './helpers.js';
import { CONFIG_DEFAULTS } from './config.js';

// Estado global mutable de currentUser
export const currentUser = { value: null };

export const ROLE_LABELS = {
  admin: 'Administración',
  recepcion: 'Recepción',
  ventas: 'Ventas',
  limpieza: 'Limpieza'
};

export function rolToKey(rolId) {
  const map = {
    'rol-admin': 'admin',
    'rol-recepcion': 'recepcion',
    'rol-ventas': 'ventas',
    'rol-limpieza': 'limpieza'
  };
  return map[rolId] || 'recepcion';
}

export function showLoginError(msg, color = '#f87171') {
  let err = document.getElementById('loginError');
  if (!err) {
    err = document.createElement('p');
    err.id = 'loginError';
    err.style.cssText = 'text-align:center;font-size:12px;margin-top:10px';
    document.querySelector('.login-box').appendChild(err);
  }
  err.style.color = color;
  err.textContent = msg;
  if (color !== '#60a5fa') setTimeout(() => err.textContent = '', 3500);
}

export function applyRoleUI(rolKey, rolObj) {
  const isAdmin = rolKey === 'admin' || (rolObj && rolObj.permisos && rolObj.permisos.roles === 'rw');
  document.getElementById('nav-listanegra')?.style && (document.getElementById('nav-listanegra').style.display = isAdmin ? '' : 'none');
  const adminEls = document.querySelectorAll('.admin-only');
  adminEls.forEach(el => el.style.display = isAdmin ? '' : 'none');
}

export async function doLogin() {
  const email = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  if (!email || !pass) { showLoginError('Completá email y contraseña'); return; }
  showLoginError('Verificando...', '#60a5fa');
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    await loadAllData();
    const usuarios = DB.get('usuarios', []);
    const u = usuarios.find(x => x.email.toLowerCase() === email.toLowerCase());
    if (!u) { await signOut(auth); showLoginError('Usuario no registrado en el sistema'); return; }
    if (u.estado === 'inactivo') { await signOut(auth); showLoginError('Usuario inactivo. Contactá al administrador'); return; }
    u.ultimoAcceso = new Date().toISOString();
    await DB.set('usuarios', usuarios);
    const roles = DB.get('roles', []);
    const rol = roles.find(r => r.id === u.rol);
    const rolKey = rolToKey(u.rol);
    currentUser.value = { id: u.id, name: u.nombre, email: u.email, rol: u.rol, rolKey };
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('sidebarUserName').textContent = u.nombre;
    document.getElementById('sidebarUserRole').textContent = rol ? rol.nombre : rolKey;
    applyRoleUI(rolKey, rol);
    // showSection se importa dinámicamente para evitar ciclo
    const { showSection } = await import('./navigation.js');
    const { updateDate } = await import('./navigation.js');
    showSection('dashboard');
    updateDate();
  } catch(e) {
    const msg = e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password'
      ? 'Usuario o contraseña incorrectos'
      : e.code === 'auth/too-many-requests'
      ? 'Demasiados intentos. Esperá unos minutos.'
      : 'Error al iniciar sesión. Intentá de nuevo.';
    showLoginError(msg);
  }
}

export async function doLogout() {
  await signOut(auth);
  currentUser.value = null;
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

export async function initData() {
  // Solo inicializar si la base está vacía
  if (!DB.get('roles', null)) {
    await DB.set('roles', [
      { id: 'rol-admin',     nombre: 'Administración', permisos: { reservas: 'rw', checkin: 'rw', huespedes: 'rw', caja: 'rw', contabilidad: 'rw', precios: 'rw', listanegra: 'rw', usuarios: 'rw', roles: 'rw', knowledge: 'rw', config: 'rw' } },
      { id: 'rol-recepcion', nombre: 'Recepción',      permisos: { reservas: 'rw', checkin: 'rw', huespedes: 'rw', caja: 'r',  contabilidad: 'none', precios: 'r', listanegra: 'r', usuarios: 'none', roles: 'none', knowledge: 'r', config: 'none' } },
      { id: 'rol-ventas',    nombre: 'Ventas',         permisos: { reservas: 'rw', checkin: 'r',  huespedes: 'r',  caja: 'none', contabilidad: 'none', precios: 'r', listanegra: 'r', usuarios: 'none', roles: 'none', knowledge: 'r', config: 'none' } },
      { id: 'rol-limpieza',  nombre: 'Limpieza',       permisos: { reservas: 'r',  checkin: 'r',  huespedes: 'none', caja: 'none', contabilidad: 'none', precios: 'none', listanegra: 'none', usuarios: 'none', roles: 'none', knowledge: 'none', config: 'none' } },
    ]);
  }
  // Inicializar config default si no existe
  if (!DB.get('config', null)) {
    await DB.set('config', CONFIG_DEFAULTS);
  }
}
