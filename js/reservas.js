// ===================== RESERVAS =====================
import { DB } from './firebase-config.js';
import { today, fmtMoney, platBadge, estadoBadge, pagoBadge, showNotif, openModal, closeModal, nightsBetween } from './helpers.js';
import { getConfig, habBeds, camaLabel } from './config.js';

function getHuespedNombre(id) {
  const h = DB.get('huespedes', []).find(x => x.id === id);
  return h ? h.nombre + ' ' + h.apellido : id;
}

export function renderReservas() {
  const reservas = DB.get('reservas', []);
  const q = document.getElementById('filterReserva')?.value.toLowerCase() || '';
  const estado = document.getElementById('filterEstado')?.value || '';
  const plat = document.getElementById('filterPlat')?.value || '';

  let filtered = reservas.filter(r => {
    const nombre = getHuespedNombre(r.huespedId).toLowerCase();
    const matchQ = !q || nombre.includes(q) || r.id.includes(q);
    const matchE = !estado || r.estado === estado;
    const matchP = !plat || r.plataforma === plat;
    return matchQ && matchE && matchP;
  });

  const tbody = document.getElementById('tablaReservas');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text3)">Sin reservas</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(r => {
    const nights = nightsBetween(r.entrada, r.salida);
    const total = fmtMoney(r.precio * nights, r.moneda);
    const canCheckin = r.estado === 'confirmada';
    const canCheckout = r.estado === 'checkin';
    const hasSaldo = Number(r.saldo || 0) > 0;
    return `<tr>
      <td style="font-family:'DM Mono';font-size:11px;color:var(--text3)">${r.id}</td>
      <td>${getHuespedNombre(r.huespedId)}</td>
      <td>Hab.${r.hab} / C${camaLabel(r.cama)}</td>
      <td>${r.entrada}</td><td>${r.salida}</td>
      <td style="text-align:center">${nights}</td>
      <td>${total}</td>
      <td>${platBadge(r.plataforma)}</td>
      <td>${estadoBadge(r.estado)}</td>
      <td>${pagoBadge(r)}</td>
      <td style="display:flex;gap:4px;flex-wrap:wrap;">
        ${canCheckin ? `<button class="btn btn-green btn-sm" onclick="doCheckin('${r.id}')">Check-in</button>` : ''}
        ${canCheckout ? `<button class="btn btn-amber btn-sm" onclick="doCheckout('${r.id}')">Check-out</button>` : ''}
        ${(canCheckin || canCheckout) ? `<button class="btn btn-ghost btn-sm" onclick="openCambioCama('${r.id}')">🔄 Cama</button>` : ''}
        ${canCheckout ? `<button class="btn btn-blue btn-sm" onclick="openExtender('${r.id}')">+ Días</button>` : ''}
        ${(canCheckin || canCheckout) && hasSaldo ? `<button class="btn btn-green btn-sm" onclick="openPago('${r.id}')">💰 Cobrar</button>` : ''}
        <button class="btn btn-red btn-sm" onclick="confirmDelete('reserva','${r.id}','reserva de ${getHuespedNombre(r.huespedId)}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

export function updateBedsSelect() {
  const hab = document.getElementById('res-hab').value;
  const entrada = document.getElementById('res-entrada').value;
  const salida = document.getElementById('res-salida').value;
  const sel = document.getElementById('res-cama');
  if (!hab) { sel.innerHTML = '<option>Primero elegí habitación</option>'; return; }
  const reservas = DB.get('reservas', []);
  const beds = habBeds(hab);
  sel.innerHTML = beds.map(b => {
    const reservasCama = reservas.filter(r =>
      r.cama === b.id && r.estado !== 'checkout'
    );
    let blocked = false;
    let motivo = '';
    if (entrada && salida) {
      blocked = reservasCama.some(r =>
        (r.estado === 'checkin' || r.estado === 'confirmada') &&
        r.entrada < salida && r.salida > entrada
      );
      if (blocked) motivo = ' (no disponible)';
    } else {
      const hoy = today();
      const tieneActiva = reservasCama.some(r =>
        (r.estado === 'checkin') || (r.estado === 'confirmada' && r.salida > hoy)
      );
      if (tieneActiva) motivo = ' (tiene reservas)';
    }
    return `<option value="${b.id}" ${blocked ? 'disabled' : ''}>Cama ${b.label}${motivo}</option>`;
  }).join('');
}

export function calcTotalReserva() {
  const precio = Number(document.getElementById('res-precio').value) || 0;
  const entrada = document.getElementById('res-entrada').value;
  const salida = document.getElementById('res-salida').value;
  const pagado = Number(document.getElementById('res-pagado').value) || 0;
  const moneda = document.getElementById('res-moneda').value;
  if (precio && entrada && salida) {
    const nights = nightsBetween(entrada, salida);
    const total = precio * Math.max(nights, 0);
    const saldo = Math.max(total - pagado, 0);
    document.getElementById('res-total-display').value = fmtMoney(total, moneda);
    document.getElementById('res-saldo-display').value = saldo > 0 ? fmtMoney(saldo, moneda) : '✓ Sin saldo';
  }
}

export function openNuevaReserva() {
  const huespedes = DB.get('huespedes', []);
  const sel = document.getElementById('res-huesped');
  sel.innerHTML = '<option value="">Seleccionar...</option>' +
    huespedes.map(h => `<option value="${h.id}">${h.nombre} ${h.apellido}</option>`).join('');
  openModal('modalReserva');
}

let savingReserva = false;
export async function saveReserva() {
  if (savingReserva) return;
  const btnGuardar = document.getElementById('btnGuardarReserva');
  if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = 'Guardando...'; }
  const h = document.getElementById('res-huesped').value;
  const hab = document.getElementById('res-hab').value;
  const cama = document.getElementById('res-cama').value;
  const entrada = document.getElementById('res-entrada').value;
  const salida = document.getElementById('res-salida').value;
  if (!h || !hab || !cama || !entrada || !salida) {
    showNotif('Completá todos los campos obligatorios', 'error');
    if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = 'Guardar Reserva'; }
    return;
  }
  const reservasExist = DB.get('reservas', []);
  const conflicto = reservasExist.some(r =>
    r.cama === cama &&
    (r.estado === 'checkin' || r.estado === 'confirmada') &&
    r.entrada < salida && r.salida > entrada
  );
  if (conflicto) {
    savingReserva = false;
    if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = 'Guardar Reserva'; }
    showNotif('Esa cama ya está reservada para esas fechas', 'error');
    return;
  }
  savingReserva = true;
  const precio = Number(document.getElementById('res-precio').value) || getConfig().temporadas.media.precio;
  const moneda = document.getElementById('res-moneda').value;
  const nights = nightsBetween(entrada, salida);
  const totalEstadia = Math.round(precio * nights);
  const pagado = Number(document.getElementById('res-pagado').value) || 0;
  const saldo = Math.max(totalEstadia - pagado, 0);
  const estadoPago = document.getElementById('res-estado-pago').value;
  const reservas = DB.get('reservas', []);
  const r = {
    id: 'r' + Date.now(),
    huespedId: h, hab, cama, entrada, salida,
    precio, moneda,
    pago: document.getElementById('res-pago').value,
    plataforma: document.getElementById('res-plat').value,
    estado: document.getElementById('res-estado').value,
    estadoPago, pagado, saldo,
    notas: document.getElementById('res-notas').value,
  };
  reservas.push(r);
  await DB.set('reservas', reservas);
  if (pagado > 0) {
    const movs = DB.get('movimientos', []);
    movs.push({ id: 'm' + Date.now(), tipo: 'ingreso', cat: 'reserva', moneda, monto: pagado, metodo: r.pago, fecha: today(), concepto: `${estadoPago === 'senia' ? 'Seña' : 'Pago'} reserva ${getHuespedNombre(h)} - Hab.${hab}` });
    await DB.set('movimientos', movs);
  }
  savingReserva = false;
  if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = 'Guardar Reserva'; }
  closeModal('modalReserva');
  renderReservas();
  showNotif('Reserva guardada correctamente');
}

export function doCheckin(rid) {
  const reservas = DB.get('reservas', []);
  const r = reservas.find(x => x.id === rid);
  if (!r) return;
  if (r.entrada > today()) {
    showNotif(`Check-in no permitido antes del ${r.entrada}`, 'error');
    return;
  }
  document.getElementById('ci-res-id').value = rid;
  const now = new Date();
  document.getElementById('ci-hora').value = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  document.getElementById('ci-llave').value = r.llave || '';
  document.getElementById('ci-obs').value = '';
  document.getElementById('ci-resumen').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
      <div><span style="color:var(--text3);display:block;font-size:11px">Huésped</span><strong>${getHuespedNombre(r.huespedId)}</strong></div>
      <div><span style="color:var(--text3);display:block;font-size:11px">Hab. / Cama</span><strong>Hab.${r.hab} / C${camaLabel(r.cama)}</strong></div>
      <div><span style="color:var(--text3);display:block;font-size:11px">Salida</span><strong>${r.salida}</strong></div>
    </div>`;
  openModal('modalCheckin');
}

export async function confirmCheckin() {
  const rid = document.getElementById('ci-res-id').value;
  const llave = document.getElementById('ci-llave').value.trim();
  const hora = document.getElementById('ci-hora').value;
  const obs = document.getElementById('ci-obs').value;
  const reservas = DB.get('reservas', []);
  const r = reservas.find(x => x.id === rid);
  if (!r) return;
  r.estado = 'checkin';
  r.llave = llave;
  r.horaCheckin = hora;
  r.obsCheckin = obs;
  if (!r.pagado || r.pagado === 0) {
    const nights = nightsBetween(r.entrada, r.salida);
    const movs = DB.get('movimientos', []);
    movs.push({ id: 'm' + Date.now(), tipo: 'ingreso', cat: 'reserva', moneda: r.moneda, monto: Math.round(r.precio * nights), metodo: r.pago, fecha: today(), concepto: `Check-in ${getHuespedNombre(r.huespedId)} - Hab.${r.hab}` });
    await DB.set('movimientos', movs);
    r.pagado = Math.round(r.precio * nights);
    r.saldo = 0;
    r.estadoPago = 'total';
  }
  await DB.set('reservas', reservas);
  closeModal('modalCheckin');
  renderReservas();
  const { renderCheckin } = await import('./checkin.js');
  renderCheckin();
  const { renderMapa } = await import('./mapa.js');
  renderMapa();
  showNotif(`✅ Check-in realizado: ${getHuespedNombre(r.huespedId)}${llave ? ' — Llave: ' + llave : ''}`);
}

export function openPago(rid) {
  const reservas = DB.get('reservas', []);
  const r = reservas.find(x => x.id === rid);
  if (!r) return;
  const nights = nightsBetween(r.entrada, r.salida);
  const total = r.precio * nights;
  document.getElementById('pago-res-id').value = rid;
  document.getElementById('pago-monto').value = r.saldo || '';
  document.getElementById('pago-concepto').value = `Saldo estadía ${getHuespedNombre(r.huespedId)}`;
  document.getElementById('pago-resumen').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
      <div><span style="color:var(--text3);display:block;font-size:11px">Huésped</span><strong>${getHuespedNombre(r.huespedId)}</strong></div>
      <div><span style="color:var(--text3);display:block;font-size:11px">Total estadía</span><strong style="color:var(--accent2)">${fmtMoney(total, r.moneda)}</strong></div>
      <div><span style="color:var(--text3);display:block;font-size:11px">Saldo pendiente</span><strong style="color:#fbbf24">${fmtMoney(r.saldo || 0, r.moneda)}</strong></div>
    </div>`;
  openModal('modalPago');
}

export function savePago() {
  const rid = document.getElementById('pago-res-id').value;
  const monto = Number(document.getElementById('pago-monto').value);
  const metodo = document.getElementById('pago-metodo').value;
  const concepto = document.getElementById('pago-concepto').value;
  if (!monto || monto <= 0) { showNotif('Ingresá un monto válido', 'error'); return; }
  const reservas = DB.get('reservas', []);
  const r = reservas.find(x => x.id === rid);
  if (!r) return;
  r.pagado = (Number(r.pagado) || 0) + monto;
  r.saldo = Math.max((Number(r.saldo) || 0) - monto, 0);
  r.estadoPago = r.saldo <= 0 ? 'total' : 'senia';
  DB.set('reservas', reservas);
  const movs = DB.get('movimientos', []);
  movs.push({ id: 'm' + Date.now(), tipo: 'ingreso', cat: 'reserva', moneda: r.moneda, monto, metodo, fecha: today(), concepto });
  DB.set('movimientos', movs);
  closeModal('modalPago');
  renderReservas();
  showNotif('💰 Pago registrado: ' + fmtMoney(monto, r.moneda));
}

export function openExtender(rid) {
  const reservas = DB.get('reservas', []);
  const r = reservas.find(x => x.id === rid);
  if (!r) return;
  document.getElementById('ext-res-id').value = rid;
  document.getElementById('ext-nueva-salida').value = r.salida;
  document.getElementById('ext-nueva-salida').min = r.salida;
  document.getElementById('ext-noches-extra').value = '0';
  document.getElementById('ext-monto-extra').value = fmtMoney(0, r.moneda);
  document.getElementById('ext-resumen').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
      <div><span style="color:var(--text3);display:block;font-size:11px">Huésped</span><strong>${getHuespedNombre(r.huespedId)}</strong></div>
      <div><span style="color:var(--text3);display:block;font-size:11px">Salida actual</span><strong style="color:#fbbf24">${r.salida}</strong></div>
      <div><span style="color:var(--text3);display:block;font-size:11px">Precio/noche</span><strong style="color:var(--accent2)">${fmtMoney(r.precio, r.moneda)}</strong></div>
    </div>`;
  document.getElementById('ext-nueva-salida').addEventListener('input', () => calcExtension(r));
  document.getElementById('ext-cobrar').addEventListener('change', function() {
    document.getElementById('ext-pago-row').style.display = this.value === 'si' ? '' : 'none';
  });
  openModal('modalExtender');
}

export function calcExtension(r) {
  const nuevaSalida = document.getElementById('ext-nueva-salida').value;
  if (!nuevaSalida || nuevaSalida <= r.salida) {
    document.getElementById('ext-noches-extra').value = '0';
    document.getElementById('ext-monto-extra').value = fmtMoney(0, r.moneda);
    return;
  }
  const extra = nightsBetween(r.salida, nuevaSalida);
  const montoExtra = extra * r.precio;
  document.getElementById('ext-noches-extra').value = extra + ' noche(s)';
  document.getElementById('ext-monto-extra').value = fmtMoney(montoExtra, r.moneda);
}

export async function saveExtension() {
  const rid = document.getElementById('ext-res-id').value;
  const nuevaSalida = document.getElementById('ext-nueva-salida').value;
  const cobrar = document.getElementById('ext-cobrar').value;
  const metodo = document.getElementById('ext-metodo').value;
  const reservas = DB.get('reservas', []);
  const r = reservas.find(x => x.id === rid);
  if (!r || !nuevaSalida || nuevaSalida <= r.salida) { showNotif('Elegí una fecha posterior a la salida actual', 'error'); return; }
  const extra = nightsBetween(r.salida, nuevaSalida);
  const montoExtra = extra * r.precio;
  r.salida = nuevaSalida;
  if (cobrar === 'si') {
    r.pagado = (Number(r.pagado) || 0) + montoExtra;
    const movs = DB.get('movimientos', []);
    movs.push({ id: 'm' + Date.now(), tipo: 'ingreso', cat: 'reserva', moneda: r.moneda, monto: montoExtra, metodo, fecha: today(), concepto: `Extensión ${extra} noche(s) - ${getHuespedNombre(r.huespedId)} Hab.${r.hab}` });
    await DB.set('movimientos', movs);
  } else {
    r.saldo = (Number(r.saldo) || 0) + montoExtra;
    r.estadoPago = 'senia';
  }
  await DB.set('reservas', reservas);
  closeModal('modalExtender');
  renderReservas();
  showNotif(`📅 Estadía extendida ${extra} noche(s) hasta ${nuevaSalida}`);
}

export async function doCheckout(rid) {
  const reservas = DB.get('reservas', []);
  const r = reservas.find(x => x.id === rid);
  if (!r) return;
  r.estado = 'checkout';
  const beds = DB.get('beds', {});
  beds[r.cama] = 'dirty';
  await DB.set('beds', beds);
  await DB.set('reservas', reservas);
  renderReservas();
  const { renderCheckin } = await import('./checkin.js');
  renderCheckin();
  const { renderMapa } = await import('./mapa.js');
  renderMapa();
  showNotif('🚪 Check-out realizado: ' + getHuespedNombre(r.huespedId));
}

export async function limpiarDuplicados() {
  const reservas = DB.get('reservas', []);
  const vistas = new Set();
  const limpias = [];
  const duplicadas = [];
  for (const r of reservas) {
    const key = `${r.cama}|${r.entrada}|${r.salida}`;
    if (vistas.has(key)) {
      duplicadas.push(r.id);
    } else {
      vistas.add(key);
      limpias.push(r);
    }
  }
  if (duplicadas.length === 0) {
    showNotif('✅ No hay reservas duplicadas', 'success');
    return;
  }
  if (!confirm(`Se encontraron ${duplicadas.length} reserva(s) duplicada(s). ¿Eliminamos?`)) return;
  await DB.set('reservas', limpias);
  renderReservas();
  showNotif(`🧹 ${duplicadas.length} duplicado(s) eliminado(s)`);
}

// ===================== CAMBIO DE CAMA =====================
export function openCambioCama(rid) {
  const reservas = DB.get('reservas', []);
  const r = reservas.find(x => x.id === rid);
  if (!r) return;
  document.getElementById('cc-res-id').value = rid;
  document.getElementById('cc-hab').value = r.hab;
  document.getElementById('cc-motivo').value = '';
  document.getElementById('cc-llave').value = r.llave || '';
  document.getElementById('cc-resumen').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
      <div><span style="color:var(--text3);display:block;font-size:11px">Huésped</span><strong>${getHuespedNombre(r.huespedId)}</strong></div>
      <div><span style="color:var(--text3);display:block;font-size:11px">Cama actual</span><strong style="color:#fbbf24">Hab.${r.hab} — Cama ${camaLabel(r.cama)}</strong></div>
      <div><span style="color:var(--text3);display:block;font-size:11px">Período</span><strong>${r.entrada} → ${r.salida}</strong></div>
    </div>`;
  updateCambioCamaSelect();
  openModal('modalCambioCama');
}

export function updateCambioCamaSelect() {
  const rid = document.getElementById('cc-res-id').value;
  const hab = document.getElementById('cc-hab').value;
  const reservas = DB.get('reservas', []);
  const r = reservas.find(x => x.id === rid);
  if (!r) return;
  const sel = document.getElementById('cc-cama');
  const beds = habBeds(hab);
  sel.innerHTML = beds.map(b => {
    if (b.id === r.cama) return '';
    const blocked = reservas.some(x =>
      x.id !== rid && x.cama === b.id &&
      (x.estado === 'checkin' || x.estado === 'confirmada') &&
      x.entrada < r.salida && x.salida > r.entrada
    );
    return `<option value="${b.id}" ${blocked ? 'disabled' : ''}>Cama ${b.label}${blocked ? ' (ocupada)' : ''}</option>`;
  }).filter(Boolean).join('');
  if (!sel.innerHTML) sel.innerHTML = '<option disabled>No hay camas disponibles en esta habitación</option>';
}

export async function saveCambioCama() {
  const rid = document.getElementById('cc-res-id').value;
  const nuevaHab = document.getElementById('cc-hab').value;
  const nuevaCama = document.getElementById('cc-cama').value;
  const motivo = document.getElementById('cc-motivo').value;
  const nuevaLlave = document.getElementById('cc-llave').value.trim();
  if (!nuevaCama) { showNotif('Seleccioná una cama disponible', 'error'); return; }
  const reservas = DB.get('reservas', []);
  const r = reservas.find(x => x.id === rid);
  if (!r) return;
  const camaAnterior = camaLabel(r.cama);
  const beds = DB.get('beds', {});
  delete beds[r.cama];
  delete beds[nuevaCama];
  await DB.set('beds', beds);
  r.cama = nuevaCama;
  r.hab = nuevaHab;
  if (nuevaLlave) r.llave = nuevaLlave;
  if (motivo) r.notas = (r.notas ? r.notas + ' | ' : '') + 'Cambio de cama: ' + motivo;
  await DB.set('reservas', reservas);
  closeModal('modalCambioCama');
  renderReservas();
  const { renderCheckin } = await import('./checkin.js');
  renderCheckin();
  const { renderMapa } = await import('./mapa.js');
  renderMapa(document.getElementById('mapaFecha')?.value);
  showNotif(`🔄 Cambio realizado: cama ${camaAnterior} → cama ${camaLabel(nuevaCama)}`);
}

// ===================== LATE CHECK-OUT / EARLY CHECK-IN =====================
export function openHorario(rid, tipo) {
  const reservas = DB.get('reservas', []);
  const r = reservas.find(x => x.id === rid);
  if (!r) return;
  document.getElementById('horario-res-id').value = rid;
  document.getElementById('horario-tipo').value = tipo;
  const isLate = tipo === 'late';
  const _hor = getConfig().horarios;
  document.getElementById('modalHorarioTitle').textContent = isLate ? '🌙 Late Check-out' : '🌅 Early Check-in';
  document.getElementById('horario-hora-label').textContent = isLate ? 'Hora de salida solicitada' : 'Hora de entrada solicitada';
  document.getElementById('horario-estandar').value = isLate ? _hor.checkout : _hor.checkin;
  document.getElementById('horario-hora').value = isLate ? _hor.lateCheckout : _hor.earlyCheckin;
  document.getElementById('horario-cobrar').value = 'no';
  document.getElementById('horario-monto').value = '';
  document.getElementById('horario-monto-group').style.display = 'none';
  document.getElementById('horario-pago-group').style.display = 'none';
  document.getElementById('horario-notas').value = '';
  document.getElementById('horario-resumen').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div><span style="color:var(--text3);display:block;font-size:11px">Huésped</span><strong>${getHuespedNombre(r.huespedId)}</strong></div>
      <div><span style="color:var(--text3);display:block;font-size:11px">Hab. / Cama</span><strong>Hab.${r.hab} / C${camaLabel(r.cama)}</strong></div>
      <div><span style="color:var(--text3);display:block;font-size:11px">${isLate ? 'Salida estándar' : 'Entrada estándar'}</span><strong style="color:#fbbf24">${isLate ? _hor.checkout : _hor.checkin} hs</strong></div>
      <div><span style="color:var(--text3);display:block;font-size:11px">${isLate ? 'Fecha de salida' : 'Fecha de entrada'}</span><strong>${isLate ? r.salida : r.entrada}</strong></div>
    </div>`;
  openModal('modalHorario');
}

export function toggleHorarioCobro() {
  const cobrar = document.getElementById('horario-cobrar').value === 'si';
  document.getElementById('horario-monto-group').style.display = cobrar ? '' : 'none';
  document.getElementById('horario-pago-group').style.display = cobrar ? '' : 'none';
}

export async function saveHorario() {
  const rid = document.getElementById('horario-res-id').value;
  const tipo = document.getElementById('horario-tipo').value;
  const hora = document.getElementById('horario-hora').value;
  const cobrar = document.getElementById('horario-cobrar').value === 'si';
  const monto = Number(document.getElementById('horario-monto').value) || 0;
  const moneda = document.getElementById('horario-moneda').value;
  const metodo = document.getElementById('horario-metodo').value;
  const notas = document.getElementById('horario-notas').value;
  if (!hora) { showNotif('Ingresá la hora', 'error'); return; }
  if (cobrar && monto <= 0) { showNotif('Ingresá un monto válido', 'error'); return; }

  const reservas = DB.get('reservas', []);
  const r = reservas.find(x => x.id === rid);
  if (!r) return;

  if (!r.horariosEspeciales) r.horariosEspeciales = [];
  r.horariosEspeciales.push({
    tipo, hora, cobrado: cobrar, monto: cobrar ? monto : 0,
    moneda, metodo, notas, fecha: today()
  });

  if (cobrar && monto > 0) {
    const movs = DB.get('movimientos', []);
    const label = tipo === 'late' ? 'Late Check-out' : 'Early Check-in';
    movs.push({ id: 'm' + Date.now(), tipo: 'ingreso', cat: 'reserva', moneda, monto, metodo, fecha: today(),
      concepto: `${label} ${hora}hs — ${getHuespedNombre(r.huespedId)} Hab.${r.hab}` });
    await DB.set('movimientos', movs);
  }
  await DB.set('reservas', reservas);
  closeModal('modalHorario');
  const { renderCheckin } = await import('./checkin.js');
  renderCheckin();
  const label = tipo === 'late' ? 'Late check-out' : 'Early check-in';
  showNotif(`✅ ${label} registrado a las ${hora}hs${cobrar ? ' — ' + fmtMoney(monto, moneda) + ' cobrado' : ' (cortesía)'}`);
}

export async function deleteReserva(id) {
  const allRes = DB.get('reservas', []);
  const toDelete = allRes.find(r => r.id === id);
  await DB.set('reservas', allRes.filter(r => r.id !== id));
  if (toDelete) {
    const beds = DB.get('beds', {});
    delete beds[toDelete.cama];
    await DB.set('beds', beds);
  }
  closeModal('modalConfirmDelete');
  renderReservas();
  showNotif('Reserva eliminada');
}
