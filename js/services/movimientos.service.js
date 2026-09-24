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
  if (mov.esTransferencia) return { ok: false, error: 'Es parte de una transferencia — anulá desde el par completo' };
  if (!TIPO_OPUESTO[mov.tipo]) return { ok: false, error: 'Tipo de movimiento desconocido' };
  const monto = Number(mov.monto);
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, error: 'El movimiento no tiene un monto válido' };
  // Todo cobro de reserva nace con grupoId o reservaId; sin vínculo no se
  // puede revertir el saldo, así que no se anula (los manuales de Caja sí).
  if (mov.cat === 'reserva' && !mov.grupoId && !mov.reservaId) {
    return { ok: false, error: 'Cobro de reserva sin vínculo a la reserva o al grupo: no se puede anular' };
  }
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
  if (mov.reservaId) espejo.reservaId = mov.reservaId;
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

// estadoPago de una reserva individual según lo pagado y el saldo.
export function estadoPagoReserva(pagado, saldo) {
  if (pagado <= 0) return 'pendiente';
  return saldo > 0 ? 'senia' : 'total';
}

// Revierte un cobro de reserva individual: resta de pagado, suma al saldo y
// recalcula estadoPago. Los cobros con afectaSaldo:false (late/early) nunca
// tocaron la reserva, así que no hay nada que revertir.
// Devuelve { ok, error?, sinCambios?, pagado, saldo, estadoPago }.
export function revertirPagoReserva(reserva, mov) {
  const pagado = Number(reserva?.pagado) || 0;
  const saldo = Number(reserva?.saldo) || 0;
  const estadoPago = reserva?.estadoPago;
  if (!reserva) return { ok: false, error: 'No se encontró la reserva del pago', pagado, saldo, estadoPago };
  if (mov.afectaSaldo === false) return { ok: true, sinCambios: true, pagado, saldo, estadoPago };
  if (mov.tipo !== 'ingreso') return { ok: false, error: 'Solo se revierten pagos (ingresos) de reserva', pagado, saldo, estadoPago };
  if (mov.moneda && reserva.moneda && mov.moneda !== reserva.moneda) {
    return { ok: false, error: 'La moneda del pago no coincide con la de la reserva', pagado, saldo, estadoPago };
  }
  const m = Number(mov.monto);
  if (!Number.isFinite(m) || m <= 0) return { ok: false, error: 'Monto inválido', pagado, saldo, estadoPago };
  if (m > pagado) return { ok: false, error: 'El pago supera lo registrado como pagado en la reserva', pagado, saldo, estadoPago };
  const nPagado = pagado - m;
  const nSaldo = saldo + m;
  return { ok: true, pagado: nPagado, saldo: nSaldo, estadoPago: estadoPagoReserva(nPagado, nSaldo) };
}

// Todo movimiento de dinero nace con una cuenta activa existente.
export function validarCuentaMovimiento(cuentaId, cuentas = []) {
  if (!cuentaId) return { ok: false, error: 'Elegí la cuenta del movimiento' };
  const c = cuentas.find(x => x.id === cuentaId);
  if (!c || c.activa === false) return { ok: false, error: 'La cuenta elegida no existe o está inactiva' };
  return { ok: true };
}

// ¿Es parte de un par de anulación (el original anulado o su espejo)?
export function esParAnulacion(m) {
  return !!(m && (m.anulado || m.anulaId));
}

// Movimientos que cuentan para totales brutos (sin anulados ni espejos).
export function sinAnulaciones(movs = []) {
  return movs.filter(m => !esParAnulacion(m));
}

// Totales por moneda. Los brutos excluyen los pares de anulación; el neto
// usa todos los movimientos, así no cambia aunque original y espejo caigan
// en días o períodos distintos (el par suma cero en conjunto).
export function totalesMovimientos(movs = []) {
  const suma = (lista, tipo, moneda) => lista
    .filter(m => m.tipo === tipo && m.moneda === moneda)
    .reduce((s, m) => s + Number(m.monto), 0);
  const validos = sinAnulaciones(movs);
  return {
    ingARS: suma(validos, 'ingreso', 'ARS'),
    ingUSD: suma(validos, 'ingreso', 'USD'),
    egARS:  suma(validos, 'egreso', 'ARS'),
    egUSD:  suma(validos, 'egreso', 'USD'),
    netoARS: suma(movs, 'ingreso', 'ARS') - suma(movs, 'egreso', 'ARS'),
    netoUSD: suma(movs, 'ingreso', 'USD') - suma(movs, 'egreso', 'USD'),
  };
}
