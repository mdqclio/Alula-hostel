// === MOTOR DE CAMAS INTELIGENTE ===

// Configuración base (esto después lo podés editar desde UI)
const CONFIG_CAMAS = {
  basePrice: 100, // precio base USD (referencia)
  factores: {
    vistaMar: 1.2,
    balcon: 1.15,
    banoPrivado: 1.25,
    camaAbajo: 1.1,
    camaArriba: 0.9
  }
};

// Calcula score de una cama
export function calcularScoreCama(cama, ocupacion) {
  let score = 100;

  if (cama.vistaMar) score += 20;
  if (cama.balcon) score += 15;
  if (cama.banoPrivado) score += 25;
  if (cama.tipo === "abajo") score += 10;
  if (cama.tipo === "arriba") score -= 5;

  // Penalización por alta ocupación
  score -= ocupacion * 0.3;

  return score;
}

// Precio dinámico
export function calcularPrecioCama(cama, ocupacion) {
  let precio = CONFIG_CAMAS.basePrice;

  if (cama.vistaMar) precio *= CONFIG_CAMAS.factores.vistaMar;
  if (cama.balcon) precio *= CONFIG_CAMAS.factores.balcon;
  if (cama.banoPrivado) precio *= CONFIG_CAMAS.factores.banoPrivado;
  if (cama.tipo === "abajo") precio *= CONFIG_CAMAS.factores.camaAbajo;
  if (cama.tipo === "arriba") precio *= CONFIG_CAMAS.factores.camaArriba;

  // Ajuste por ocupación
  if (ocupacion > 80) precio *= 1.2;
  else if (ocupacion > 60) precio *= 1.1;
  else if (ocupacion < 30) precio *= 0.9;

  return Math.round(precio);
}

// Elegir mejor cama automáticamente
export function sugerirMejorCama(camasDisponibles, ocupacion) {
  let mejor = null;
  let mejorScore = -Infinity;

  for (const cama of camasDisponibles) {
    const score = calcularScoreCama(cama, ocupacion);

    if (score > mejorScore) {
      mejorScore = score;
      mejor = cama;
    }
  }

  return mejor;
}
