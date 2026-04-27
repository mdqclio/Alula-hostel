// ===================== CONTABILIDAD =====================
import { DB } from './firebase-config.js';
import { fmtMoney, openModal, showNotif, today } from './helpers.js';
import { getCuentas, getCategorias } from './config.js';

function getCuentaNombre(id) {
  if (!id) return 'Sin cuenta';
  const c = getCuentas().find(x => x.id === id);
  return c ? c.nombre : id;
}

export function renderAcct(tab) {
  if (tab === 'reportes') { renderReportes(); return; }

  const movs = DB.get('movimientos', []);
  const c = document.getElementById('acctContent');

  if (tab === 'resumen') {
    const mes  = new Date().getMonth();
    const year = new Date().getFullYear();
    const mm = movs.filter(m => {
      const d = new Date(m.fecha);
      return d.getMonth() === mes && d.getFullYear() === year && !m.esTransferencia;
    });
    const ingARS = mm.filter(m => m.tipo === 'ingreso' && m.moneda === 'ARS').reduce((a, b) => a + Number(b.monto), 0);
    const ingUSD = mm.filter(m => m.tipo === 'ingreso' && m.moneda === 'USD').reduce((a, b) => a + Number(b.monto), 0);
    const egARS  = mm.filter(m => m.tipo === 'egreso'  && m.moneda === 'ARS').reduce((a, b) => a + Number(b.monto), 0);
    const bal = ingARS - egARS;
    c.innerHTML = `
      <div class="acct-grid">
        <div class="stat-card green"><div class="label">Ingresos ARS (mes)</div><div class="value">${fmtMoney(ingARS)}</div></div>
        <div class="stat-card green"><div class="label">Ingresos USD (mes)</div><div class="value">USD ${ingUSD.toLocaleString('es-AR')}</div></div>
        <div class="stat-card red"><div class="label">Egresos ARS (mes)</div><div class="value">${fmtMoney(egARS)}</div></div>
        <div class="stat-card blue"><div class="label">Balance neto ARS</div><div class="value">${fmtMoney(bal)}</div></div>
        <div class="stat-card amber"><div class="label">Transacciones</div><div class="value">${mm.length}</div></div>
      </div>`;
    return;
  }

  const tipoMap = { ingresos: 'ingreso', egresos: 'egreso', sueldos: 'egreso', servicios: 'egreso' };
  const catMap  = { sueldos: 'Sueldos', servicios: 'Servicios' };
  let filtered = movs.filter(m => m.tipo === (tipoMap[tab] || m.tipo) && !m.esTransferencia);
  if (catMap[tab]) filtered = filtered.filter(m => m.cat === catMap[tab] || m.cat === catMap[tab].toLowerCase());

  c.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-blue btn-sm" onclick="openMovimientoModal()">+ Agregar</button>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Cuenta</th><th>Monto</th><th>Método</th></tr></thead>
        <tbody>${filtered.length
          ? filtered.sort((a, b) => b.fecha > a.fecha ? 1 : -1).map(m => `<tr>
              <td style="font-family:'DM Mono';font-size:12px">${m.fecha}</td>
              <td>${m.concepto}</td>
              <td><span class="badge ${m.tipo === 'ingreso' ? 'green' : 'red'}">${m.cat || '—'}</span></td>
              <td style="font-size:12px;color:var(--text3)">${getCuentaNombre(m.cuenta)}</td>
              <td style="font-weight:500;color:${m.tipo === 'ingreso' ? '#34d399' : '#f87171'}">${m.tipo === 'ingreso' ? '+' : '-'}${fmtMoney(m.monto, m.moneda)}</td>
              <td style="font-size:12px;color:var(--text3)">${m.metodo || '—'}</td>
            </tr>`).join('')
          : '<tr><td colspan="6" style="text-align:center;color:var(--text3)">Sin movimientos</td></tr>'
        }</tbody>
      </table>
    </div>`;
}

export function switchAcctTab(tab, el) {
  document.querySelectorAll('#section-contabilidad .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderAcct(tab);
}

// ===== REPORTES =====
function renderReportes() {
  const tod = today();
  const primerDiaMes = tod.substring(0, 7) + '-01';
  const inp = 'background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);padding:7px 10px;width:100%;font-size:13px;';
  const c = document.getElementById('acctContent');
  c.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div style="padding:16px 20px;">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px;">
          <div class="form-group" style="margin:0;min-width:140px;">
            <label>Desde</label>
            <input type="date" id="rep-desde" value="${primerDiaMes}" style="${inp}">
          </div>
          <div class="form-group" style="margin:0;min-width:140px;">
            <label>Hasta</label>
            <input type="date" id="rep-hasta" value="${tod}" style="${inp}">
          </div>
          <div class="form-group" style="margin:0;min-width:180px;">
            <label>Cuenta</label>
            <select id="rep-cuenta" style="${inp}">
              <option value="">Todas</option>
              ${getCuentas().map(c => `<option value="${c.id}">${c.nombre} (${c.moneda})</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0;min-width:110px;">
            <label>Moneda</label>
            <select id="rep-moneda" style="${inp}">
              <option value="">Todas</option>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div class="form-group" style="margin:0;min-width:120px;">
            <label>Tipo</label>
            <select id="rep-tipo" style="${inp}">
              <option value="">Todos</option>
              <option value="ingreso">Ingresos</option>
              <option value="egreso">Egresos</option>
            </select>
          </div>
          <button class="btn btn-blue btn-sm" onclick="aplicarFiltroReportes()" style="align-self:flex-end">Filtrar</button>
          <button class="btn btn-ghost btn-sm" onclick="exportarReporteCSV()" style="align-self:flex-end">📥 Exportar CSV</button>
        </div>
        <div id="rep-resumen"></div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Detalle del período</h3><span id="rep-count" style="font-size:12px;color:var(--text3)"></span></div>
      <table>
        <thead><tr><th>Fecha</th><th>Cuenta</th><th>Categoría</th><th>Concepto</th><th>Tipo</th><th>Monto</th><th>TC</th><th>Método</th></tr></thead>
        <tbody id="rep-tabla"></tbody>
      </table>
    </div>`;
  aplicarFiltroReportes();
}

export function aplicarFiltroReportes() {
  const desde  = document.getElementById('rep-desde')?.value;
  const hasta  = document.getElementById('rep-hasta')?.value;
  const cuenta = document.getElementById('rep-cuenta')?.value;
  const moneda = document.getElementById('rep-moneda')?.value;
  const tipo   = document.getElementById('rep-tipo')?.value;
  if (!desde || !hasta) return;

  let movs = DB.get('movimientos', []).filter(m =>
    m.fecha >= desde && m.fecha <= hasta && !m.esTransferencia
  );
  if (cuenta) movs = movs.filter(m => m.cuenta === cuenta);
  if (moneda) movs = movs.filter(m => m.moneda === moneda);
  if (tipo)   movs = movs.filter(m => m.tipo === tipo);
  movs.sort((a, b) => b.fecha > a.fecha ? 1 : -1);

  const ingARS = movs.filter(m => m.tipo === 'ingreso' && m.moneda === 'ARS').reduce((s, m) => s + Number(m.monto), 0);
  const ingUSD = movs.filter(m => m.tipo === 'ingreso' && m.moneda === 'USD').reduce((s, m) => s + Number(m.monto), 0);
  const egARS  = movs.filter(m => m.tipo === 'egreso'  && m.moneda === 'ARS').reduce((s, m) => s + Number(m.monto), 0);
  const egUSD  = movs.filter(m => m.tipo === 'egreso'  && m.moneda === 'USD').reduce((s, m) => s + Number(m.monto), 0);
  const balARS = ingARS - egARS;
  const balUSD = ingUSD - egUSD;

  const box = (label, val, color) =>
    `<div style="background:${color}1a;border:1px solid ${color}33;border-radius:var(--radius);padding:12px;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:${color};font-weight:600;margin-bottom:4px;">${label}</div>
      <div style="font-size:17px;font-weight:700;color:${color}">${val}</div>
    </div>`;

  const resEl = document.getElementById('rep-resumen');
  if (resEl) resEl.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;">
      ${box('Ingresos ARS', fmtMoney(ingARS), '#34d399')}
      ${box('Ingresos USD', 'USD '+ingUSD.toLocaleString('es-AR'), '#34d399')}
      ${box('Egresos ARS', fmtMoney(egARS), '#f87171')}
      ${box('Egresos USD', 'USD '+egUSD.toLocaleString('es-AR'), '#f87171')}
      ${box('Balance ARS', fmtMoney(balARS), balARS >= 0 ? '#34d399' : '#f87171')}
      ${box('Balance USD', 'USD '+balUSD.toLocaleString('es-AR'), balUSD >= 0 ? '#34d399' : '#f87171')}
    </div>`;

  const countEl = document.getElementById('rep-count');
  if (countEl) countEl.textContent = `${movs.length} movimiento(s)`;

  const tablaEl = document.getElementById('rep-tabla');
  if (tablaEl) tablaEl.innerHTML = movs.length
    ? movs.map(m => `<tr>
        <td style="font-family:'DM Mono';font-size:12px">${m.fecha}</td>
        <td style="font-size:12px">${getCuentaNombre(m.cuenta)}</td>
        <td><span class="badge ${m.tipo === 'ingreso' ? 'green' : 'red'}">${m.cat || '—'}</span></td>
        <td style="font-size:13px">${m.concepto}</td>
        <td style="font-size:12px;text-align:center">${m.tipo === 'ingreso' ? '↑' : '↓'}</td>
        <td style="font-weight:500;color:${m.tipo === 'ingreso' ? '#34d399' : '#f87171'}">${m.tipo === 'ingreso' ? '+' : '-'}${fmtMoney(m.monto, m.moneda)}</td>
        <td style="font-size:11px;color:var(--text3)">${m.tcARS ? '$'+Number(m.tcARS).toLocaleString('es-AR') : '—'}</td>
        <td style="font-size:12px;color:var(--text3)">${m.metodo || '—'}</td>
      </tr>`).join('')
    : '<tr><td colspan="8" style="text-align:center;color:var(--text3)">Sin movimientos en el período</td></tr>';
}

export function exportarReporteCSV() {
  const desde  = document.getElementById('rep-desde')?.value || '';
  const hasta  = document.getElementById('rep-hasta')?.value || '';
  const cuenta = document.getElementById('rep-cuenta')?.value || '';
  const moneda = document.getElementById('rep-moneda')?.value || '';
  const tipo   = document.getElementById('rep-tipo')?.value || '';

  let movs = DB.get('movimientos', []).filter(m =>
    m.fecha >= desde && m.fecha <= hasta && !m.esTransferencia
  );
  if (cuenta) movs = movs.filter(m => m.cuenta === cuenta);
  if (moneda) movs = movs.filter(m => m.moneda === moneda);
  if (tipo)   movs = movs.filter(m => m.tipo === tipo);
  movs.sort((a, b) => b.fecha > a.fecha ? 1 : -1);

  const headers = ['Fecha','Cuenta','Categoría','Concepto','Tipo','Monto','Moneda','Método','TC','Equivalente ARS'];
  const rows = movs.map(m => [
    m.fecha,
    getCuentaNombre(m.cuenta),
    m.cat || '',
    m.concepto,
    m.tipo,
    m.monto,
    m.moneda,
    m.metodo || '',
    m.tcARS || '',
    m.equivalenteARS || (m.moneda === 'ARS' ? m.monto : ''),
  ]);

  const csv = '\ufeff' + [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte_${desde}_${hasta}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showNotif('📥 CSV exportado');
}
