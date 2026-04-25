// ===================== CHECKIN SECTION =====================
import { DB } from './firebase-config.js';
import { today, fmtMoney } from './helpers.js';
import { camaLabel } from './config.js';
import { doCheckin, doCheckout, openExtender, openPago, openHorario } from './reservas.js';

function getHuespedNombre(id) {
  const h = DB.get('huespedes', []).find(x => x.id === id);
  return h ? h.nombre + ' ' + h.apellido : id;
}

export function renderCheckin() {
  const reservas = DB.get('reservas', []);
  const tod = today();
  const pendCheckin = reservas.filter(r => r.estado === 'confirmada' && r.entrada <= tod);
  const pendCheckout = reservas.filter(r => r.estado === 'checkin' && r.salida <= tod);
  const enHostel = reservas.filter(r => r.estado === 'checkin');

  document.getElementById('tablaCheckin').innerHTML = pendCheckin.length
    ? pendCheckin.map(r => `<tr>
        <td>${getHuespedNombre(r.huespedId)}</td>
        <td>Hab.${r.hab}</td><td>${r.entrada}</td>
        <td style="display:flex;gap:4px;flex-wrap:wrap;">
          <button class="btn btn-green btn-sm" onclick="doCheckin('${r.id}');renderCheckin()">Check-in</button>
          <button class="btn btn-blue btn-sm" onclick="openHorario('${r.id}','early')">🌅 Early</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;color:var(--text3)">Sin pendientes</td></tr>';

  document.getElementById('tablaCheckout').innerHTML = pendCheckout.length
    ? pendCheckout.map(r => `<tr>
        <td>${getHuespedNombre(r.huespedId)}</td>
        <td>Hab.${r.hab}</td><td>${r.salida}</td>
        <td style="display:flex;gap:4px;flex-wrap:wrap;">
          <button class="btn btn-amber btn-sm" onclick="doCheckout('${r.id}');renderCheckin()">Check-out</button>
          <button class="btn btn-blue btn-sm" onclick="openHorario('${r.id}','late')">🌙 Late</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="4" style="text-align:center;color:var(--text3)">Sin pendientes</td></tr>';

  document.getElementById('tablaEnHostel').innerHTML = enHostel.length
    ? enHostel.map(r => {
        const h = DB.get('huespedes', []).find(x => x.id === r.huespedId);
        const saldo = Number(r.saldo || 0);
        return `<tr>
          <td>${getHuespedNombre(r.huespedId)}</td>
          <td>${h?.nac || '—'}</td>
          <td>Hab.${r.hab} / C${camaLabel(r.cama)}</td>
          <td><span style="font-family:'DM Mono';font-size:13px;font-weight:600;color:var(--accent2)">${r.llave || '—'}</span></td>
          <td>${r.entrada}${r.horaCheckin ? ` <span style="color:var(--text3);font-size:11px">${r.horaCheckin}hs</span>` : ''}</td>
          <td>${r.salida}</td>
          <td>${saldo > 0 ? `<span class="badge amber">Debe ${fmtMoney(saldo, r.moneda)}</span>` : `<span class="badge green">Al día</span>`}</td>
          <td style="display:flex;gap:4px;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" onclick="openHorario('${r.id}','late')">🌙 Late</button>
            <button class="btn btn-blue btn-sm" onclick="openExtender('${r.id}')">+ Días</button>
            ${saldo > 0 ? `<button class="btn btn-green btn-sm" onclick="openPago('${r.id}')">💰 Cobrar</button>` : ''}
          </td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="8" style="text-align:center;color:var(--text3)">Sin huéspedes activos</td></tr>';
}
