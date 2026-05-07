// ===================== MOTOR DE CAMAS =====================
// Scoring, pricing dinámico y sugerencia automática de camas.
// Toda la lógica conectada a datos reales — sin mocks ni hardcodes.

// Pesos configurables del scoring. Máximo teórico: 115 pts.
const SCORE_WEIGHTS = {
  tipo:              { abajo: 10, arriba: 0 },
  vista:             { mar: 30, parcial: 15, ninguna: 0 },
  balcon:            20,
  banoSuite:         25,
  habitacionPremium: 15,
  ruido:             { bajo: 10, medio: 0, alto: -10 },
  cercaniaBano:      { cerca: 5, normal: 0, lejos: -5 },
};

const SCORE_MAX = 115;

// Calcula el score de una cama a partir de sus atributos.
// cama: objeto con los atributos (tipo, vista, balcon, etc.)
export function calcularScoreCama(cama) {
  let score = Number(cama.scoreBase) || 0;
  score += SCORE_WEIGHTS.tipo[cama.tipo]             ?? 0;
  score += SCORE_WEIGHTS.vista[cama.vista]           ?? 0;
  if (cama.balcon)            score += SCORE_WEIGHTS.balcon;
  if (cama.banoSuite)         score += SCORE_WEIGHTS.banoSuite;
  if (cama.habitacionPremium) score += SCORE_WEIGHTS.habitacionPremium;
  score += SCORE_WEIGHTS.ruido[cama.ruido]           ?? 0;
  score += SCORE_WEIGHTS.cercaniaBano[cama.cercaniaBano] ?? 0;
  return score;
}

// Verifica si una cama está libre en el período dado.
export function isCamaDisponible(camaId, entrada, salida, reservas) {
  return !reservas.some(r => {
    if (r.cama !== camaId) return false;
    if (r.estado === 'checkout' || r.estado === 'cancelada') return false;
    const e1 = new Date(entrada), s1 = new Date(salida);
    const e2 = new Date(r.entrada), s2 = new Date(r.salida);
    return e1 < s2 && s1 > e2;
  });
}

// Ocupación global del hostel para un período (0–100).
// reservas: array de reservas reales de Firebase.
// totalCamas: total de camas activas en el hostel.
export function calcularOcupacionGlobal(entrada, salida, reservas, totalCamas) {
  if (!totalCamas) return 0;
  const activas = reservas.filter(r =>
    (r.estado === 'checkin' || r.estado === 'confirmada') &&
    r.entrada < salida && r.salida > entrada
  );
  return Math.round((activas.length / totalCamas) * 100);
}

// Ocupación de una habitación específica para un período (0–100).
export function calcularOcupacionHabitacion(habId, entrada, salida, reservas, camasEnHab) {
  if (!camasEnHab) return 0;
  const activas = reservas.filter(r =>
    r.hab === habId &&
    (r.estado === 'checkin' || r.estado === 'confirmada') &&
    r.entrada < salida && r.salida > entrada
  );
  return Math.round((activas.length / camasEnHab) * 100);
}

// Precio dinámico de una cama.
// factorCalidad: +0% (score=0) hasta +50% (score máximo).
// factorOcupacion: descuento/recargo por nivel de ocupación.
export function calcularPrecioCama(cama, ocupacion, precioBase) {
  const score = calcularScoreCama(cama);
  const factorCalidad = 1 + (Math.max(score, 0) / SCORE_MAX) * 0.5;

  let factorOcupacion;
  if      (ocupacion >= 85) factorOcupacion = 1.30;
  else if (ocupacion >= 70) factorOcupacion = 1.15;
  else if (ocupacion >= 50) factorOcupacion = 1.05;
  else if (ocupacion <  30) factorOcupacion = 0.90;
  else                      factorOcupacion = 1.00;

  return Math.round(precioBase * factorCalidad * factorOcupacion);
}

// Sugiere la mejor cama disponible para las fechas dadas.
// Cada elemento de `camas` debe incluir sus atributos (tipo, vista, etc.)
// para que el scoring funcione correctamente.
export function sugerirCama(entrada, salida, camas, reservas) {
  const disponibles = camas.filter(c =>
    isCamaDisponible(c.id, entrada, salida, reservas)
  );
  if (!disponibles.length) return null;
  return disponibles.sort((a, b) =>
    calcularScoreCama(b) - calcularScoreCama(a)
  )[0];
}
