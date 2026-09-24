// ===================== RESERVAS GRUPALES — lógica pura =====================
// Sin DOM ni Firebase: validación, armado de reservas hijas y aplicación de
// pagos. La UI (js/grupos.js) persiste lo que devuelven estas funciones.
import { isCamaDisponible } from './camas.service.js';

export const MIN_CAMAS_GRUPO = 2;

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Valida los datos de alta de un grupo contra las reservas existentes.
// Devuelve { ok, errores: string[], camasOcupadas: string[] }.
// `senia` es opcional: vacío/0 = sin seña; si viene, 0 <= senia <= totalAcordado.
export function validarGrupo({ nombre, huespedTitularId, entrada, salida, camas, totalAcordado, senia, reservas = [] } = {}) {
  const errores = [];
  const camasOcupadas = [];

  if (!nombre || !String(nombre).trim()) errores.push('Ingresá un nombre para el grupo');
  if (!huespedTitularId) errores.push('Elegí o cargá un titular');

  const fechasOk = FECHA_RE.test(entrada || '') && FECHA_RE.test(salida || '');
  if (!fechasOk) {
    errores.push('Completá fecha de entrada y salida');
  } else if (salida <= entrada) {
    errores.push('La fecha de salida debe ser posterior a la de entrada');
  }

  const lista = Array.isArray(camas) ? camas : [];
  if (new Set(lista).size !== lista.length) errores.push('Hay camas repetidas en la selección');
  if (lista.length < MIN_CAMAS_GRUPO) errores.push(`Una reserva grupal necesita al menos ${MIN_CAMAS_GRUPO} camas`);

  const total = Number(totalAcordado);
  if (!Number.isFinite(total) || total <= 0) errores.push('El total acordado debe ser mayor a 0');

  if (senia !== undefined && senia !== null && senia !== '') {
    const s = Number(senia);
    if (!Number.isFinite(s) || s < 0) errores.push('La seña debe ser un monto válido');
    else if (Number.isFinite(total) && s > total) errores.push('La seña no puede superar el total acordado');
  }

  if (fechasOk && salida > entrada) {
    for (const c of lista) {
      if (!isCamaDisponible(c, entrada, salida, reservas)) camasOcupadas.push(c);
    }
    if (camasOcupadas.length) errores.push(`Camas no disponibles en esas fechas: ${camasOcupadas.join(', ')}`);
  }

  return { ok: errores.length === 0, errores, camasOcupadas };
}

// Arma las N reservas hijas (una por cama) con el shape de una reserva
// individual. Precio 0 y esGrupal:true: el dinero vive solo en el grupo.
export function construirReservasHijas(grupo) {
  return grupo.camas.map((cama, i) => ({
    id: `r${grupo.id.slice(1)}-${i + 1}`,
    huespedId: grupo.huespedTitularId,
    hab: String(cama).split('-')[0],
    cama,
    entrada: grupo.entrada,
    salida: grupo.salida,
    precio: 0,
    moneda: grupo.moneda,
    pago: '',
    plataforma: 'directo',
    estado: 'confirmada',
    estadoPago: 'grupal',
    pagado: 0,
    saldo: 0,
    notas: '',
    grupoId: grupo.id,
    grupoNombre: grupo.nombre,
    esGrupal: true,
  }));
}

// Aplica un pago al grupo. No permite montos <= 0 ni pagar más que el saldo.
// Devuelve { ok, error?, pagado, saldo }.
export function aplicarPagoGrupo(grupo, monto) {
  const m = Number(monto);
  const pagado = Number(grupo.pagado) || 0;
  const saldo = Number(grupo.saldo) || 0;
  if (!Number.isFinite(m) || m <= 0) return { ok: false, error: 'Ingresá un monto válido', pagado, saldo };
  if (m > saldo) return { ok: false, error: 'El monto supera el saldo del grupo', pagado, saldo };
  return { ok: true, pagado: pagado + m, saldo: saldo - m };
}
