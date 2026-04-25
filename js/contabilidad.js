// ===================== CONTABILIDAD =====================
import { DB } from './firebase-config.js';
import { fmtMoney, openModal, showNotif } from './helpers.js';

export function renderAcct(tab) {
  const movs = DB.get('movimientos', []);
  const c = document.getElementById('acctContent');
  if (tab === 'resumen') {
    const mes = new Date().getMonth();
    const year = new Date().getFullYear();
    const movsmes = movs.filter(m => { const d = new Date(m.fecha); return d.getMonth() === mes && d.getFullYear() === year; });
    const ingARS = movsmes.filter(m => m.tipo === 'ingreso' && m.moneda === 'ARS').reduce((a, b) => a + Number(b.monto), 0);
    const ingUSD = movsmes.filter(m => m.tipo === 'ingreso' && m.moneda === 'USD').reduce((a, b) => a + Number(b.monto), 0);
    const egARS = movsmes.filter(m => m.tipo === 'egreso' && m.moneda === 'ARS').reduce((a, b) => a + Number(b.monto), 0);
    const bal = ingARS - egARS;
    c.innerHTML = `
      <div class="acct-grid">
        <div class="stat-card green"><div class="label">Ingresos ARS (mes)</div><div class="value">${fmtMoney(ingARS)}</div></div>
        <div class="stat-card green"><div class="label">Ingresos USD (mes)</div><div class="value">USD ${ingUSD.toLocaleString('es-AR')}</div></div>
        <div class="stat-card red"><div class="label">Egresos ARS (mes)</div><div class="value">${fmtMoney(egARS)}</div></div>
        <div class="stat-card blue"><div class="label">Balance neto ARS</div><div class="value">${fmtMoney(bal)}</div></div>
        <div class="stat-card amber"><div class="label">Transacciones</div><div class="value">${movsmes.length}</div></div>
      </div>`;
    return;
  }
  const tipoMap = { ingresos: 'ingreso', egresos: 'egreso', sueldos: 'egreso', servicios: 'egreso' };
  const catMap = { sueldos: 'sueldo', servicios: 'servicio' };
  let filtered = movs.filter(m => m.tipo === (tipoMap[tab] || m.tipo));
  if (catMap[tab]) filtered = filtered.filter(m => m.cat === catMap[tab]);
  c.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-blue btn-sm" onclick="openModal('modalMovimiento')">+ Agregar</button>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Monto</th><th>Método</th></tr></thead>
        <tbody>${filtered.length
          ? filtered.sort((a, b) => b.fecha > a.fecha ? 1 : -1).map(m => `<tr>
              <td style="font-family:'DM Mono';font-size:12px">${m.fecha}</td>
              <td>${m.concepto}</td>
              <td><span class="badge ${m.tipo === 'ingreso' ? 'green' : 'red'}">${m.cat}</span></td>
              <td style="font-weight:500;color:${m.tipo === 'ingreso' ? '#34d399' : '#f87171'}">${m.tipo === 'ingreso' ? '+' : '-'}${fmtMoney(m.monto, m.moneda)}</td>
              <td>${m.metodo}</td>
            </tr>`).join('')
          : '<tr><td colspan="5" style="text-align:center;color:var(--text3)">Sin movimientos</td></tr>'
        }</tbody>
      </table>
    </div>`;
}

export function switchAcctTab(tab, el) {
  document.querySelectorAll('#section-contabilidad .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderAcct(tab);
}
