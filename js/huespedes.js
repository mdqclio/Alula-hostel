// ===================== HUÉSPEDES =====================
import { DB } from './firebase-config.js';
import { showNotif, openModal, closeModal, fmtMoney, estadoBadge, nightsBetween } from './helpers.js';

export function getScoreBadge(score) {
  if (!score) return '<span style="font-size:11px;color:var(--text3)">Sin calificar</span>';
  const color = score <= 3 ? '#f87171' : score <= 5 ? '#fbbf24' : score <= 7 ? '#60a5fa' : '#34d399';
  const emoji = score <= 3 ? '🔴' : score <= 5 ? '🟡' : score <= 7 ? '🔵' : '🟢';
  return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:12px;font-weight:700;background:${color}22;color:${color}">${emoji} ${score}/10</span>`;
}

export function renderScoreStars(containerId, scoreInputId, currentScore) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const scores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  container.innerHTML = scores.map(n => {
    const color = n <= 3 ? '#f87171' : n <= 5 ? '#fbbf24' : n <= 7 ? '#60a5fa' : '#34d399';
    const selected = currentScore && n <= currentScore;
    return `<div onclick="setScore('${scoreInputId}','${containerId}',${n})"
      style="width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:700;cursor:pointer;transition:all 0.15s;
      background:${selected ? color.replace(')', ',0.25)').replace('rgb', 'rgba') : 'var(--surface2)'};
      color:${selected ? color : 'var(--text3)'};
      border:1px solid ${selected ? color : 'var(--border)'};
      transform:${currentScore === n ? 'scale(1.2)' : 'scale(1)'}"
      title="Puntuación ${n}">${n}</div>`;
  }).join('');
}

export function setScore(inputId, containerId, val) {
  document.getElementById(inputId).value = val;
  renderScoreStars(containerId, inputId, val);
}

export function renderHuespedes() {
  const huespedes = DB.get('huespedes', []);
  const q = document.getElementById('filterHuesped')?.value.toLowerCase() || '';
  const filtered = q ? huespedes.filter(h => (h.nombre + ' ' + h.apellido + h.dni).toLowerCase().includes(q)) : huespedes;

  // populate modal select
  const sel = document.getElementById('res-huesped');
  if (sel) {
    sel.innerHTML = '<option value="">Seleccionar...</option>' + huespedes.map(h => `<option value="${h.id}">${h.nombre} ${h.apellido}</option>`).join('');
  }

  document.getElementById('tablaHuespedes').innerHTML = filtered.length
    ? filtered.map(h => `<tr>
        <td><strong style="color:var(--text)">${h.nombre} ${h.apellido}</strong>${h.pendiente ? ` <span class="badge amber" style="font-size:10px">Por confirmar</span>` : ''}</td>
        <td style="font-family:'DM Mono';font-size:12px">${h.dni}</td>
        <td>${h.nac}</td><td>${h.tel || '—'}</td><td>${h.email || '—'}</td>
        <td style="text-align:center">${h.estadias || 0}</td>
        <td>${getScoreBadge(h.score)}</td>
        <td style="display:flex;gap:4px;">
          <button class="btn btn-ghost btn-sm" onclick="showGuestDetail('${h.id}')">Ver</button>
          <button class="btn btn-ghost btn-sm" onclick="openEditHuesped('${h.id}')">✏️</button>
          <button class="btn btn-red btn-sm" onclick="confirmDelete('huesped','${h.id}','${h.nombre} ${h.apellido}')">🗑</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="7" style="text-align:center;color:var(--text3)">Sin huéspedes</td></tr>';
}

export function showGuestDetail(id) {
  const h = DB.get('huespedes', []).find(x => x.id === id);
  if (!h) return;
  const reservas = DB.get('reservas', []).filter(r => r.huespedId === id);
  document.getElementById('guestDetailContent').innerHTML = `
    <div class="guest-detail" style="margin-bottom:20px">
      <div class="guest-avatar">${h.nombre[0]}${h.apellido[0]}</div>
      <div class="guest-info">
        <h3>${h.nombre} ${h.apellido}</h3>
        <div class="guest-meta">
          <span class="meta-chip">🪪 ${h.dni}</span>
          <span class="meta-chip">🌍 ${h.nac}</span>
          ${h.tel ? `<span class="meta-chip"><a href="https://wa.me/${h.tel.replace(/\D/g, '')}" target="_blank" style="color:inherit;text-decoration:none;">📱 ${h.tel}</a></span>` : ''}
          ${h.email ? `<span class="meta-chip">✉️ ${h.email}</span>` : ''}
          <span class="meta-chip">🏨 ${reservas.length} estadía(s)</span>
        </div>
      </div>
    </div>
    ${h.foto ? `<div style="margin-bottom:16px"><p style="font-size:12px;color:var(--text3);margin-bottom:6px">Documento:</p><img src="${h.foto}" style="max-width:100%;border-radius:8px;max-height:160px"></div>` : ''}
    <p style="font-size:12px;color:var(--text3);margin-bottom:8px">Historial de reservas:</p>
    <table><thead><tr><th>Entrada</th><th>Salida</th><th>Hab.</th><th>Total</th><th>Estado</th></tr></thead>
    <tbody>${reservas.map(r => `<tr>
      <td>${r.entrada}</td><td>${r.salida}</td><td>Hab.${r.hab}</td>
      <td>${fmtMoney(r.precio * nightsBetween(r.entrada, r.salida), r.moneda)}</td>
      <td>${estadoBadge(r.estado)}</td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text3)">Sin reservas</td></tr>'}</tbody></table>
  `;
  openModal('modalGuestDetail');
}

export function previewDoc(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('docPreview');
    img.src = e.target.result;
    img.style.display = 'block';
    document.getElementById('uploadZone').querySelector('span')?.remove();
  };
  reader.readAsDataURL(file);
}

export function saveHuesped() {
  const nombre = document.getElementById('h-nombre').value.trim();
  const apellido = document.getElementById('h-apellido').value.trim();
  const dni = document.getElementById('h-dni').value.trim();
  if (!nombre || !apellido || !dni) { showNotif('Nombre, apellido y DNI son obligatorios', 'error'); return; }
  const _emailVal = document.getElementById('h-email').value.trim();
  if (_emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(_emailVal)) { showNotif('Formato de email inválido', 'error'); return; }
  const foto = document.getElementById('docPreview').src || null;
  const huespedes = DB.get('huespedes', []);
  huespedes.push({
    id: 'h' + Date.now(), nombre, apellido, dni,
    nac: document.getElementById('h-nac').value,
    tel: document.getElementById('h-tel').value,
    email: document.getElementById('h-email').value,
    foto: foto && foto !== window.location.href ? foto : null,
    estadias: 0
  });
  DB.set('huespedes', huespedes);
  closeModal('modalHuesped');
  renderHuespedes();
  showNotif('Huésped registrado: ' + nombre + ' ' + apellido);
  ['h-nombre', 'h-apellido', 'h-dni', 'h-nac', 'h-tel', 'h-email'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('docPreview').style.display = 'none';
}

export function openEditHuesped(id) {
  const h = DB.get('huespedes', []).find(x => x.id === id);
  if (!h) return;
  document.getElementById('eh-id').value = h.id;
  document.getElementById('eh-nombre').value = h.nombre;
  document.getElementById('eh-apellido').value = h.apellido;
  document.getElementById('eh-dni').value = h.dni;
  document.getElementById('eh-nac').value = h.nac || '';
  document.getElementById('eh-tel').value = h.tel || '';
  document.getElementById('eh-email').value = h.email || '';
  document.getElementById('eh-score').value = h.score || '';
  document.getElementById('eh-obs').value = h.obs || '';
  renderScoreStars('eh-stars', 'eh-score', h.score || null);
  openModal('modalEditHuesped');
}

export async function saveEditHuesped() {
  const id = document.getElementById('eh-id').value;
  const nombre = document.getElementById('eh-nombre').value.trim();
  const apellido = document.getElementById('eh-apellido').value.trim();
  const dni = document.getElementById('eh-dni').value.trim();
  if (!nombre || !apellido || !dni) { showNotif('Nombre, apellido y DNI son obligatorios', 'error'); return; }
  const huespedes = DB.get('huespedes', []);
  const h = huespedes.find(x => x.id === id);
  if (!h) return;
  h.nombre = nombre; h.apellido = apellido; h.dni = dni;
  h.nac = document.getElementById('eh-nac').value;
  h.tel = document.getElementById('eh-tel').value;
  h.email = document.getElementById('eh-email').value;
  const sc = document.getElementById('eh-score').value;
  h.score = sc ? Number(sc) : null;
  h.obs = document.getElementById('eh-obs').value.trim();
  h.pendiente = false;
  await DB.set('huespedes', huespedes);
  closeModal('modalEditHuesped');
  renderHuespedes();
  showNotif('Huésped actualizado: ' + nombre + ' ' + apellido);
}

export function confirmDelete(tipo, id, nombre) {
  const msgs = {
    huesped: `¿Borrar al huésped <strong>${nombre}</strong>? También se eliminarán sus reservas asociadas.`,
    reserva: `¿Eliminar la <strong>${nombre}</strong>? Esta acción no se puede deshacer.`
  };
  document.getElementById('confirmDeleteMsg').innerHTML = msgs[tipo] || `¿Eliminar ${nombre}?`;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.onclick = async () => {
    if (tipo === 'huesped') {
      await deleteHuesped(id);
    } else {
      const { deleteReserva } = await import('./reservas.js');
      await deleteReserva(id);
    }
  };
  openModal('modalConfirmDelete');
}

export async function deleteHuesped(id) {
  const huespedes = DB.get('huespedes', []).filter(h => h.id !== id);
  const reservas = DB.get('reservas', []).filter(r => r.huespedId !== id);
  await DB.set('huespedes', huespedes);
  await DB.set('reservas', reservas);
  closeModal('modalConfirmDelete');
  renderHuespedes();
  const { renderReservas } = await import('./reservas.js');
  renderReservas();
  showNotif('Huésped eliminado');
}

// ===================== FORMULARIO PÚBLICO =====================
export function showPublicFormLink() {
  const url = window.location.href.split('?')[0] + '?registro=1';
  document.getElementById('publicFormUrl').textContent = url;
  openModal('modalPublicForm');
}

export function copyPublicLink() {
  const url = document.getElementById('publicFormUrl').textContent;
  navigator.clipboard.writeText(url).then(() => showNotif('Link copiado al portapapeles'));
}

export function openPublicFormPreview() {
  window.open(window.location.href.split('?')[0] + '?registro=1', '_blank');
}

export function checkPublicMode() {
  if (new URLSearchParams(window.location.search).get('registro') === '1') {
    showPublicRegistrationForm();
  }
}

export function showPublicRegistrationForm() {
  document.getElementById('loginScreen').innerHTML = `
    <div class="login-box" style="width:460px;">
      <div class="login-logo">
        <h1>🏨 Alula Hostel</h1>
        <p>Registro de huésped</p>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Nombre *</label><input type="text" id="pub-nombre" placeholder="Juan"></div>
        <div class="form-group"><label>Apellido *</label><input type="text" id="pub-apellido" placeholder="García"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>DNI / Pasaporte *</label><input type="text" id="pub-dni" placeholder="12345678"></div>
        <div class="form-group"><label>Nacionalidad *</label><input type="text" id="pub-nac" placeholder="Argentina"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Teléfono</label><input type="text" id="pub-tel" placeholder="+54 9 223..."></div>
        <div class="form-group"><label>Email</label><input type="email" id="pub-email" placeholder="email@ejemplo.com"></div>
      </div>
      <div class="form-group" style="margin-top:4px;">
        <label>Foto del documento (opcional)</label>
        <div class="upload-zone" onclick="document.getElementById('pub-foto').click()" id="pubUploadZone">
          📷 Tocá para subir foto del documento
          <input type="file" id="pub-foto" accept="image/*" style="display:none" onchange="previewPubDoc(this)">
          <img id="pubDocPreview" style="display:none;max-width:100%;max-height:120px;border-radius:6px;margin-top:8px;">
        </div>
      </div>
      <button class="btn-primary btn" style="margin-top:8px;" onclick="submitPublicRegistration()">Enviar mis datos</button>
      <div id="pub-msg" style="text-align:center;margin-top:12px;font-size:13px;"></div>
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border);text-align:center;">
        <button class="btn btn-ghost btn-sm" onclick="location.reload()">← Volver al login</button>
      </div>
    </div>`;
}

export function previewPubDoc(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('pubDocPreview');
    img.src = e.target.result;
    img.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

export async function submitPublicRegistration() {
  const nombre = document.getElementById('pub-nombre').value.trim();
  const apellido = document.getElementById('pub-apellido').value.trim();
  const dni = document.getElementById('pub-dni').value.trim();
  const nac = document.getElementById('pub-nac').value.trim();
  const msg = document.getElementById('pub-msg');
  if (!nombre || !apellido || !dni || !nac) { msg.style.color = '#f87171'; msg.textContent = 'Completá los campos obligatorios (*)'; return; }
  try {
    const { loadAllData } = await import('./firebase-config.js');
    await loadAllData();
    const huespedes = DB.get('huespedes', []);
    const foto = document.getElementById('pubDocPreview').src || null;
    huespedes.push({
      id: 'h' + Date.now(), nombre, apellido, dni, nac,
      tel: document.getElementById('pub-tel').value,
      email: document.getElementById('pub-email').value,
      foto: foto && foto !== window.location.href ? foto : null,
      estadias: 0, pendiente: true
    });
    await DB.set('huespedes', huespedes);
    msg.style.color = '#34d399';
    msg.textContent = '✅ ¡Datos enviados! El equipo del hostel los confirmará pronto.';
    document.querySelectorAll('#loginScreen input').forEach(i => i.value = '');
    document.getElementById('pubDocPreview').style.display = 'none';
  } catch(e) {
    msg.style.color = '#f87171';
    msg.textContent = 'Error al enviar. Intentá de nuevo.';
  }
}
