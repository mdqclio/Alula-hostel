// ===================== AUTH =====================
import { auth, db, DB, loadAllData } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { showNotif, openModal, closeModal } from './helpers.js';
import { CONFIG_DEFAULTS } from './config.js';
import { logAuditoria } from './auditoria.js';

// Estado global mutable de currentUser
export const currentUser = { value: null };

let _loggingIn = false;

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

// Marca/desmarca al usuario en alula/admins/<uid>. Las reglas endurecidas
// determinan "admin" leyendo root.child('alula/admins/'+auth.uid) (los arrays
// no se pueden iterar desde reglas). Es self-perpetuating: cada admin que entra
// refresca su propia flag. Best-effort (fire-and-forget): un fallo de permisos
// no rompe el login. Bootstrap del primer admin: docs/migrate-admins-instructions.md.
async function syncAdminFlag(uid, isAdmin) {
  if (!uid) return;
  try {
    const { ref, set, remove } = await import("https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js");
    const aref = ref(db, 'alula/admins/' + uid);
    if (isAdmin) await set(aref, true);
    else await remove(aref);
  } catch (e) {
    console.warn('[syncAdminFlag] no se pudo sincronizar admin flag:', e?.message || e);
  }
}

export function applyRoleUI(rolKey, rolObj) {
  const isAdmin = rolKey === 'admin' || (rolObj && rolObj.permisos && rolObj.permisos.roles === 'rw');
  document.getElementById('nav-listanegra')?.style && (document.getElementById('nav-listanegra').style.display = isAdmin ? '' : 'none');
  const adminEls = document.querySelectorAll('.admin-only');
  adminEls.forEach(el => el.style.display = isAdmin ? '' : 'none');
  // Sincroniza la flag de admin para las reglas (no se espera: background).
  syncAdminFlag(auth.currentUser?.uid, isAdmin);
}

export async function doLogin() {
  _loggingIn = true;
  const email = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  if (!email || !pass) { _loggingIn = false; showLoginError('Completá email y contraseña'); return; }
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
    logAuditoria('login', 'usuario', u.id, `Login: ${u.nombre} (${u.email})`);
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('sidebarUserName').textContent = u.nombre;
    document.getElementById('sidebarUserRole').textContent = rol ? rol.nombre : rolKey;
    applyRoleUI(rolKey, rol);
    const { showSection, updateDate } = await import('./navigation.js');
    const { loadApiKeyFromFirebase } = await import('./chatbot.js');
    await loadApiKeyFromFirebase();
    showSection('dashboard');
    updateDate();
  } catch(e) {
    const msg = e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password'
      ? 'Usuario o contraseña incorrectos'
      : e.code === 'auth/too-many-requests'
      ? 'Demasiados intentos. Esperá unos minutos.'
      : 'Error al iniciar sesión. Intentá de nuevo.';
    showLoginError(msg);
  } finally {
    _loggingIn = false;
  }
}

export async function doLogout() {
  await logAuditoria('logout', 'usuario', currentUser.value?.id || null, `Logout: ${currentUser.value?.name || '—'}`);
  await signOut(auth);
  currentUser.value = null;
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

export function openChangePassword() {
  ['cp-actual', 'cp-nueva', 'cp-confirmar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const errEl = document.getElementById('cp-error');
  if (errEl) errEl.textContent = '';
  openModal('modalChangePassword');
}

export async function saveChangePassword() {
  const actual    = document.getElementById('cp-actual')?.value || '';
  const nueva     = document.getElementById('cp-nueva')?.value || '';
  const confirmar = document.getElementById('cp-confirmar')?.value || '';
  const errEl     = document.getElementById('cp-error');

  const setErr = msg => { if (errEl) errEl.textContent = msg; };

  if (!actual || !nueva || !confirmar) { setErr('Completá todos los campos.'); return; }
  if (nueva.length < 6)               { setErr('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
  if (nueva !== confirmar)             { setErr('Las contraseñas nuevas no coinciden.'); return; }

  const user = auth.currentUser;
  if (!user) { setErr('No hay sesión activa.'); return; }

  const btn = document.getElementById('btn-guardar-password');
  if (btn) { btn.disabled = true; btn.textContent = 'Verificando...'; }

  try {
    // Re-autenticar con la contraseña actual
    const credential = EmailAuthProvider.credential(user.email, actual);
    await reauthenticateWithCredential(user, credential);

    // Cambiar contraseña en Firebase Auth (única fuente de verdad — no se persiste en la DB)
    await updatePassword(user, nueva);

    logAuditoria('editar', 'usuario', currentUser.value?.id || null, 'Cambió su contraseña');

    closeModal('modalChangePassword');
    showNotif('✅ Contraseña actualizada correctamente');
  } catch(e) {
    const msg =
      e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential'
        ? 'La contraseña actual es incorrecta.'
        : e.code === 'auth/too-many-requests'
        ? 'Demasiados intentos. Esperá unos minutos.'
        : 'Error al cambiar la contraseña. Intentá de nuevo.';
    setErr(msg);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
  }
}

export function initAuth() {
  onAuthStateChanged(auth, async (firebaseUser) => {
    // Si doLogin() está en curso, él mismo maneja la UI — no interferir
    if (_loggingIn) return;
    // Si ya hay sesión activa en currentUser, tampoco volver a montar
    if (currentUser.value) return;

    if (!firebaseUser) {
      // No hay sesión: mostrar pantalla de login
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
      return;
    }

    // Hay sesión persitida (usuario refrescó la página): restaurar
    try {
      await loadAllData();
      const usuarios = DB.get('usuarios', []);
      const u = usuarios.find(x => x.email.toLowerCase() === firebaseUser.email.toLowerCase());
      if (!u || u.estado === 'inactivo') {
        await signOut(auth);
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
        return;
      }
      const roles = DB.get('roles', []);
      const rol = roles.find(r => r.id === u.rol);
      const rolKey = rolToKey(u.rol);
      currentUser.value = { id: u.id, name: u.nombre, email: u.email, rol: u.rol, rolKey };
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      document.getElementById('sidebarUserName').textContent = u.nombre;
      document.getElementById('sidebarUserRole').textContent = rol ? rol.nombre : rolKey;
      applyRoleUI(rolKey, rol);
      const { showSection, updateDate } = await import('./navigation.js');
      const { loadApiKeyFromFirebase } = await import('./chatbot.js');
      await loadApiKeyFromFirebase();
      showSection('dashboard');
      updateDate();
    } catch(e) {
      console.error('[initAuth] Error restaurando sesión:', e);
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
    }
  });
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
