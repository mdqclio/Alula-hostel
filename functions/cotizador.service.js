// COPY of js/services/cotizador.service.js — keep in sync.
// Self-contained for Cloud Functions: nightsBetween inlined,
// camas.service.js imported from the local copy in this folder.
// ===================== SERVICIO DE COTIZACIÓN (puro) =====================
// Lógica pura: sin DOM, sin Firebase, sin window, sin console.
// Todo entra por parámetros y sale por return.

import {
  isCamaDisponible,
  calcularOcupacionGlobal,
  calcularScoreCama,
  calcularPrecioCama,
} from './camas.service.js';

// Inlined from js/helpers.js — keep in sync if it changes.
function nightsBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
}

// ---------- helpers internos (sin estado, sin efectos) ----------

function isValidISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T12:00:00');
  if (isNaN(d.getTime())) return false;
  const [y, m, day] = s.split('-').map(Number);
  return d.getFullYear() === y && (d.getMonth() + 1) === m && d.getDate() === day;
}

function derivarCamas(habitaciones) {
  const habs = Array.isArray(habitaciones) ? habitaciones : [];
  const beds = [];
  let globalIdx = 0;
  for (const h of habs) {
    const camas = Number(h && h.camas) || 0;
    const activa = !!(h && h.activa);
    for (let i = 0; i < camas; i++) {
      globalIdx += 1;
      if (activa) {
        beds.push({
          camaId: `${h.id}-${i + 1}`,
          habitacionId: String(h.id),
          label: `Hab ${h.id} — Cama ${globalIdx}`,
        });
      }
    }
  }
  return beds;
}

function resolverTemporada(fechaStr, temporadas) {
  if (!temporadas || typeof temporadas !== 'object') return null;
  const presentes = ['alta', 'media', 'baja'].filter(t => temporadas[t]);
  if (presentes.length === 0) return null;
  const d = new Date(fechaStr + 'T12:00:00');
  const mmdd = String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const matches = (p) => {
    if (!p) return false;
    if (p.tipo === 'especifico') return fechaStr >= p.desde && fechaStr <= p.hasta;
    if (p.tipo === 'anual') {
      const { desde, hasta } = p;
      return desde <= hasta ? (mmdd >= desde && mmdd <= hasta) : (mmdd >= desde || mmdd <= hasta);
    }
    return false;
  };
  for (const t of ['alta', 'media', 'baja']) {
    if (temporadas[t] && (temporadas[t].periodos || []).some(matches)) return t;
  }
  return temporadas.media ? 'media' : presentes[0];
}

function tierFor(idx, n) {
  if (n <= 2) return 'economico';
  if (n <= 5) {
    if (idx === 0) return 'economico';
    if (idx === n - 1) return 'premium';
    return 'medio';
  }
  const t = idx / n;
  if (t < 1 / 3) return 'economico';
  if (t < 2 / 3) return 'medio';
  return 'premium';
}

// ---------- API pública ----------

export function cotizar({
  entrada,
  salida,
  cantidadCamas = 1,
  reservas = [],
  camasConfig = {},
  habitaciones = [],
  temporadas = {},
  monedas = [],
} = {}) {
  if (!isValidISODate(entrada) || !isValidISODate(salida)) {
    return { ok: false, error: 'fechas_invalidas', mensaje: 'Las fechas deben tener formato YYYY-MM-DD válido.' };
  }
  if (salida <= entrada) {
    return { ok: false, error: 'fechas_invertidas', mensaje: 'La fecha de salida debe ser posterior a la de entrada.' };
  }
  const hoy = new Date().toISOString().slice(0, 10);
  if (entrada < hoy) {
    return { ok: false, error: 'fechas_pasadas', mensaje: 'La fecha de entrada no puede ser en el pasado.' };
  }

  const noches = nightsBetween(entrada, salida);
  const reservasArr = Array.isArray(reservas) ? reservas : [];
  const beds = derivarCamas(habitaciones);
  const totalCamas = beds.length;
  const ocupacion = calcularOcupacionGlobal(entrada, salida, reservasArr, totalCamas);

  const warnings = [];
  const defaultMoneda = (Array.isArray(monedas) && monedas[0] && monedas[0].code) || 'ARS';
  const temporada = resolverTemporada(entrada, temporadas);
  let precioBase = 0;
  let moneda = defaultMoneda;
  if (temporada && temporadas[temporada] && Number(temporadas[temporada].precio) > 0) {
    precioBase = Number(temporadas[temporada].precio);
    moneda = temporadas[temporada].moneda || defaultMoneda;
  } else {
    precioBase = 0;
    warnings.push('Sin precios de temporada configurados');
  }

  const disponibles = [];
  for (const b of beds) {
    if (!isCamaDisponible(b.camaId, entrada, salida, reservasArr)) continue;
    const atributos = camasConfig[b.camaId] || {};
    const score = calcularScoreCama(atributos);
    const precioPorNoche = calcularPrecioCama(atributos, ocupacion, precioBase);
    disponibles.push({
      camaId: b.camaId,
      habitacionId: b.habitacionId,
      label: b.label,
      disponible: true,
      score,
      atributos,
      precioPorNoche,
      precioTotal: precioPorNoche * noches,
    });
  }

  if (disponibles.length < cantidadCamas) {
    return {
      ok: false,
      error: 'sin_camas',
      mensaje: `Pediste ${cantidadCamas} camas, solo hay ${disponibles.length} disponibles`,
    };
  }

  disponibles.sort((a, b) => a.precioTotal - b.precioTotal || a.camaId.localeCompare(b.camaId));
  const n = disponibles.length;
  disponibles.forEach((c, idx) => { c.tier = tierFor(idx, n); });

  const sugerencia = [...disponibles].sort((a, b) => b.score - a.score || a.precioTotal - b.precioTotal)[0];
  const alternativas = disponibles.filter(c => c.camaId !== sugerencia.camaId).slice(0, 5);

  return {
    ok: true,
    noches,
    entrada,
    salida,
    ocupacion,
    temporada,
    precioBase,
    moneda,
    camas: disponibles,
    sugerencia,
    alternativas,
    warnings,
  };
}
