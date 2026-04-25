// ===================== CAJA DIARIA =====================
import { DB } from './firebase-config.js';
import { today, fmtMoney, showNotif, closeModal } from './helpers.js';

export function renderCaja() {
  const tod = today();
  document.getElementById('mov-fecha').value = tod;
  const movs = DB.get('movimientos', []).filter(m => m.fecha === tod);
  const ingARS = movs.filter(m => m.tipo === 'ingreso' && m.moneda === 'ARS').reduce((a, b) => a + Number(b.monto), 0);
  const ingUSD = movs.filter(m => m.tipo === 'ingreso' && m.moneda === 'USD').reduce((a, b) => a + Number(b.monto), 0);
  const egARS = movs.filter(m => m.tipo === 'egreso' && m.moneda === 'ARS').reduce((a, b) => a + Number(b.monto), 0);
  document.getElementById('caja-ingresos').textContent = fmtMoney(ingARS);
  document.getElementById('caja-ingresos-usd').textContent = 'USD ' + ingUSD.toLocaleString('es-AR');
  document.getElementById('caja-egresos').textContent = fmtMoney(egARS);
  document.getElementById('caja-balance').textContent = fmtMoney(ingARS - egARS);
  document.getElementById('caja-balance-usd').textContent = 'USD ' + ingUSD.toLocaleString('es-AR');
  document.getElementById('tablaCaja').innerHTML = movs.length
    ? movs.map(m => `<tr>
        <td style="font-family:'DM Mono';font-size:12px">${m.fecha}</td>
        <td>${m.concepto}</td>
        <td><span class="badge ${m.tipo === 'ingreso' ? 'green' : 'red'}">${m.tipo}</span></td>
        <td style="font-weight:500;color:${m.tipo === 'ingreso' ? '#34d399' : '#f87171'}">${m.tipo === 'ingreso' ? '+' : '-'}${fmtMoney(m.monto, m.moneda)}</td>
        <td>${m.metodo}</td>
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
  const movs = DB.get('movimientos', []);
  movs.push({
    id: 'm' + Date.now(),
    tipo: document.getElementById('mov-tipo').value,
    cat: document.getElementById('mov-cat').value,
    moneda: document.getElementById('mov-moneda').value,
    monto: Number(monto),
    metodo: document.getElementById('mov-metodo').value,
    fecha: document.getElementById('mov-fecha').value,
    concepto
  });
  DB.set('movimientos', movs);
  closeModal('modalMovimiento');
  renderCaja();
  showNotif('Movimiento registrado');
}

export function cerrarCaja() {
  const tod = today();
  const movs = DB.get('movimientos', []).filter(m => m.fecha === tod);
  const ingARS = movs.filter(m => m.tipo === 'ingreso' && m.moneda === 'ARS').reduce((a, b) => a + Number(b.monto), 0);
  const egARS = movs.filter(m => m.tipo === 'egreso' && m.moneda === 'ARS').reduce((a, b) => a + Number(b.monto), 0);
  const ingUSD = movs.filter(m => m.tipo === 'ingreso' && m.moneda === 'USD').reduce((a, b) => a + Number(b.monto), 0);
  const cierres = DB.get('cierres', []);
  cierres.push({
    fecha: tod,
    balanceARS: ingARS - egARS,
    balanceUSD: ingUSD,
    tc: document.getElementById('cajaTipoCambio').value,
    obs: document.getElementById('cajaObs').value
  });
  DB.set('cierres', cierres);
  renderCaja();
  showNotif('✅ Caja cerrada correctamente');
}
