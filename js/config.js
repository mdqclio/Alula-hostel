// ===================== CONFIG =====================
import { DB } from './firebase-config.js';

export const CONFIG_DEFAULTS = {
  hostel: {
    nombre: 'Alula Hostel',
    habitaciones: [
      { id: '1', nombre: 'Habitación 1', camas: 8, activa: true,  nota: '' },
      { id: '2', nombre: 'Habitación 2', camas: 6, activa: true,  nota: '' },
      { id: '3', nombre: 'Habitación 3', camas: 6, activa: true,  nota: '' },
      { id: '4', nombre: 'Habitación 4', camas: 6, activa: true,  nota: '' },
      { id: '5', nombre: 'Habitación 5', camas: 0, activa: false, nota: 'En obras' },
      { id: '6', nombre: 'Habitación 6', camas: 0, activa: false, nota: 'En obras' },
    ]
  },
  horarios: { checkin: '14:00', checkout: '10:00', lateCheckout: '12:00', earlyCheckin: '11:00' },
  temporadas: {
    alta:  { nombre: 'Temporada Alta',  precio: 35000, moneda: 'ARS', periodos: [] },
    media: { nombre: 'Temporada Media', precio: 27000, moneda: 'ARS', periodos: [] },
    baja:  { nombre: 'Temporada Baja',  precio: 22000, moneda: 'ARS', periodos: [] },
  }
};

export function getConfig() {
  const stored = DB.get('config', {});
  const sh = stored.hostel || {};
  const st = stored.temporadas || {};
  // Migrar formato viejo (habitaciones como número) al nuevo (array)
  let habitaciones;
  if (Array.isArray(sh.habitaciones)) {
    habitaciones = sh.habitaciones;
  } else if (typeof sh.habitaciones === 'number') {
    const c1 = sh.camasHab1 || 8, cr = sh.camasHabResto || 6;
    habitaciones = Array.from({ length: sh.habitaciones }, (_, i) => ({
      id: String(i + 1), nombre: `Habitación ${i + 1}`,
      camas: i === 0 ? c1 : cr, activa: true, nota: ''
    }));
  } else {
    habitaciones = CONFIG_DEFAULTS.hostel.habitaciones;
  }
  return {
    hostel:   { nombre: sh.nombre || CONFIG_DEFAULTS.hostel.nombre, habitaciones },
    horarios: { ...CONFIG_DEFAULTS.horarios, ...(stored.horarios || {}) },
    temporadas: {
      alta:  { ...CONFIG_DEFAULTS.temporadas.alta,  ...(st.alta  || {}), periodos: (st.alta  || {}).periodos || [] },
      media: { ...CONFIG_DEFAULTS.temporadas.media, ...(st.media || {}), periodos: (st.media || {}).periodos || [] },
      baja:  { ...CONFIG_DEFAULTS.temporadas.baja,  ...(st.baja  || {}), periodos: (st.baja  || {}).periodos || [] },
    }
  };
}

// Determina qué temporada aplica a una fecha (YYYY-MM-DD). Prioridad: alta > media > baja.
export function getTemporadaParaFecha(fechaStr) {
  const cfg = getConfig();
  const d = new Date(fechaStr + 'T12:00:00');
  const mmdd = String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function matches(periodo) {
    if (periodo.tipo === 'especifico') {
      return fechaStr >= periodo.desde && fechaStr <= periodo.hasta;
    }
    if (periodo.tipo === 'anual') {
      const { desde, hasta } = periodo;
      return desde <= hasta ? (mmdd >= desde && mmdd <= hasta) : (mmdd >= desde || mmdd <= hasta);
    }
    return false;
  }
  for (const tipo of ['alta', 'media', 'baja']) {
    if ((cfg.temporadas[tipo].periodos || []).some(matches)) return tipo;
  }
  return 'media';
}

export function getTotalCamas() {
  return getConfig().hostel.habitaciones.filter(h => h.activa && h.camas > 0).reduce((s, h) => s + h.camas, 0);
}

export function bedCount(hab) {
  const h = getConfig().hostel.habitaciones.find(x => x.id === hab);
  return h ? h.camas : 0;
}

export function habFirstBed(hab) {
  let first = 1;
  for (const h of getConfig().hostel.habitaciones) {
    if (h.id === hab) break;
    first += h.camas;
  }
  return first;
}

export function habBeds(hab) {
  const n = bedCount(hab);
  const first = habFirstBed(hab);
  return Array.from({ length: n }, (_, i) => ({ id: `${hab}-${i + 1}`, label: `${first + i}` }));
}

export function camaLabel(camaId) {
  // camaId = "hab-idx", ej "2-3" → cama 11 (Hab2 empieza en 9, índice 3 → 9+2=11)
  const parts = camaId.split('-');
  const hab = parts[0], idx = Number(parts[1]);
  return String(habFirstBed(hab) + idx - 1);
}

export function allBeds() {
  let beds = [];
  for (const h of getConfig().hostel.habitaciones) {
    if (h.activa && h.camas > 0) beds = beds.concat(habBeds(h.id));
  }
  return beds;
}
