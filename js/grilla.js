// ===================== GRILLA DE RESERVAS =====================
import { DB } from './firebase-config.js';
import { today, dateToLocal, fmtMoney } from './helpers.js';
import { getConfig, habBeds, getMonedas } from './config.js';
import { cotizar } from './services/cotizador.service.js';

let grillaFechaInicio = null;
let cotizacionState = null;   // { entrada, salida, cantidadCamas } cuando hay cotización
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

// ===================== MODO COTIZACIÓN: control =====================
export function setCotizacionRango({ entrada, salida, cantidadCamas } = {}) {
  cotizacionState = {
    entrada: entrada || '',
    salida: salida || '',
    cantidadCamas: Math.max(1, Number(cantidadCamas) || 1),
  };
  renderGrilla();
}

export function clearCotizacionRango() {
  cotizacionState = null;
  ['cotiz-desde', 'cotiz-hasta'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const cc = document.getElementById('cotiz-camas'); if (cc) cc.value = '1';
  renderGrilla();
}

function setIndicador(html, kind) {
  const el = document.getElementById('grillaCotizIndicador');
  if (!el) return;
  el.innerHTML = html || '';
  el.style.display = html ? '' : 'none';
  el.classList.toggle('error', kind === 'error');
}

// ===================== DISPATCHER =====================
export function renderGrilla() {
  const c = cotizacionState;
  if (c && c.entrada && c.salida && c.salida > c.entrada) {
    renderCotizacion(c);
    return;
  }
  // Modo operativo. Si hay un rango invertido cargado, avisar en el indicador.
  if (c && c.entrada && c.salida && c.salida <= c.entrada) {
    setIndicador('⚠️ El check-out debe ser posterior al check-in', 'error');
  } else {
    setIndicador('', null);
  }
  renderOperativa();
}

// ===================== MODO COTIZACIÓN: render =====================
function atributosResumen(attrs) {
  if (!attrs) return '';
  const parts = [];
  if (attrs.tipo === 'abajo')          parts.push('🛏 Baja');
  if (attrs.vista === 'mar')           parts.push('🌊 Mar');
  else if (attrs.vista === 'parcial')  parts.push('🪟 Vista parcial');
  if (attrs.balcon)                    parts.push('🏖 Balcón');
  if (attrs.banoSuite)                 parts.push('🚿 Baño suite');
  if (attrs.habitacionPremium)         parts.push('⭐ Premium');
  if (attrs.ruido === 'bajo')          parts.push('🔇 Silenciosa');
  if (attrs.cercaniaBano === 'cerca')  parts.push('🚪 Baño cerca');
  return parts.join(' · ');
}

function renderCotizacion(c) {
  const container = document.getElementById('grillaContainer');
  if (!container) return;
  const config = getConfig();
  const result = cotizar({
    entrada: c.entrada,
    salida: c.salida,
    cantidadCamas: c.cantidadCamas || 1,
    reservas: DB.get('reservas', []),
    camasConfig: DB.get('camasConfig', {}),
    habitaciones: config.hostel.habitaciones,
    temporadas: config.temporadas,
    monedas: getMonedas(),
  });

  const rangoLabel = document.getElementById('grillaRangoLabel');
  if (rangoLabel) rangoLabel.textContent = '';

  if (!result.ok) {
    setIndicador('📅 Cotización · ' + (result.mensaje || result.error), 'error');
    container.innerHTML = `<p style="text-align:center;color:var(--text3);padding:32px;font-size:14px;">${result.mensaje || 'No se pudo cotizar.'}</p>`;
    return;
  }

  const temp = result.temporada
    ? result.temporada.charAt(0).toUpperCase() + result.temporada.slice(1)
    : '—';
  setIndicador(`📅 Cotización · ${result.noches} noche${result.noches !== 1 ? 's' : ''} · Ocupación ${result.ocupacion}% · Temporada ${temp}`, null);

  let html = '';
  (result.warnings || []).forEach(w => {
    html += `<div class="grilla-coti-warning">⚠️ ${w}</div>`;
  });

  html += `<table class="cotiz-table"><thead><tr>
    <th>Cama</th>
    <th>Atributos</th>
    <th style="text-align:center;">Score</th>
    <th style="text-align:right;">Precio total · ${result.noches} noche${result.noches !== 1 ? 's' : ''}</th>
  </tr></thead><tbody>`;

  result.camas.forEach(cama => {
    const resumen = atributosResumen(cama.atributos) || 'Estándar';
    const onclick = `openNuevaReserva({prefill:{entrada:'${result.entrada}',salida:'${result.salida}',cama:'${cama.camaId}',precio:${cama.precioTotal},moneda:'${result.moneda}'}})`;
    html += `<tr class="grilla-coti-row grilla-coti-row-${cama.tier}" onclick="${onclick}" title="Crear reserva con esta cama">
      <td style="font-weight:600;">${cama.label}</td>
      <td style="font-size:12px;">${resumen}</td>
      <td style="text-align:center;">${cama.score}</td>
      <td style="text-align:right;font-weight:600;">${fmtMoney(cama.precioTotal, result.moneda)}<br>
        <span style="font-size:11px;opacity:0.7;font-weight:400;">${fmtMoney(cama.precioPorNoche, result.moneda)}/noche</span></td>
    </tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ===================== MODO OPERATIVO: render (lógica original, sin cambios) =====================
function renderOperativa() {
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
