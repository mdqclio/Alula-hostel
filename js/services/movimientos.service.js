// ===================== MOVIMIENTOS — lógica pura =====================
// Anulación por contra-asiento: el movimiento original NO se borra; se marca
// anulado y se crea un espejo de tipo contrario por el mismo monto, moneda y
// cuenta. El par original + espejo suma cero en cualquier cálculo que sume
// ingresos y reste egresos. Sin DOM ni Firebase: la UI persiste lo que
// devuelven estas funciones.

const TIPO_OPUESTO = { ingreso: 'egreso', egreso: 'ingreso' };

// ¿Se puede anular este movimiento? Devuelve { ok, error? }.
export function puedeAnular(mov) {
  if (!mov) return { ok: false, error: 'No se encontró el movimiento' };
  if (mov.anulado) return { ok: false, error: 'El movimiento ya está anulado' };
  if (mov.anulaId) return { ok: false, error: 'Un movimiento de anulación no se puede anular' };
  // Una transferencia son dos movimientos enlazados: anular una sola pata
  // dejaría la otra cuenta descuadrada.
  if (mov.esTransferencia) return { ok: false, error: 'Las transferencias internas no se anulan desde acá' };
  if (!TIPO_OPUESTO[mov.tipo]) return { ok: false, error: 'Tipo de movimiento desconocido' };
  const monto = Number(mov.monto);
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, error: 'El movimiento no tiene un monto válido' };
  return { ok: true };
}

// Arma la anulación. `motivo` es obligatorio; `id` y `fecha` los pone la UI
// (id del espejo y fecha de la anulación). Devuelve
// { ok, error?, original, espejo } — original es una copia marcada anulada.
export function construirAnulacion(mov, { motivo, id, fecha } = {}) {
  const check = puedeAnular(mov);
  if (!check.ok) return check;
  const m = String(motivo || '').trim();
  if (!m) return { ok: false, error: 'Indicá el motivo de la anulación' };

  const original = { ...mov, anulado: true, motivoAnulacion: m, fechaAnulacion: fecha, anuladoPorId: id };
  const espejo = {
    id,
    tipo: TIPO_OPUESTO[mov.tipo],
    cat: mov.cat || '',
    moneda: mov.moneda,
    monto: Number(mov.monto),
    metodo: mov.metodo || '',
    fecha,
    concepto: `Anulación de ${mov.concepto || ''}`.trim(),
    cuenta: mov.cuenta || null,
    anulaId: mov.id,
    motivoAnulacion: m,
  };
  if (mov.grupoId) espejo.grupoId = mov.grupoId;
  if (mov.tcARS) espejo.tcARS = mov.tcARS;
  if (mov.equivalenteARS) espejo.equivalenteARS = mov.equivalenteARS;
  return { ok: true, original, espejo };
}

// Revierte un pago de grupo (inverso de aplicarPagoGrupo): resta de pagado y
// suma al saldo. Solo aplica a ingresos: un egreso con grupoId no es un pago.
// Devuelve { ok, error?, pagado, saldo }.
export function revertirPagoGrupo(grupo, mov) {
  const pagado = Number(grupo?.pagado) || 0;
  const saldo = Number(grupo?.saldo) || 0;
  if (!grupo) return { ok: false, error: 'No se encontró el grupo del pago', pagado, saldo };
  if (mov.tipo !== 'ingreso') return { ok: false, error: 'Solo se revierten pagos (ingresos) de grupo', pagado, saldo };
  if (mov.moneda && grupo.moneda && mov.moneda !== grupo.moneda) {
    return { ok: false, error: 'La moneda del pago no coincide con la del grupo', pagado, saldo };
  }
  const m = Number(mov.monto);
  if (!Number.isFinite(m) || m <= 0) return { ok: false, error: 'Monto inválido', pagado, saldo };
  if (m > pagado) return { ok: false, error: 'El pago supera lo registrado como pagado en el grupo', pagado, saldo };
  return { ok: true, pagado: pagado - m, saldo: saldo + m };
}
