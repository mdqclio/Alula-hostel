export function isCamaDisponible(camaId, entrada, salida, reservas) {
  return !reservas.some(r => {
    if (r.camaId !== camaId) return false;

    const e1 = new Date(entrada);
    const s1 = new Date(salida);
    const e2 = new Date(r.entrada);
    const s2 = new Date(r.salida);

    return e1 < s2 && s1 > e2;
  });
}

export function sugerirCama(entrada, salida, camas, reservas) {
  const disponibles = camas.filter(c =>
    isCamaDisponible(c.id, entrada, salida, reservas)
  );

  if (!disponibles.length) return null;

  return disponibles.sort((a, b) =>
    scoreCama(b) - scoreCama(a)
  )[0];
}

function scoreCama(cama) {
  let score = 0;

  if (cama.vistaMar) score += 30;
  if (cama.balcon) score += 20;
  if (cama.banoSuite) score += 25;
  if (cama.tipo === "abajo") score += 10;

  return score;
}
