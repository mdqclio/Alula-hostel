// ===================== RESERVAS GRUPALES =====================
// Un grupo vive en alula/grupos/{id} (objeto por id, se escribe nodo a nodo)
// y se materializa como N reservas hijas normales en alula/reservas, una por
// cama, con precio 0 y esGrupal:true. El dinero vive SOLO en el grupo: los
// pagos generan movimientos con grupoId y actualizan pagado/saldo del grupo.
import { ref, set } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";
import { DB, db, cache } from './firebase-config.js';
import { closeModal, escapeHtml, estadoBadge, fmtMoney, nightsBetween, openModal, showNotif, today } from './helpers.js';
import { getConfig, getCuentas, habBeds, camaLabel, metodosOptions } from './config.js';
import { validarGrupo, construirReservasHijas, aplicarPagoGrupo } from './services/grupos.service.js';
import { logAuditoria } from './auditoria.js';

const NUEVO_TITULAR = '__nuevo';

function getHuespedNombre(id) {
  const h = DB.get('huespedes', []).find(x => x.id === id);
  return h ? h.nombre + ' ' + h.apellido : id;
}

export function getGrupo(gid) {
  return (DB.get('grupos', {}) || {})[gid] || null;
}

// Escribe un grupo en su propio nodo (no reescribe el nodo grupos completo).
export async function guardarGrupo(g) {
  if (!cache.grupos || typeof cache.grupos !== 'object') cache.grupos = {};
  cache.grupos[g.id] = g;
  await set(ref(db, 'alula/grupos/' + g.id), g);
}

function horaActual() {
  const now = new Date();
  return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
}

// Re-render de las vistas que muestran reservas, solo si están montadas.
async function refrescarVistas() {
  if (document.getElementById('tablaReservas')) {
    const { renderReservas } = await import('./reservas.js');
    renderReservas();
  }
  if (document.getElementById('tablaCheckin')) {
    const { renderCheckin } = await import('./checkin.js');
    renderCheckin();
  }
  if (document.getElementById('roomsGrid')) {
    const { renderMapa } = await import('./mapa.js');
    renderMapa(document.getElementById('mapaFecha')?.value);
  }
  if (document.getElementById('grillaContainer')) {
    const { renderGrilla } = await import('./grilla.js');
    renderGrilla();
  }
}

// ===================== ALTA =====================
export function openReservaGrupal() {
  const huespedes = DB.get('huespedes', []);
  document.getElementById('grp-titular').innerHTML =
    '<option value="">Seleccionar...</option>' +
    `<option value="${NUEVO_TITULAR}">+ Alta rápida de titular</option>` +
    huespedes.map(h => `<option value="${h.id}">${escapeHtml(h.nombre)} ${escapeHtml(h.apellido)} — ${escapeHtml(h.dni)}</option>`).join('');
  ['grp-nombre', 'grp-entrada', 'grp-salida', 'grp-total', 'grp-senia', 'grp-integrantes', 'grp-obs',
   'grp-tit-nombre', 'grp-tit-apellido', 'grp-tit-dni'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('grp-moneda').value = 'ARS';
  document.getElementById('grp-senia-metodo').innerHTML = metodosOptions('efectivo');
  document.getElementById('grp-senia-cuenta').innerHTML = '<option value="">Sin asignar</option>' +
    getCuentas().filter(c => c.activa).map(c =>
      `<option value="${escapeHtml(c.id)}">${escapeHtml(c.nombre)} (${escapeHtml(c.moneda)})</option>`
    ).join('');
  toggleTitularNuevo();
  renderGrupoCamas();
  openModal('modalReservaGrupal');
}

export function toggleTitularNuevo() {
  const nuevo = document.getElementById('grp-titular').value === NUEVO_TITULAR;
  document.getElementById('grp-titular-nuevo').style.display = nuevo ? '' : 'none';
}

// Lista de camas con checkbox, deshabilitando las ocupadas en el rango.
export function renderGrupoCamas() {
  const entrada = document.getElementById('grp-entrada').value;
  const salida = document.getElementById('grp-salida').value;
  const cont = document.getElementById('grp-camas');
  const rangoOk = entrada && salida && salida > entrada;
  if (!rangoOk) {
    cont.innerHTML = `<p style="font-size:12px;color:var(--text3);margin:0">${entrada && salida ? 'La salida debe ser posterior a la entrada' : 'Elegí las fechas para ver camas disponibles'}</p>`;
    actualizarContadorCamas();
    return;
  }
  const reservas = DB.get('reservas', []);
  const ocupada = camaId => reservas.some(r =>
    r.cama === camaId &&
    (r.estado === 'checkin' || r.estado === 'confirmada') &&
    r.entrada < salida && r.salida > entrada
  );
  const habs = getConfig().hostel.habitaciones.filter(h => h.activa && h.camas > 0);
  cont.innerHTML = habs.map(h => {
    const camas = habBeds(h.id).map(b => {
      const busy = ocupada(b.id);
      return `<label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;margin:0 10px 6px 0;${busy ? 'opacity:.45;' : 'cursor:pointer;'}">
        <input type="checkbox" class="grp-cama-chk" value="${b.id}" ${busy ? 'disabled' : ''} onchange="actualizarContadorCamas()">
        C${b.label}${busy ? ' (ocupada)' : ''}
      </label>`;
    }).join('');
    return `<div style="margin-bottom:6px;"><div style="font-size:11px;color:var(--text3);margin-bottom:4px;">${escapeHtml(h.nombre)}</div>${camas}</div>`;
  }).join('');
  actualizarContadorCamas();
}

export function seleccionarTodoHostel() {
  const chks = [...document.querySelectorAll('.grp-cama-chk:not(:disabled)')];
  if (!chks.length) { showNotif('Elegí primero las fechas', 'error'); return; }
  const todas = chks.every(c => c.checked);
  chks.forEach(c => { c.checked = !todas; });
  actualizarContadorCamas();
}

export function actualizarContadorCamas() {
  const libres = document.querySelectorAll('.grp-cama-chk:not(:disabled)').length;
  const sel = document.querySelectorAll('.grp-cama-chk:checked').length;
  const el = document.getElementById('grp-camas-count');
  if (el) el.textContent = libres ? `${sel} de ${libres} disponibles seleccionadas` : '';
}

let savingGrupo = false;
export async function saveReservaGrupal() {
  if (savingGrupo) return;
  const titularSel = document.getElementById('grp-titular').value;
  const esNuevo = titularSel === NUEVO_TITULAR;
  const tit = {
    nombre: document.getElementById('grp-tit-nombre').value.trim(),
    apellido: document.getElementById('grp-tit-apellido').value.trim(),
    dni: document.getElementById('grp-tit-dni').value.trim(),
  };
  if (esNuevo && (!tit.nombre || !tit.apellido || !tit.dni)) {
    showNotif('Titular nuevo: nombre, apellido y DNI son obligatorios', 'error');
    return;
  }

  const datos = {
    nombre: document.getElementById('grp-nombre').value.trim(),
    huespedTitularId: esNuevo ? NUEVO_TITULAR : titularSel,
    entrada: document.getElementById('grp-entrada').value,
    salida: document.getElementById('grp-salida').value,
    camas: [...document.querySelectorAll('.grp-cama-chk:checked')].map(c => c.value),
    totalAcordado: Number(document.getElementById('grp-total').value),
    senia: document.getElementById('grp-senia').value,
    reservas: DB.get('reservas', []),
  };
  const v = validarGrupo(datos);
  if (!v.ok) { showNotif(v.errores[0], 'error'); return; }

  savingGrupo = true;
  const btn = document.getElementById('btnGuardarGrupo');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  try {
    let huespedTitularId = titularSel;
    if (esNuevo) {
      // Mismo shape que el alta de huésped del módulo huespedes.js.
      const huespedes = DB.get('huespedes', []);
      const nuevoH = {
        id: 'h' + Date.now(),
        nombre: tit.nombre, apellido: tit.apellido, dni: tit.dni,
        nac: '', tel: '', email: '', ciudad: '', provincia: '',
        fechaNacimiento: '', genero: '', foto: null,
        estadias: 0
      };
      huespedes.push(nuevoH);
      await DB.set('huespedes', huespedes);
      logAuditoria('crear', 'huesped', nuevoH.id, `Nuevo huésped (titular de grupo): ${nuevoH.nombre} ${nuevoH.apellido} — DNI ${nuevoH.dni}`, null, { nombre: nuevoH.nombre, apellido: nuevoH.apellido, dni: nuevoH.dni });
      huespedTitularId = nuevoH.id;
    }

    const total = Math.round(datos.totalAcordado);
    const grupo = {
      id: 'g' + Date.now(),
      nombre: datos.nombre,
      huespedTitularId,
      entrada: datos.entrada,
      salida: datos.salida,
      camas: datos.camas,
      totalAcordado: total,
      moneda: document.getElementById('grp-moneda').value,
      pagado: 0,
      saldo: total,
      integrantes: document.getElementById('grp-integrantes').value,
      obs: document.getElementById('grp-obs').value,
      estado: 'confirmada',
    };
    // Seña opcional: mismo efecto que "Pago al grupo" (pagado/saldo + movimiento con grupoId).
    const senia = Math.round(Number(datos.senia) || 0);
    let movSenia = null;
    if (senia > 0) {
      const res = aplicarPagoGrupo(grupo, senia);
      if (!res.ok) { showNotif(res.error, 'error'); return; }
      grupo.pagado = res.pagado;
      grupo.saldo = res.saldo;
      movSenia = {
        id: 'm' + Date.now(), tipo: 'ingreso', cat: 'reserva', moneda: grupo.moneda, monto: senia,
        metodo: document.getElementById('grp-senia-metodo').value, fecha: today(),
        concepto: `Seña grupo ${grupo.nombre}`,
        cuenta: document.getElementById('grp-senia-cuenta').value || null,
        grupoId: grupo.id,
      };
    }
    await guardarGrupo(grupo);
    const reservas = DB.get('reservas', []);
    reservas.push(...construirReservasHijas(grupo));
    await DB.set('reservas', reservas);

    logAuditoria('crear', 'grupo', grupo.id,
      `Nueva reserva grupal: ${grupo.nombre} — ${grupo.camas.length} camas ${grupo.entrada}→${grupo.salida}, total ${fmtMoney(total, grupo.moneda)}`,
      null, grupo);
    if (movSenia) {
      const movs = DB.get('movimientos', []);
      movs.push(movSenia);
      await DB.set('movimientos', movs);
      logAuditoria('editar', 'grupo', grupo.id, `Pago grupal registrado (seña): ${fmtMoney(senia, grupo.moneda)} — ${grupo.nombre}`);
    }
    closeModal('modalReservaGrupal');
    await refrescarVistas();
    showNotif(`👥 Grupo creado: ${grupo.nombre} (${grupo.camas.length} camas)`);
  } catch (e) {
    console.error('[grupos] error guardando grupo:', e);
    showNotif('No se pudo guardar el grupo. Revisá la conexión.', 'error');
  } finally {
    savingGrupo = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Crear grupo'; }
  }
}

// ===================== LISTA (sección Reservas) =====================
// Acceso directo a los grupos no cancelados, próximos primero.
export function renderListaGrupos() {
  const tbody = document.getElementById('tablaGrupos');
  if (!tbody) return;
  const grupos = Object.values(DB.get('grupos', {}) || {})
    .filter(g => g && g.estado !== 'cancelada')
    .sort((a, b) => (a.entrada || '').localeCompare(b.entrada || ''));
  if (!grupos.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text3)">Sin grupos activos</td></tr>';
    return;
  }
  tbody.innerHTML = grupos.map(g => {
    const saldo = Number(g.saldo) || 0;
    return `<tr style="cursor:pointer" onclick="openGrupo('${escapeHtml(g.id)}')">
      <td><strong>${escapeHtml(g.nombre)}</strong></td>
      <td>${escapeHtml(g.entrada)}</td><td>${escapeHtml(g.salida)}</td>
      <td style="text-align:center">${(g.camas || []).length}</td>
      <td>${fmtMoney(g.totalAcordado || 0, g.moneda)}</td>
      <td style="color:#34d399">${fmtMoney(g.pagado || 0, g.moneda)}</td>
      <td style="color:${saldo > 0 ? '#fbbf24' : '#34d399'}">${saldo > 0 ? fmtMoney(saldo, g.moneda) : '✓ Al día'}</td>
      <td>${estadoBadge(g.estado)}</td>
    </tr>`;
  }).join('');
}

// ===================== DETALLE =====================
export function openGrupo(gid) {
  const g = getGrupo(gid);
  if (!g) { showNotif('No se encontró el grupo', 'error'); return; }
  const noches = nightsBetween(g.entrada, g.salida);
  const saldo = Number(g.saldo) || 0;
  const camas = (g.camas || []).map(c => 'C' + camaLabel(c)).join(', ');
  const celda = (label, val, color) =>
    `<div style="background:var(--surface2);border-radius:var(--radius);padding:10px;">
      <span style="font-size:11px;color:var(--text3);display:block">${label}</span>
      <strong${color ? ` style="color:${color}"` : ''}>${val}</strong>
    </div>`;

  document.getElementById('modalGrupoTitle').textContent = '👥 ' + g.nombre;
  document.getElementById('grupoDetalleContent').innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
      ${estadoBadge(g.estado)}
      <span style="font-size:13px;color:var(--text2)">Titular: <strong>${escapeHtml(getHuespedNombre(g.huespedTitularId))}</strong></span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">
      ${celda('Entrada', g.entrada)}
      ${celda('Salida', g.salida)}
      ${celda('Noches', noches)}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
      ${celda('Total acordado', fmtMoney(g.totalAcordado, g.moneda), 'var(--accent2)')}
      ${celda('Pagado', fmtMoney(g.pagado || 0, g.moneda), '#34d399')}
      ${celda('Saldo', saldo > 0 ? fmtMoney(saldo, g.moneda) : '✓ Al día', saldo > 0 ? '#fbbf24' : '#34d399')}
    </div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:4px;">Camas (${(g.camas || []).length})</div>
    <div style="font-size:13px;margin-bottom:12px;">${escapeHtml(camas)}</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:4px;">Integrantes</div>
    <div style="font-size:13px;white-space:pre-wrap;background:var(--surface2);border-radius:var(--radius);padding:10px;margin-bottom:12px;max-height:180px;overflow:auto;">${escapeHtml(g.integrantes) || '<span style="color:var(--text3)">Sin cargar</span>'}</div>
    ${g.obs ? `<div style="font-size:12px;color:var(--text3);margin-bottom:4px;">Observaciones</div>
    <div style="font-size:13px;white-space:pre-wrap;background:var(--surface2);border-radius:var(--radius);padding:10px;">${escapeHtml(g.obs)}</div>` : ''}
  `;

  const acciones = [];
  if (g.estado === 'confirmada') acciones.push(`<button class="btn btn-green" onclick="checkinGrupo('${g.id}')">✅ Check-in grupal</button>`);
  if (g.estado === 'checkin') acciones.push(`<button class="btn btn-amber" onclick="checkoutGrupo('${g.id}')">🚪 Check-out grupal</button>`);
  if (g.estado !== 'cancelada' && saldo > 0) acciones.push(`<button class="btn btn-blue" onclick="openPagoGrupo('${g.id}')">💰 Registrar pago</button>`);
  if (g.estado === 'confirmada') acciones.push(`<button class="btn btn-red" onclick="cancelarGrupo('${g.id}')">Cancelar grupo</button>`);
  acciones.push(`<button class="btn btn-ghost" onclick="closeModal('modalGrupo')">Cerrar</button>`);
  document.getElementById('grupoDetalleAcciones').innerHTML = acciones.join('');
  openModal('modalGrupo');
}

// Cambia de estado al grupo y a sus hijas que estén en `desde`.
async function transicionarGrupo(g, desde, hasta, extraHija) {
  const reservas = DB.get('reservas', []);
  const hijas = reservas.filter(r => r.grupoId === g.id && desde.includes(r.estado));
  hijas.forEach(r => { r.estado = hasta; if (extraHija) extraHija(r); });
  g.estado = hasta;
  await guardarGrupo(g);
  await DB.set('reservas', reservas);
  return hijas;
}

export async function checkinGrupo(gid) {
  const g = getGrupo(gid);
  if (!g || g.estado !== 'confirmada') return;
  if (g.entrada > today()) {
    showNotif(`Check-in no permitido antes del ${g.entrada}`, 'error');
    return;
  }
  const hora = horaActual();
  const hijas = await transicionarGrupo(g, ['confirmada'], 'checkin', r => { r.horaCheckin = hora; });
  logAuditoria('editar', 'grupo', gid, `Check-in grupal: ${g.nombre} — ${hijas.length} camas`);
  closeModal('modalGrupo');
  await refrescarVistas();
  showNotif(`✅ Check-in grupal: ${g.nombre} (${hijas.length} camas)`);
}

export async function checkoutGrupo(gid) {
  const g = getGrupo(gid);
  if (!g || g.estado !== 'checkin') return;
  const saldo = Number(g.saldo) || 0;
  if (saldo > 0 && !confirm(`El grupo todavía debe ${fmtMoney(saldo, g.moneda)}. ¿Hacer el check-out igual?`)) return;
  const hijas = await transicionarGrupo(g, ['checkin'], 'checkout');
  const beds = DB.get('beds', {});
  hijas.forEach(r => { beds[r.cama] = 'dirty'; });
  await DB.set('beds', beds);
  logAuditoria('editar', 'grupo', gid, `Check-out grupal: ${g.nombre} — ${hijas.length} camas`);
  closeModal('modalGrupo');
  await refrescarVistas();
  showNotif(`🚪 Check-out grupal: ${g.nombre}`);
}

export async function cancelarGrupo(gid) {
  const g = getGrupo(gid);
  if (!g || g.estado !== 'confirmada') return;
  const pagado = Number(g.pagado) || 0;
  const aviso = pagado > 0 ? `\n\nYa se cobraron ${fmtMoney(pagado, g.moneda)}: el reintegro, si corresponde, se registra aparte en Caja.` : '';
  if (!confirm(`¿Cancelar el grupo "${g.nombre}" y liberar sus ${(g.camas || []).length} camas?${aviso}`)) return;
  const antes = { ...g };
  const hijas = await transicionarGrupo(g, ['confirmada'], 'cancelada');
  logAuditoria('editar', 'grupo', gid, `Grupo cancelado: ${g.nombre} — ${hijas.length} camas liberadas`, antes, g);
  closeModal('modalGrupo');
  await refrescarVistas();
  showNotif(`Grupo cancelado: ${g.nombre}`);
}

// ===================== PAGO AL GRUPO =====================
export function openPagoGrupo(gid) {
  const g = getGrupo(gid);
  if (!g) return;
  document.getElementById('pg-grupo-id').value = gid;
  document.getElementById('pg-monto').value = g.saldo || '';
  document.getElementById('pg-metodo').innerHTML = metodosOptions('efectivo');
  document.getElementById('pg-concepto').value = `Pago grupo ${g.nombre}`;
  document.getElementById('pg-resumen').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
      <div><span style="color:var(--text3);display:block;font-size:11px">Grupo</span><strong>${escapeHtml(g.nombre)}</strong></div>
      <div><span style="color:var(--text3);display:block;font-size:11px">Total acordado</span><strong style="color:var(--accent2)">${fmtMoney(g.totalAcordado, g.moneda)}</strong></div>
      <div><span style="color:var(--text3);display:block;font-size:11px">Saldo pendiente</span><strong style="color:#fbbf24">${fmtMoney(g.saldo || 0, g.moneda)}</strong></div>
    </div>`;
  closeModal('modalGrupo');
  openModal('modalPagoGrupo');
}

export async function savePagoGrupo() {
  const gid = document.getElementById('pg-grupo-id').value;
  const g = getGrupo(gid);
  if (!g || g.estado === 'cancelada') return;
  const monto = Number(document.getElementById('pg-monto').value);
  const res = aplicarPagoGrupo(g, monto);
  if (!res.ok) { showNotif(res.error, 'error'); return; }
  const metodo = document.getElementById('pg-metodo').value;
  const concepto = document.getElementById('pg-concepto').value.trim() || `Pago grupo ${g.nombre}`;
  g.pagado = res.pagado;
  g.saldo = res.saldo;
  await guardarGrupo(g);
  const movs = DB.get('movimientos', []);
  movs.push({ id: 'm' + Date.now(), tipo: 'ingreso', cat: 'reserva', moneda: g.moneda, monto, metodo, fecha: today(), concepto, grupoId: gid });
  await DB.set('movimientos', movs);
  logAuditoria('editar', 'grupo', gid, `Pago grupal registrado: ${fmtMoney(monto, g.moneda)} — ${g.nombre}`);
  closeModal('modalPagoGrupo');
  await refrescarVistas();
  showNotif('💰 Pago registrado: ' + fmtMoney(monto, g.moneda));
}
