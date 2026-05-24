// ===================== SERVICIO DE COTIZACIÓN (puro) =====================
// Fase 1 del rediseño del cotizador. Lógica pura: sin DOM, sin Firebase,
// sin window, sin console. Todo entra por parámetros y sale por return.
// Reutiliza camas.service.js para scoring / pricing / ocupación (no duplica).

import {
  isCamaDisponible,
  calcularOcupacionGlobal,
  calcularScoreCama,
  calcularPrecioCama,
} from './camas.service.js';
import { nightsBetween } from '../helpers.js';

// ---------- helpers internos (sin estado, sin efectos) ----------

function isValidISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T12:00:00');
  if (isNaN(d.getTime())) return false;
  // Round-trip: descarta fechas como 2026-02-30 que el parser "corre" a marzo.
  const [y, m, day] = s.split('-').map(Number);
  return d.getFullYear() === y && (d.getMonth() + 1) === m && d.getDate() === day;
}

// Deriva las camas activas desde el array `habitaciones` (sin tocar config/Firebase).
// Replica la numeración global de config.js (habFirstBed/habBeds/camaLabel)
// usando sólo el input: el label "Cama N" cuenta todas las camas previas en orden.
function derivarCamas(habitaciones) {
  const habs = Array.isArray(habitaciones) ? habitaciones : [];
  const beds = [];
  let globalIdx = 0; // equivalente a habFirstBed acumulado
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

// Resuelve la temporada de una fecha a partir del objeto `temporadas` del config
// (réplica pura de getTemporadaParaFecha). Devuelve 'alta'|'media'|'baja' o null
// si no hay temporadas configuradas.
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
  // Ningún período matchea → default 'media' (como getTemporadaParaFecha), o la primera presente.
  return temporadas.media ? 'media' : presentes[0];
}

// Tier por posición en la lista ordenada asc por precio.
function tierFor(idx, n) {
  if (n <= 2) return 'economico';
  if (n <= 5) {
    if (idx === 0) return 'economico';
    if (idx === n - 1) return 'premium';
    return 'medio';
  }
  const t = idx / n; // tertiles 33/33/33
  if (t < 1 / 3) return 'economico';
  if (t < 2 / 3) return 'medio';
  return 'premium';
}

// ---------- API pública ----------

export function cotizar({
  entrada,
  salida,
  // Mínimo de camas que deben estar disponibles en el rango. Si hay menos,
  // se devuelve error 'sin_camas'. Default 1 (preserva el caso de 0 disponibles).
  cantidadCamas = 1,
  reservas = [],
  camasConfig = {},
  habitaciones = [],
  temporadas = {},
  monedas = [],
} = {}) {
  // 1) Validación de fechas
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

  // 2) Temporada → precioBase + moneda (con warning si no hay precio)
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

  // 3) Camas disponibles con score y precio (las ocupadas no se incluyen)
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

  // 4) Orden por precioTotal asc (tie-break determinista por camaId) + tiers
  disponibles.sort((a, b) => a.precioTotal - b.precioTotal || a.camaId.localeCompare(b.camaId));
  const n = disponibles.length;
  disponibles.forEach((c, idx) => { c.tier = tierFor(idx, n); });

  // 5) Sugerencia (mayor score; empate → más barata) y alternativas (top 5 sin la sugerencia)
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
