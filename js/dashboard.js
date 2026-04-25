// ===================== DASHBOARD =====================
import { DB } from './firebase-config.js';
import { today, fmtMoney, platBadge, pagoBadge } from './helpers.js';
import { getTotalCamas, camaLabel } from './config.js';

function getHuespedNombre(id) {
  const h = DB.get('huespedes', []).find(x => x.id === id);
  return h ? h.nombre + ' ' + h.apellido : id;
}

export function renderDashboard() {
  const reservas = DB.get('reservas', []);
  const tod = today();
  const occupied = reservas.filter(r => r.estado === 'checkin').length;
  const _total = getTotalCamas();
  document.getElementById('stat-occ').textContent = `${occupied}/${_total}`;
  document.getElementById('stat-occ-pct').textContent = Math.round(occupied / _total * 100) + '% ocupación';

  const todayMovs = DB.get('movimientos', []).filter(m => m.fecha === tod && m.tipo === 'ingreso');
  const ingARS = todayMovs.filter(m => m.moneda === 'ARS').reduce((a, b) => a + Number(b.monto), 0);
  const ingUSD = todayMovs.filter(m => m.moneda === 'USD').reduce((a, b) => a + Number(b.monto), 0);
  document.getElementById('stat-today-income').textContent = fmtMoney(ingARS);
  document.getElementById('stat-today-income-usd').textContent = 'USD ' + ingUSD.toLocaleString('es-AR');

  const checkinHoy = reservas.filter(r => r.entrada === tod && r.estado === 'confirmada').length;
  const checkoutHoy = reservas.filter(r => r.salida === tod && r.estado === 'checkin').length;
  document.getElementById('stat-checkin-today').textContent = checkinHoy;
  document.getElementById('stat-checkout-today').textContent = checkoutHoy;

  const proxCheckins = reservas.filter(r => r.estado === 'confirmada').sort((a, b) => a.entrada > b.entrada ? 1 : -1).slice(0, 5);
  const proxCheckouts = reservas.filter(r => r.estado === 'checkin').sort((a, b) => a.salida > b.salida ? 1 : -1).slice(0, 5);

  document.getElementById('dash-checkins').innerHTML = proxCheckins.length
    ? proxCheckins.map(r => `<tr>
        <td>${getHuespedNombre(r.huespedId)}</td>
        <td>Hab.${r.hab} <span style="font-family:'DM Mono';font-size:11px;color:var(--accent2)">C${camaLabel(r.cama)}</span></td>
        <td>${r.entrada}</td>
        <td>${platBadge(r.plataforma)}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;color:var(--text3)">Sin check-ins pendientes</td></tr>';

  document.getElementById('dash-checkouts').innerHTML = proxCheckouts.length
    ? proxCheckouts.map(r => `<tr>
        <td>${getHuespedNombre(r.huespedId)}</td>
        <td>Hab.${r.hab} <span style="font-family:'DM Mono';font-size:11px;color:var(--accent2)">C${camaLabel(r.cama)}</span></td>
        <td>${r.salida}</td>
        <td>${pagoBadge(r)}</td>
      </tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;color:var(--text3)">Sin check-outs pendientes</td></tr>';
}

export function onEntradaChange() {
  const entrada = document.getElementById('res-entrada').value;
  const salidaEl = document.getElementById('res-salida');
  if (entrada) {
    const _nd = new Date(entrada + 'T12:00:00');
    _nd.setDate(_nd.getDate() + 1);
    const { dateToLocal } = require('./helpers.js');
    salidaEl.min = dateToLocal(_nd);
    if (salidaEl.value && salidaEl.value <= entrada) salidaEl.value = salidaEl.min;
    // Auto-sugerir precio según temporada detectada
    import('./config.js').then(({ getTemporadaParaFecha, getConfig }) => {
      const tipoTemp = getTemporadaParaFecha(entrada);
      const t = getConfig().temporadas[tipoTemp];
      const precioEl = document.getElementById('res-precio');
      if (!precioEl.value) {
        precioEl.value = t.precio;
        document.getElementById('res-moneda').value = t.moneda;
      }
      // Mostrar badge de temporada junto al label de precio
      let badge = document.getElementById('res-temporada-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.id = 'res-temporada-badge';
        badge.style.marginLeft = '8px';
        const lbl = precioEl.closest('.form-group')?.querySelector('label');
        if (lbl) lbl.appendChild(badge);
      }
      const badgeColor = tipoTemp === 'alta' ? 'red' : tipoTemp === 'baja' ? 'green' : 'amber';
      badge.innerHTML = `<span class="badge ${badgeColor}" style="font-size:10px;">${t.nombre}</span>`;
    });
  }
  import('./reservas.js').then(({ updateBedsSelect, calcTotalReserva }) => {
    updateBedsSelect();
    calcTotalReserva();
  });
}
