// ===================== CAJA DIARIA =====================
import { DB } from './firebase-config.js';
import { closeModal, escapeHtml, fmtMoney, movAnulacionTag, movAnularBtn, movRowStyle, openModal, showNotif, today } from './helpers.js';
import { getCuentas, getCategorias, cuentasOptions } from './config.js';
import { logAuditoria } from './auditoria.js';
import { construirAnulacion, puedeAnular, revertirPagoGrupo, revertirPagoReserva, validarCuentaMovimiento } from './services/movimientos.service.js';
import { getGrupo, guardarGrupo } from './grupos.js';

// ===== TIPO DE CAMBIO (bluelytics) =====
async function fetchTC() {
  try {
    const res = await fetch('https://api.bluelytics.com.ar/v2/latest');
    const data = await res.json();
    return Math.round(data.blue.value_avg);
  } catch(e) { return null; }
}

function getLastTC() {
  const cierres = DB.get('cierres', []);
  return Number(cierres.slice(-1)[0]?.tc) || null;
}

function populateCategoriasSelect(selectId, tipo) {
  const cat = getCategorias();
  const opts = tipo === 'ingreso' ? cat.ingresos : cat.egresos;
  const el = document.getElementById(selectId);
  if (el) el.innerHTML = opts.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
}

function popularCuentasSelect(selectId) {
  const el = document.getElementById(selectId);
  if (el) el.innerHTML = cuentasOptions();
}

function actualizarTCyWarning(monedaId, cuentaId, tcRowId, warningId, tcInputId) {
  const moneda = document.getElementById(monedaId)?.value;
  const cuentaVal = document.getElementById(cuentaId)?.value;
  const cuenta = getCuentas().find(c => c.id === cuentaVal);

  const tcRow = document.getElementById(tcRowId);
  const warning = document.getElementById(warningId);

  if (moneda === 'USD') {
    if (tcRow) tcRow.style.display = '';
    const tcInput = document.getElementById(tcInputId);
    if (tcInput && !tcInput.value) {
      const lastTC = getLastTC();
      if (lastTC) { tcInput.value = lastTC; }
      else fetchTC().then(tc => { if (tc && tcInput) tcInput.value = tc; });
    }
  } else {
    if (tcRow) tcRow.style.display = 'none';
  }

  if (warning) {
    warning.style.display = (cuenta && cuenta.moneda !== moneda) ? 'block' : 'none';
  }
}

// ===== MODAL MOVIMIENTO =====
export function openMovimientoModal() {
  popularCuentasSelect('mov-cuenta');

  const tipoEl    = document.getElementById('mov-tipo');
  const catEl     = document.getElementById('mov-cat');
  const fechaEl   = document.getElementById('mov-fecha');
  const tcRowEl   = document.getElementById('mov-tc-row');
  const warnEl    = document.getElementById('mov-moneda-warning');
  const monedaEl  = document.getElementById('mov-moneda');
  const cuentaEl  = document.getElementById('mov-cuenta');

  const tipo = tipoEl?.value || 'ingreso';
  if (catEl) populateCategoriasSelect('mov-cat', tipo);
  if (fechaEl) fechaEl.value = today();
  if (tcRowEl) tcRowEl.style.display = 'none';
  if (warnEl)  warnEl.style.display  = 'none';

  if (tipoEl) tipoEl.onchange = function() {
    populateCategoriasSelect('mov-cat', this.value);
  };
  if (monedaEl) monedaEl.onchange = function() {
    actualizarTCyWarning('mov-moneda', 'mov-cuenta', 'mov-tc-row', 'mov-moneda-warning', 'mov-tc');
  };
  if (cuentaEl) cuentaEl.onchange = function() {
    actualizarTCyWarning('mov-moneda', 'mov-cuenta', 'mov-tc-row', 'mov-moneda-warning', 'mov-tc');
  };

  openModal('modalMovimiento');
}

export function renderCaja() {
  const tod = today();
  document.getElementById('mov-fecha').value = tod;
  const movs = DB.get('movimientos', []).filter(m => m.fecha === tod);
  const ingARS = movs.filter(m => m.tipo === 'ingreso' && m.moneda === 'ARS').reduce((a, b) => a + Number(b.monto), 0);
  const ingUSD = movs.filter(m => m.tipo === 'ingreso' && m.moneda === 'USD').reduce((a, b) => a + Number(b.monto), 0);
  const egARS  = movs.filter(m => m.tipo === 'egreso'  && m.moneda === 'ARS').reduce((a, b) => a + Number(b.monto), 0);
  document.getElementById('caja-ingresos').textContent = fmtMoney(ingARS);
  document.getElementById('caja-ingresos-usd').textContent = 'USD ' + ingUSD.toLocaleString('es-AR');
  document.getElementById('caja-egresos').textContent = fmtMoney(egARS);
  document.getElementById('caja-balance').textContent = fmtMoney(ingARS - egARS);
  document.getElementById('caja-balance-usd').textContent = 'USD ' + ingUSD.toLocaleString('es-AR');

  const cuentas = getCuentas();
  const getCuentaNombre = id => cuentas.find(c => c.id === id)?.nombre || '';

  document.getElementById('tablaCaja').innerHTML = movs.length
    ? movs.map(m => `<tr${movRowStyle(m)}>
        <td style="font-family:'DM Mono';font-size:12px">${m.fecha}</td>
        <td>${escapeHtml(m.concepto)}${m.esTransferencia ? ' <span class="badge blue" style="font-size:10px">transferencia</span>' : ''}${movAnulacionTag(m)}</td>
        <td><span class="badge ${m.tipo === 'ingreso' ? 'green' : 'red'}">${m.tipo}</span></td>
        <td style="font-weight:500;color:${m.tipo === 'ingreso' ? '#34d399' : '#f87171'}">${m.tipo === 'ingreso' ? '+' : '-'}${fmtMoney(m.monto, m.moneda)}</td>
        <td style="font-size:11px;color:var(--text3)">${escapeHtml(getCuentaNombre(m.cuenta) || '—')}</td>
        <td>${movAnularBtn(m)}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--text3)">Sin movimientos hoy</td></tr>';

  const cierres = DB.get('cierres', []);
  document.getElementById('historialCierres').innerHTML = cierres.slice(-3).reverse().map(c => `
    <div style="padding:8px 0;border-top:1px solid var(--border);font-size:12px;color:var(--text2)">
      <strong style="color:var(--text)">${c.fecha}</strong> — ${fmtMoney(c.balanceARS)} / USD ${c.balanceUSD} <span style="color:var(--text3)">(TC: $${c.tc})</span>
    </div>`).join('');
}

export function saveMovimiento() {
  const monto = document.getElementById('mov-monto').value;
  const concepto = document.getElementById('mov-concepto').value;
  if (!monto || !concepto) { showNotif('Monto y concepto son obligatorios', 'error'); return; }
  const cuenta = document.getElementById('mov-cuenta')?.value || '';
  const vc = validarCuentaMovimiento(cuenta, getCuentas());
  if (!vc.ok) { showNotif(vc.error, 'error'); return; }
  const moneda = document.getElementById('mov-moneda').value;
  const tc = (moneda === 'USD') ? (Number(document.getElementById('mov-tc')?.value) || null) : null;
  const mov = {
    id:      'm' + Date.now(),
    tipo:    document.getElementById('mov-tipo').value,
    cat:     document.getElementById('mov-cat').value,
    moneda,
    monto:   Number(monto),
    metodo:  document.getElementById('mov-metodo').value,
    fecha:   document.getElementById('mov-fecha').value,
    concepto,
    cuenta,
  };
  if (tc) { mov.tcARS = tc; mov.equivalenteARS = Math.round(Number(monto) * tc); }
  const movs = DB.get('movimientos', []);
  movs.push(mov);
  DB.set('movimientos', movs);
  logAuditoria('crear', 'movimiento', mov.id, `${mov.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}: ${fmtMoney(mov.monto, mov.moneda)} — ${mov.concepto}`, null, mov);
  closeModal('modalMovimiento');
  renderCaja();
  showNotif('Movimiento registrado');
}

export async function cerrarCaja() {
  const tod = today();
  const movs = DB.get('movimientos', []).filter(m => m.fecha === tod);
  const ingARS = movs.filter(m => m.tipo === 'ingreso' && m.moneda === 'ARS').reduce((a, b) => a + Number(b.monto), 0);
  const egARS  = movs.filter(m => m.tipo === 'egreso'  && m.moneda === 'ARS').reduce((a, b) => a + Number(b.monto), 0);
  const ingUSD = movs.filter(m => m.tipo === 'ingreso' && m.moneda === 'USD').reduce((a, b) => a + Number(b.monto), 0);
  const cierres = DB.get('cierres', []);
  cierres.push({
    fecha: tod,
    balanceARS: ingARS - egARS,
    balanceUSD: ingUSD,
    tc:  document.getElementById('cajaTipoCambio').value,
    obs: document.getElementById('cajaObs').value
  });
  DB.set('cierres', cierres);
  await logAuditoria('crear', 'cierre', tod, `Cierre de caja ${tod}: balance ARS ${ingARS - egARS}, USD ${ingUSD}`, null, { fecha: tod, balanceARS: ingARS - egARS, balanceUSD: ingUSD });
  renderCaja();
  showNotif('✅ Caja cerrada correctamente');
}

// ===== ANULACIÓN (contra-asiento) =====
export function openAnularMovimiento(id) {
  const m = DB.get('movimientos', []).find(x => x.id === id);
  const check = puedeAnular(m);
  if (!check.ok) { showNotif(check.error, 'error'); return; }
  const g = m.grupoId ? getGrupo(m.grupoId) : null;
  const r = m.reservaId ? DB.get('reservas', []).find(x => x.id === m.reservaId) : null;
  let efecto = '';
  if (m.grupoId) efecto = `Pago del grupo ${escapeHtml(g?.nombre || m.grupoId)}: se devuelve ${fmtMoney(m.monto, m.moneda)} al saldo del grupo.`;
  else if (m.reservaId && !r) efecto = 'La reserva ya no existe: solo se anula el movimiento.';
  else if (m.reservaId && m.afectaSaldo === false) efecto = 'Cargo de horario especial: el saldo de la reserva no cambia.';
  else if (m.reservaId) efecto = `Pago de reserva: se devuelve ${fmtMoney(m.monto, m.moneda)} al saldo de la reserva.`;
  document.getElementById('anu-mov-id').value = id;
  document.getElementById('anu-motivo').value = '';
  document.getElementById('anu-resumen').innerHTML = `
    <div style="margin-bottom:6px"><strong>${escapeHtml(m.concepto)}</strong></div>
    <div style="color:var(--text2)">${escapeHtml(m.fecha)} · ${m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} · <strong style="color:${m.tipo === 'ingreso' ? '#34d399' : '#f87171'}">${fmtMoney(m.monto, m.moneda)}</strong></div>
    ${efecto ? `<div style="margin-top:6px;color:#fbbf24;font-size:12px">${efecto}</div>` : ''}`;
  openModal('modalAnularMovimiento');
}

let anulando = false;
export async function confirmarAnulacion() {
  if (anulando) return;
  const id = document.getElementById('anu-mov-id').value;
  const motivo = document.getElementById('anu-motivo').value;
  const movs = DB.get('movimientos', []);
  const idx = movs.findIndex(x => x.id === id);
  const mov = movs[idx];
  const res = construirAnulacion(mov, { motivo, id: 'm' + Date.now(), fecha: today() });
  if (!res.ok) { showNotif(res.error, 'error'); return; }

  // Pago de grupo: validar la reversión antes de escribir nada.
  let grupo = null, rev = null;
  if (mov.grupoId) {
    grupo = getGrupo(mov.grupoId);
    rev = revertirPagoGrupo(grupo, mov);
    if (!rev.ok) { showNotif(rev.error, 'error'); return; }
  }
  // Pago de reserva individual: idem. Si la reserva fue eliminada no hay
  // saldo que revertir y se anula solo el movimiento.
  const reservas = DB.get('reservas', []);
  const reserva = mov.reservaId ? reservas.find(x => x.id === mov.reservaId) : null;
  let revRes = null;
  if (reserva) {
    revRes = revertirPagoReserva(reserva, mov);
    if (!revRes.ok) { showNotif(revRes.error, 'error'); return; }
  }

  anulando = true;
  const btn = document.getElementById('btnConfirmarAnulacion');
  if (btn) btn.disabled = true;
  try {
    if (grupo) {
      const antesGrupo = { pagado: grupo.pagado, saldo: grupo.saldo };
      grupo.pagado = rev.pagado;
      grupo.saldo = rev.saldo;
      await guardarGrupo(grupo);
      logAuditoria('editar', 'grupo', grupo.id,
        `Pago grupal revertido por anulación: ${fmtMoney(mov.monto, mov.moneda)} — ${grupo.nombre}. Motivo: ${res.original.motivoAnulacion}`,
        antesGrupo, { pagado: grupo.pagado, saldo: grupo.saldo });
    }
    if (reserva && !revRes.sinCambios) {
      const antesRes = { pagado: reserva.pagado, saldo: reserva.saldo, estadoPago: reserva.estadoPago };
      reserva.pagado = revRes.pagado;
      reserva.saldo = revRes.saldo;
      reserva.estadoPago = revRes.estadoPago;
      await DB.set('reservas', reservas);
      logAuditoria('editar', 'reserva', reserva.id,
        `Pago revertido por anulación: ${fmtMoney(mov.monto, mov.moneda)}. Motivo: ${res.original.motivoAnulacion}`,
        antesRes, { pagado: reserva.pagado, saldo: reserva.saldo, estadoPago: reserva.estadoPago });
    }
    movs[idx] = res.original;
    movs.push(res.espejo);
    await DB.set('movimientos', movs);
    logAuditoria('editar', 'movimiento', mov.id,
      `Movimiento anulado: ${mov.tipo} ${fmtMoney(mov.monto, mov.moneda)} — ${mov.concepto}. Motivo: ${res.original.motivoAnulacion}. Contra-asiento ${res.espejo.id}`,
      mov, res.original);
    closeModal('modalAnularMovimiento');
    await refrescarMovimientos();
    showNotif('Movimiento anulado');
  } catch (e) {
    console.error('[caja] error anulando movimiento:', e);
    showNotif('No se pudo anular el movimiento. Revisá la conexión.', 'error');
  } finally {
    anulando = false;
    if (btn) btn.disabled = false;
  }
}

// Re-render de las vistas que listan movimientos, solo si están montadas.
async function refrescarMovimientos() {
  if (document.getElementById('tablaCaja')) renderCaja();
  if (document.getElementById('acctContent')) {
    const { rerenderAcct } = await import('./contabilidad.js');
    rerenderAcct();
  }
  if (document.getElementById('saldosContent')) renderSaldos();
  if (document.getElementById('tablaReservas')) {
    const { renderReservas } = await import('./reservas.js');
    renderReservas();
  }
}

// ===== TRANSFERENCIAS INTERNAS =====
export async function openTransferenciaModal() {
  const cuentas = getCuentas().filter(c => c.activa);
  const opts = cuentas.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)} (${c.moneda})</option>`).join('');

  const origenEl  = document.getElementById('transf-origen');
  const destinoEl = document.getElementById('transf-destino');
  const fechaEl   = document.getElementById('transf-fecha');
  const montoEl   = document.getElementById('transf-monto');
  const conceptoEl= document.getElementById('transf-concepto');
  const tcEl      = document.getElementById('transf-tc');
  const tcRowEl   = document.getElementById('transf-tc-row');
  const warnEl    = document.getElementById('transf-moneda-warning');

  if (origenEl)  origenEl.innerHTML  = opts;
  if (destinoEl) destinoEl.innerHTML = opts;
  if (fechaEl)   fechaEl.value   = today();
  if (montoEl)   montoEl.value   = '';
  if (conceptoEl)conceptoEl.value= '';
  if (tcEl)      tcEl.value      = '';
  if (tcRowEl)   tcRowEl.style.display  = 'none';
  if (warnEl)    warnEl.style.display   = 'none';

  const checkMonedas = () => {
    const origen  = cuentas.find(c => c.id === origenEl?.value);
    const destino = cuentas.find(c => c.id === destinoEl?.value);
    const distinto = origen && destino && origen.moneda !== destino.moneda;
    if (tcRowEl) tcRowEl.style.display  = distinto ? '' : 'none';
    if (warnEl)  warnEl.style.display   = distinto ? '' : 'none';
    if (distinto && tcEl && !tcEl.value) {
      const lastTC = getLastTC();
      if (lastTC) { tcEl.value = lastTC; }
      else fetchTC().then(tc => { if (tc && tcEl) tcEl.value = tc; });
    }
  };
  if (origenEl)  origenEl.onchange  = checkMonedas;
  if (destinoEl) destinoEl.onchange = checkMonedas;

  openModal('modalTransferencia');
}

export async function saveTransferencia() {
  const origenId  = document.getElementById('transf-origen').value;
  const destinoId = document.getElementById('transf-destino').value;
  const monto = Number(document.getElementById('transf-monto').value);
  const fecha = document.getElementById('transf-fecha').value;
  const concepto = document.getElementById('transf-concepto').value.trim() || 'Transferencia interna';

  if (!origenId || !destinoId || !monto || !fecha) { showNotif('Completá todos los campos obligatorios', 'error'); return; }
  if (origenId === destinoId) { showNotif('Las cuentas origen y destino no pueden ser la misma', 'error'); return; }

  const cuentas = getCuentas();
  const origen  = cuentas.find(c => c.id === origenId);
  const destino = cuentas.find(c => c.id === destinoId);
  const monedaDiferente = origen?.moneda !== destino?.moneda;
  const tc = monedaDiferente ? (Number(document.getElementById('transf-tc').value) || null) : null;
  if (monedaDiferente && !tc) { showNotif('Ingresá el tipo de cambio', 'error'); return; }

  const transferenciaId = 'tf' + Date.now();
  const montoDestino = monedaDiferente && tc
    ? (origen.moneda === 'ARS' ? parseFloat((monto / tc).toFixed(2)) : Math.round(monto * tc))
    : monto;

  const movs = DB.get('movimientos', []);
  movs.push({
    id: 'm' + Date.now(), tipo: 'egreso', cat: 'Transferencia interna',
    moneda: origen.moneda, monto, metodo: 'transferencia', fecha,
    concepto: `${concepto} → ${destino?.nombre}`,
    cuenta: origenId, transferenciaId, esTransferencia: true,
    ...(tc ? { tcARS: tc } : {})
  });
  movs.push({
    id: 'm' + (Date.now() + 1), tipo: 'ingreso', cat: 'Transferencia interna',
    moneda: destino.moneda, monto: montoDestino, metodo: 'transferencia', fecha,
    concepto: `${concepto} ← ${origen?.nombre}`,
    cuenta: destinoId, transferenciaId, esTransferencia: true,
    ...(tc ? { tcARS: tc } : {})
  });
  await DB.set('movimientos', movs);
  logAuditoria('crear', 'movimiento', transferenciaId, `Transferencia: ${fmtMoney(monto, origen?.moneda)} de ${origen?.nombre} → ${destino?.nombre}`);
  closeModal('modalTransferencia');
  renderCaja();
  showNotif(`🔄 Transferencia: ${fmtMoney(monto, origen?.moneda)} de ${origen?.nombre} → ${destino?.nombre}`);
}

// ===== SALDOS POR CUENTA =====
export function renderSaldos() {
  const cuentas = getCuentas().filter(c => c.activa);
  const movs    = DB.get('movimientos', []);
  const lastTC  = getLastTC() || 1430;
  const tod     = today();

  const rows = cuentas.map(c => {
    const movsCuenta = movs.filter(m =>
      m.cuenta === c.id &&
      (!c.fechaSaldoInicial || m.fecha >= c.fechaSaldoInicial) &&
      m.fecha <= tod
    );
    const ingresos = movsCuenta.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0);
    const egresos  = movsCuenta.filter(m => m.tipo === 'egreso') .reduce((s, m) => s + Number(m.monto), 0);
    const saldo = Number(c.saldoInicial || 0) + ingresos - egresos;
    return { ...c, ingresos, egresos, saldo };
  });

  const totalARS = rows.filter(r => r.moneda === 'ARS').reduce((s, r) => s + r.saldo, 0);
  const totalUSD = rows.filter(r => r.moneda === 'USD').reduce((s, r) => s + r.saldo, 0);
  const totalConsolidado = totalARS + Math.round(totalUSD * lastTC);
  const tipoIcon = { efectivo: '💵', banco: '🏦', digital: '📱', crypto: '₿' };

  const c = document.getElementById('saldosContent');
  if (!c) return;
  c.innerHTML = `
    <div class="stats-grid" style="margin-bottom:20px;">
      <div class="stat-card blue">
        <div class="label">Total ARS</div>
        <div class="value">${fmtMoney(totalARS)}</div>
        <div class="sub">cuentas en pesos</div>
      </div>
      <div class="stat-card green">
        <div class="label">Total USD</div>
        <div class="value">USD ${totalUSD.toLocaleString('es-AR')}</div>
        <div class="sub">cuentas en dólares</div>
      </div>
      <div class="stat-card amber">
        <div class="label">Consolidado ARS</div>
        <div class="value">${fmtMoney(totalConsolidado)}</div>
        <div class="sub">USD a TC $${lastTC.toLocaleString('es-AR')}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>Saldo por cuenta</h3>
        <span style="font-size:12px;color:var(--text3)">TC blue: $${lastTC.toLocaleString('es-AR')}</span>
      </div>
      <table>
        <thead><tr><th>Cuenta</th><th>Tipo</th><th>Moneda</th><th>Ingresos</th><th>Egresos</th><th>Saldo actual</th></tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td>
              <strong>${tipoIcon[r.tipo] || '💰'} ${escapeHtml(r.nombre)}</strong>
              ${r.responsable ? `<br><span style="font-size:11px;color:var(--text3)">${escapeHtml(r.responsable)}</span>` : ''}
            </td>
            <td style="text-transform:capitalize;font-size:12px;color:var(--text2)">${r.tipo}</td>
            <td><span class="badge ${r.moneda === 'USD' ? 'green' : 'blue'}">${r.moneda}</span></td>
            <td style="color:#34d399">+${r.moneda === 'USD' ? 'USD ' : '$'}${r.ingresos.toLocaleString('es-AR')}</td>
            <td style="color:#f87171">-${r.moneda === 'USD' ? 'USD ' : '$'}${r.egresos.toLocaleString('es-AR')}</td>
            <td style="font-weight:700;font-size:15px;color:${r.saldo < 0 ? '#f87171' : '#34d399'}">
              ${r.saldo < 0 ? '⚠️ ' : ''}${r.moneda === 'USD' ? 'USD ' : '$'}${r.saldo.toLocaleString('es-AR')}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}
