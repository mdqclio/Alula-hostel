// ===================== CAJA DIARIA =====================
import { DB } from './firebase-config.js';
import { today, fmtMoney, showNotif, openModal, closeModal } from './helpers.js';
import { getCuentas, getCategorias } from './config.js';

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
  if (el) el.innerHTML = opts.map(c => `<option value="${c}">${c}</option>`).join('');
}

function popularCuentasSelect(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  el.innerHTML = '<option value="">Sin asignar</option>' +
    getCuentas().filter(c => c.activa).map(c =>
      `<option value="${c.id}">${c.nombre} (${c.moneda})</option>`
    ).join('');
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
  const tipo = document.getElementById('mov-tipo')?.value || 'ingreso';
  populateCategoriasSelect('mov-cat', tipo);
  document.getElementById('mov-fecha').value = today();
  document.getElementById('mov-tc-row').style.display = 'none';
  document.getElementById('mov-moneda-warning').style.display = 'none';

  document.getElementById('mov-tipo').onchange = function() {
    populateCategoriasSelect('mov-cat', this.value);
  };
  document.getElementById('mov-moneda').onchange = function() {
    actualizarTCyWarning('mov-moneda', 'mov-cuenta', 'mov-tc-row', 'mov-moneda-warning', 'mov-tc');
  };
  document.getElementById('mov-cuenta').onchange = function() {
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
    ? movs.map(m => `<tr>
        <td style="font-family:'DM Mono';font-size:12px">${m.fecha}</td>
        <td>${m.concepto}${m.esTransferencia ? ' <span class="badge blue" style="font-size:10px">transferencia</span>' : ''}</td>
        <td><span class="badge ${m.tipo === 'ingreso' ? 'green' : 'red'}">${m.tipo}</span></td>
        <td style="font-weight:500;color:${m.tipo === 'ingreso' ? '#34d399' : '#f87171'}">${m.tipo === 'ingreso' ? '+' : '-'}${fmtMoney(m.monto, m.moneda)}</td>
        <td style="font-size:11px;color:var(--text3)">${getCuentaNombre(m.cuenta) || '—'}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--text3)">Sin movimientos hoy</td></tr>';

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
    cuenta:  document.getElementById('mov-cuenta')?.value || null,
  };
  if (tc) { mov.tcARS = tc; mov.equivalenteARS = Math.round(Number(monto) * tc); }
  const movs = DB.get('movimientos', []);
  movs.push(mov);
  DB.set('movimientos', movs);
  closeModal('modalMovimiento');
  renderCaja();
  showNotif('Movimiento registrado');
}

export function cerrarCaja() {
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
  renderCaja();
  showNotif('✅ Caja cerrada correctamente');
}

// ===== TRANSFERENCIAS INTERNAS =====
export async function openTransferenciaModal() {
  const cuentas = getCuentas().filter(c => c.activa);
  const opts = cuentas.map(c => `<option value="${c.id}">${c.nombre} (${c.moneda})</option>`).join('');
  document.getElementById('transf-origen').innerHTML = opts;
  document.getElementById('transf-destino').innerHTML = opts;
  document.getElementById('transf-fecha').value = today();
  document.getElementById('transf-monto').value = '';
  document.getElementById('transf-concepto').value = '';
  document.getElementById('transf-tc').value = '';
  document.getElementById('transf-tc-row').style.display = 'none';
  document.getElementById('transf-moneda-warning').style.display = 'none';

  const checkMonedas = () => {
    const origen  = cuentas.find(c => c.id === document.getElementById('transf-origen').value);
    const destino = cuentas.find(c => c.id === document.getElementById('transf-destino').value);
    const distinto = origen && destino && origen.moneda !== destino.moneda;
    document.getElementById('transf-tc-row').style.display = distinto ? '' : 'none';
    document.getElementById('transf-moneda-warning').style.display = distinto ? '' : 'none';
    if (distinto && !document.getElementById('transf-tc').value) {
      const lastTC = getLastTC();
      if (lastTC) { document.getElementById('transf-tc').value = lastTC; }
      else fetchTC().then(tc => { if (tc) document.getElementById('transf-tc').value = tc; });
    }
  };
  document.getElementById('transf-origen').onchange = checkMonedas;
  document.getElementById('transf-destino').onchange = checkMonedas;

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
              <strong>${tipoIcon[r.tipo] || '💰'} ${r.nombre}</strong>
              ${r.responsable ? `<br><span style="font-size:11px;color:var(--text3)">${r.responsable}</span>` : ''}
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
