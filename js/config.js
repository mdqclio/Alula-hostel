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
  },
  categorias: {
    ingresos: ['Reservas', 'Late checkout', 'Otros'],
    egresos:  ['Sueldos', 'Servicios', 'Limpieza', 'Mantenimiento', 'Otros'],
  },
  cuentas: [
    { id: 'c1', nombre: 'Caja efectivo',   tipo: 'efectivo', moneda: 'ARS', responsable: '', saldoInicial: 0, fechaSaldoInicial: '', activa: true },
    { id: 'c2', nombre: 'Banco principal', tipo: 'banco',    moneda: 'ARS', responsable: '', saldoInicial: 0, fechaSaldoInicial: '', activa: true },
    { id: 'c3', nombre: 'Wise',            tipo: 'digital',  moneda: 'USD', responsable: '', saldoInicial: 0, fechaSaldoInicial: '', activa: true },
    { id: 'c4', nombre: 'Mercado Pago',    tipo: 'digital',  moneda: 'ARS', responsable: '', saldoInicial: 0, fechaSaldoInicial: '', activa: true },
  ],
  metodosPago: [
    { id: 'efectivo',      nombre: 'Efectivo' },
    { id: 'transferencia', nombre: 'Transferencia' },
    { id: 'mercadopago',   nombre: 'Mercado Pago' },
    { id: 'tarjeta',       nombre: 'Tarjeta' },
  ],
  plataformas: [
    { id: 'directo', nombre: 'Directo' },
    { id: 'booking', nombre: 'Booking.com' },
    { id: 'airbnb',  nombre: 'Airbnb' },
    { id: 'otro',    nombre: 'Otro' },
  ],
  monedas: [
    { code: 'ARS', symbol: '$',   nombre: 'Peso argentino' },
    { code: 'USD', symbol: 'USD', nombre: 'Dólar' },
  ],
  chatQuickReplies: [
    { label: '💰 Precios',      msg: '¿Cuáles son los precios?' },
    { label: '🏠 Habitaciones', msg: '¿Qué tipo de habitaciones tienen?' },
    { label: '📍 Ubicación',    msg: '¿Dónde están ubicados?' },
    { label: '⏰ Horarios',     msg: '¿Cuáles son los horarios de check-in y check-out?' },
    { label: '🏊 Servicios',    msg: '¿Qué servicios ofrecen?' },
    { label: '📅 Reservar',     msg: 'Quiero hacer una reserva' },
  ],
};

export function getConfig() {
  const stored = DB.get('config', {});
  const sh = stored.hostel || {};
  const st = stored.temporadas || {};
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

export function getCategorias() {
  const stored = DB.get('config', {}).categorias || {};
  return {
    ingresos: stored.ingresos || [...CONFIG_DEFAULTS.categorias.ingresos],
    egresos:  stored.egresos  || [...CONFIG_DEFAULTS.categorias.egresos],
  };
}

export function getCuentas() {
  return DB.get('config', {}).cuentas || CONFIG_DEFAULTS.cuentas;
}

export function getMetodosPago() {
  return DB.get('config', {}).metodosPago || CONFIG_DEFAULTS.metodosPago;
}

export function getPlataformas() {
  return DB.get('config', {}).plataformas || CONFIG_DEFAULTS.plataformas;
}

export function getMonedas() {
  return DB.get('config', {}).monedas || CONFIG_DEFAULTS.monedas;
}

export function getChatQuickReplies() {
  return DB.get('config', {}).chatQuickReplies || CONFIG_DEFAULTS.chatQuickReplies;
}

/** <option> tags para select de métodos de pago */
export function metodosOptions(currentVal = 'efectivo') {
  return getMetodosPago().map(m =>
    `<option value="${m.id}" ${m.id === currentVal ? 'selected' : ''}>${m.nombre}</option>`
  ).join('');
}

/** <option> tags para select de cuentas activas (filtra por moneda opcional) */
export function cuentasOptions(currentVal = '', moneda = null) {
  return '<option value="">Sin asignar</option>' + getCuentas()
    .filter(c => c.activa && (!moneda || c.moneda === moneda))
    .map(c => `<option value="${c.id}" ${c.id === currentVal ? 'selected' : ''}>${c.nombre} (${c.moneda})</option>`)
    .join('');
}

// ===== Funciones existentes (sin cambios) =====

export function getTemporadaParaFecha(fechaStr) {
  const cfg = getConfig();
  const d = new Date(fechaStr + 'T12:00:00');
  const mmdd = String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function matches(periodo) {
    if (periodo.tipo === 'especifico') return fechaStr >= periodo.desde && fechaStr <= periodo.hasta;
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
