// ===================== ROLES Y USUARIOS =====================
import { DB, auth } from './firebase-config.js';
import { createUserWithEmailAndPassword, updatePassword } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { showNotif, openModal, closeModal } from './helpers.js';
import { currentUser } from './auth.js';

// ===================== ROLES =====================
export const MODULES = ['dashboard', 'mapa', 'reservas', 'checkin', 'huespedes', 'precios', 'contabilidad', 'caja'];
export const MODULE_LABELS = {
  dashboard: 'Dashboard', mapa: 'Mapa Camas', reservas: 'Reservas',
  checkin: 'Check-in/out', huespedes: 'Huéspedes', precios: 'Precios',
  contabilidad: 'Contabilidad', caja: 'Caja'
};

export function renderRoles() {
  const roles = DB.get('roles', []);
  const grid = document.getElementById('rolesGrid');
  grid.innerHTML = roles.map(r => `
    <div class="role-card">
      <h4>${r.nombre} ${r.id === 'rol-admin' ? '<span class="badge blue" style="font-size:10px">Admin</span>' : ''}</h4>
      <div class="perm-list">
        ${MODULES.map(m => {
          const perm = r.permisos[m] || 'n';
          return `<div class="perm-item">
            <span>${MODULE_LABELS[m]}</span>
            <div class="toggle">
              <button class="toggle-btn read ${perm === 'r' || perm === 'rw' ? 'on' : ''}" onclick="togglePerm('${r.id}','${m}','r')">Leer</button>
              <button class="toggle-btn write ${perm === 'rw' ? 'on' : ''}" onclick="togglePerm('${r.id}','${m}','w')">Editar</button>
            </div>
          </div>`;
        }).join('')}
      </div>
      ${r.id !== 'rol-admin' ? `<button class="btn btn-red btn-sm" style="margin-top:12px;width:100%" onclick="deleteRol('${r.id}')">Eliminar rol</button>` : ''}
    </div>`).join('');

  document.getElementById('rolPermisos').innerHTML = MODULES.map(m => `
    <div class="perm-item" style="border-bottom:1px solid var(--border);padding-bottom:8px;margin-bottom:8px">
      <label style="font-size:13px;color:var(--text2)">${MODULE_LABELS[m]}</label>
      <div class="toggle">
        <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--text2);cursor:pointer">
          <input type="checkbox" id="np-${m}-r" style="accent-color:var(--accent)"> Leer
        </label>
        <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--text2);cursor:pointer;margin-left:8px">
          <input type="checkbox" id="np-${m}-w" style="accent-color:var(--green)"> Editar
        </label>
      </div>
    </div>`).join('');
}

export function togglePerm(roleId, module, type) {
  const roles = DB.get('roles', []);
  const r = roles.find(x => x.id === roleId);
  if (!r || r.id === 'rol-admin') return;
  const cur = r.permisos[module] || 'n';
  if (type === 'r') {
    r.permisos[module] = (cur === 'r' || cur === 'rw') ? 'n' : (cur === 'n' ? 'r' : 'r');
  } else {
    r.permisos[module] = cur === 'rw' ? 'r' : 'rw';
  }
  DB.set('roles', roles);
  renderRoles();
}

export function deleteRol(id) {
  const roles = DB.get('roles', []).filter(r => r.id !== id);
  DB.set('roles', roles);
  renderRoles();
  showNotif('Rol eliminado');
}

export function saveRol() {
  const nombre = document.getElementById('rol-nombre').value.trim();
  if (!nombre) { showNotif('Ingresá un nombre para el rol', 'error'); return; }
  const permisos = {};
  MODULES.forEach(m => {
    const r = document.getElementById('np-' + m + '-r')?.checked;
    const w = document.getElementById('np-' + m + '-w')?.checked;
    permisos[m] = w ? 'rw' : r ? 'r' : 'n';
  });
  const roles = DB.get('roles', []);
  roles.push({ id: 'rol-' + Date.now(), nombre, permisos });
  DB.set('roles', roles);
  closeModal('modalRol');
  renderRoles();
  showNotif('Rol creado: ' + nombre);
}

// ===================== USUARIOS =====================
export function renderUsuarios() {
  const usuarios = DB.get('usuarios', []);
  const roles = DB.get('roles', []);
  document.getElementById('tablaUsuarios').innerHTML = usuarios.length
    ? usuarios.map(u => {
        const rol = roles.find(r => r.id === u.rol);
        const lastAccess = u.ultimoAcceso
          ? new Date(u.ultimoAcceso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '—';
        const isSelf = currentUser.value && currentUser.value.id === u.id;
        return `<tr>
          <td><strong style="color:var(--text)">${u.nombre}</strong>${isSelf ? ' <span class="badge blue" style="font-size:10px">Vos</span>' : ''}</td>
          <td style="font-family:'DM Mono';font-size:12px">${u.email}</td>
          <td>${rol ? `<span class="badge blue">${rol.nombre}</span>` : '—'}</td>
          <td><span class="badge ${u.estado === 'activo' ? 'green' : 'gray'}">${u.estado}</span></td>
          <td style="font-size:12px;color:var(--text3)">${lastAccess}</td>
          <td style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" onclick="editUsuario('${u.id}')">Editar</button>
            ${!isSelf ? `<button class="btn btn-red btn-sm" onclick="toggleUsuarioEstado('${u.id}')">${u.estado === 'activo' ? 'Desactivar' : 'Activar'}</button>` : ''}
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--text3)">Sin usuarios registrados</td></tr>';
}

export function openNuevoUsuario() {
  document.getElementById('u-id').value = '';
  document.getElementById('u-nombre').value = '';
  document.getElementById('u-email').value = '';
  document.getElementById('u-pass').value = '';
  document.getElementById('u-pass2').value = '';
  document.getElementById('u-estado').value = 'activo';
  document.getElementById('modalUsuarioTitle').textContent = 'Nuevo Usuario';
  document.getElementById('u-pass-label').textContent = 'Contraseña *';
  populateRolSelect();
  openModal('modalUsuario');
}

export function editUsuario(id) {
  const u = DB.get('usuarios', []).find(x => x.id === id);
  if (!u) return;
  document.getElementById('u-id').value = u.id;
  document.getElementById('u-nombre').value = u.nombre;
  document.getElementById('u-email').value = u.email;
  document.getElementById('u-pass').value = '';
  document.getElementById('u-pass2').value = '';
  document.getElementById('u-estado').value = u.estado;
  document.getElementById('modalUsuarioTitle').textContent = 'Editar Usuario';
  document.getElementById('u-pass-label').textContent = 'Nueva contraseña (dejar vacío para no cambiar)';
  populateRolSelect(u.rol);
  openModal('modalUsuario');
}

export function populateRolSelect(selected) {
  const roles = DB.get('roles', []);
  document.getElementById('u-rol').innerHTML = roles.map(r =>
    `<option value="${r.id}" ${r.id === selected ? 'selected' : ''}>${r.nombre}</option>`
  ).join('');
}

export function toggleUsuarioEstado(id) {
  const usuarios = DB.get('usuarios', []);
  const u = usuarios.find(x => x.id === id);
  if (!u) return;
  u.estado = u.estado === 'activo' ? 'inactivo' : 'activo';
  DB.set('usuarios', usuarios);
  renderUsuarios();
  showNotif(`Usuario ${u.estado === 'activo' ? 'activado' : 'desactivado'}: ${u.nombre}`);
}

export async function saveUsuario() {
  const id = document.getElementById('u-id').value;
  const nombre = document.getElementById('u-nombre').value.trim();
  const email = document.getElementById('u-email').value.trim();
  const pass = document.getElementById('u-pass').value;
  const pass2 = document.getElementById('u-pass2').value;
  const rol = document.getElementById('u-rol').value;
  const estado = document.getElementById('u-estado').value;
  if (!nombre || !email) { showNotif('Nombre y email son obligatorios', 'error'); return; }
  const usuarios = DB.get('usuarios', []);
  const dupEmail = usuarios.find(u => u.email.toLowerCase() === email.toLowerCase() && u.id !== id);
  if (dupEmail) { showNotif('Ya existe un usuario con ese email', 'error'); return; }
  if (id) {
    const u = usuarios.find(x => x.id === id);
    if (!u) return;
    u.nombre = nombre; u.email = email; u.rol = rol; u.estado = estado;
    if (pass) {
      if (pass.length < 6) { showNotif('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
      if (pass !== pass2) { showNotif('Las contraseñas no coinciden', 'error'); return; }
      u.pass = pass;
      if (auth.currentUser && auth.currentUser.email.toLowerCase() === email.toLowerCase()) {
        try { await updatePassword(auth.currentUser, pass); } catch(e) { console.warn('No se pudo actualizar pass en Auth:', e); }
      }
    }
    await DB.set('usuarios', usuarios);
    showNotif('Usuario actualizado: ' + nombre);
  } else {
    if (!pass) { showNotif('La contraseña es obligatoria', 'error'); return; }
    if (pass.length < 6) { showNotif('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
    if (pass !== pass2) { showNotif('Las contraseñas no coinciden', 'error'); return; }
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      usuarios.push({
        id: 'u' + Date.now(), nombre, email, rol, estado, pass,
        ultimoAcceso: null
      });
      await DB.set('usuarios', usuarios);
      showNotif('Usuario creado: ' + nombre);
    } catch(e) {
      const msg = e.code === 'auth/email-already-in-use' ? 'Ese email ya está registrado en Firebase Auth' : 'Error al crear usuario: ' + e.message;
      showNotif(msg, 'error');
      return;
    }
  }
  closeModal('modalUsuario');
  renderUsuarios();
}
