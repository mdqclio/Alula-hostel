// ===================== GRILLA DE RESERVAS =====================
import { DB } from './firebase-config.js';
import { today, dateToLocal } from './helpers.js';
import { getConfig, habBeds } from './config.js';

let grillaFechaInicio = null;
const GRILLA_DIAS = 14;

function getHuespedNombre(id) {
  const h = DB.get('huespedes', []).find(x => x.id === id);
  return h ? h.nombre + ' ' + h.apellido : id;
}

export function grillaHoy() {
  grillaFechaInicio = today();
  renderGrilla();
}

export function grillaNavegar(dias) {
  if (!grillaFechaInicio) grillaFechaInicio = today();
  const d = new Date(grillaFechaInicio + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  grillaFechaInicio = dateToLocal(d);
  renderGrilla();
}

export function renderGrilla() {
  if (!grillaFechaInicio) grillaFechaInicio = today();
  const reservas = DB.get('reservas', []);
  const tod = today();

  // Generar array de fechas a mostrar
  const fechas = [];
  for (let i = 0; i < GRILLA_DIAS; i++) {
    const d = new Date(grillaFechaInicio + 'T12:00:00');
    d.setDate(d.getDate() + i);
    fechas.push(dateToLocal(d));
  }

  // Label de rango
  const fmt = f => { const p = f.split('-'); return `${p[2]}/${p[1]}`; };
  document.getElementById('grillaRangoLabel').textContent =
    `${fmt(fechas[0])} — ${fmt(fechas[fechas.length - 1])}`;

  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  // Construir tabla
  let html = '<table class="grilla-table">';

  // Header fechas
  html += '<thead><tr><th style="position:sticky;left:0;z-index:3;background:var(--surface2)">Cama</th>';
  fechas.forEach(f => {
    const d = new Date(f + 'T12:00:00');
    const isToday = f === tod;
    const dow = diasSemana[d.getDay()];
    const isWE = d.getDay() === 0 || d.getDay() === 6;
    html += `<th class="${isToday ? 'today-col' : ''}" style="${isWE ? 'color:#f59e0b' : ''}">
      ${dow}<br><strong>${d.getDate()}/${d.getMonth() + 1}</strong>
    </th>`;
  });
  html += '</tr></thead><tbody>';

  // Filas por habitación y cama
  for (const hab of getConfig().hostel.habitaciones) {
    const beds = habBeds(hab.id);
    if (beds.length === 0) continue;

    const inactiveTag = !hab.activa
      ? ` <span style="color:#f59e0b;font-size:11px;font-weight:500;">(inactiva${hab.nota ? ': ' + hab.nota : ''})</span>`
      : '';

    // Fila separador de habitación
    html += `<tr class="grilla-hab-header"><td colspan="${fechas.length + 1}">${hab.nombre} (${beds.length} camas)${inactiveTag}</td></tr>`;

    beds.forEach(b => {
      html += `<tr><td class="cama-label">Cama ${b.label}</td>`;

      fechas.forEach((f) => {
        const res = reservas.find(r =>
          r.cama === b.id &&
          (r.estado === 'checkin' || r.estado === 'confirmada' || r.estado === 'checkout') &&
          r.entrada.substring(0, 10) <= f && r.salida.substring(0, 10) > f
        );

        const isToday = f === tod;
        let cellClass = 'gc-free';
        let innerHtml = '';

        if (res) {
          const esEntrada = res.entrada.substring(0, 10) === f;
          cellClass = res.estado === 'checkin' ? 'gc-occupied' : res.estado === 'confirmada' ? 'gc-confirmed' : 'gc-checkout';
          if (esEntrada) {
            const nombre = getHuespedNombre(res.huespedId).split(' ')[0];
            innerHtml = `<div class="grilla-span ${res.estado}" onclick="cycleBed('${b.id}')" title="${getHuespedNombre(res.huespedId)}">${nombre}</div>`;
          }
        }

        html += `<td class="grilla-cell ${cellClass}${isToday ? ' gc-today' : ''}">${innerHtml}</td>`;
      });

      html += '</tr>';
    });
  }

  html += '</tbody></table>';
  document.getElementById('grillaContainer').innerHTML = html;
}
