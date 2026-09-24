import { describe, it, expect } from 'vitest';
import { puedeAnular, construirAnulacion, revertirPagoGrupo } from './movimientos.service.js';
import { aplicarPagoGrupo } from './grupos.service.js';

const ingreso = {
  id: 'm1', tipo: 'ingreso', cat: 'reserva', moneda: 'ARS', monto: 50000,
  metodo: 'efectivo', fecha: '2026-09-20', concepto: 'Pago reserva Juan', cuenta: 'c1',
};
const opts = { motivo: 'Cargado dos veces', id: 'm2', fecha: '2026-09-24' };

// Suma con signo, como hacen caja/saldos/reportes (ingresos − egresos).
const neto = movs => movs.reduce((s, m) => s + (m.tipo === 'ingreso' ? 1 : -1) * Number(m.monto), 0);

describe('puedeAnular', () => {
  it('movimiento normal → ok', () => {
    expect(puedeAnular(ingreso).ok).toBe(true);
    expect(puedeAnular({ ...ingreso, tipo: 'egreso' }).ok).toBe(true);
  });

  it('ya anulado → error', () => {
    expect(puedeAnular({ ...ingreso, anulado: true })).toEqual({ ok: false, error: 'El movimiento ya está anulado' });
  });

  it('espejo (tiene anulaId) → error', () => {
    expect(puedeAnular({ ...ingreso, anulaId: 'm0' }).ok).toBe(false);
  });

  it('transferencia interna → error', () => {
    expect(puedeAnular({ ...ingreso, esTransferencia: true }))
      .toEqual({ ok: false, error: 'Es parte de una transferencia — anulá desde el par completo' });
  });

  it('inexistente, tipo raro o monto inválido → error', () => {
    expect(puedeAnular(null).ok).toBe(false);
    expect(puedeAnular({ ...ingreso, tipo: 'otro' }).ok).toBe(false);
    expect(puedeAnular({ ...ingreso, monto: 0 }).ok).toBe(false);
  });
});

describe('construirAnulacion', () => {
  it('ingreso → espejo egreso por mismo monto/moneda/cuenta, con anulaId', () => {
    const r = construirAnulacion(ingreso, opts);
    expect(r.ok).toBe(true);
    expect(r.espejo).toMatchObject({
      id: 'm2', tipo: 'egreso', monto: 50000, moneda: 'ARS', cuenta: 'c1', cat: 'reserva',
      fecha: '2026-09-24', concepto: 'Anulación de Pago reserva Juan', anulaId: 'm1',
    });
  });

  it('egreso → espejo ingreso', () => {
    const r = construirAnulacion({ ...ingreso, tipo: 'egreso', concepto: 'Compra' }, opts);
    expect(r.espejo.tipo).toBe('ingreso');
    expect(r.espejo.concepto).toBe('Anulación de Compra');
  });

  it('marca el original anulado con motivo, sin mutar el objeto recibido', () => {
    const mov = { ...ingreso };
    const r = construirAnulacion(mov, { ...opts, motivo: '  Monto mal cargado ' });
    expect(r.original).toMatchObject({ id: 'm1', anulado: true, motivoAnulacion: 'Monto mal cargado', monto: 50000, tipo: 'ingreso' });
    expect(mov.anulado).toBeUndefined();
  });

  it('original + espejo suman cero', () => {
    const r = construirAnulacion(ingreso, opts);
    expect(neto([r.original, r.espejo])).toBe(0);
    const e = construirAnulacion({ ...ingreso, tipo: 'egreso' }, opts);
    expect(neto([e.original, e.espejo])).toBe(0);
  });

  it('sin cuenta → espejo con cuenta null', () => {
    const { cuenta, ...sinCuenta } = ingreso;
    expect(construirAnulacion(sinCuenta, opts).espejo.cuenta).toBeNull();
  });

  it('copia grupoId y datos de TC al espejo', () => {
    const r = construirAnulacion({ ...ingreso, moneda: 'USD', grupoId: 'g1', tcARS: 1400, equivalenteARS: 70000000 }, opts);
    expect(r.espejo).toMatchObject({ grupoId: 'g1', moneda: 'USD', tcARS: 1400, equivalenteARS: 70000000 });
  });

  it('motivo vacío o solo espacios → error', () => {
    expect(construirAnulacion(ingreso, { ...opts, motivo: '' }).ok).toBe(false);
    expect(construirAnulacion(ingreso, { ...opts, motivo: '   ' }).error).toBe('Indicá el motivo de la anulación');
  });

  it('no permite anular dos veces ni anular el espejo', () => {
    const r = construirAnulacion(ingreso, opts);
    expect(construirAnulacion(r.original, { ...opts, id: 'm3' }).ok).toBe(false);
    expect(construirAnulacion(r.espejo, { ...opts, id: 'm3' }).ok).toBe(false);
  });
});

describe('revertirPagoGrupo', () => {
  const grupo = { id: 'g1', moneda: 'ARS', totalAcordado: 750000, pagado: 200000, saldo: 550000 };
  const pago = { ...ingreso, monto: 150000, grupoId: 'g1' };

  it('resta de pagado y suma al saldo', () => {
    expect(revertirPagoGrupo(grupo, pago)).toEqual({ ok: true, pagado: 50000, saldo: 700000 });
  });

  it('es el inverso de aplicarPagoGrupo', () => {
    const tras = aplicarPagoGrupo(grupo, 150000);
    const vuelta = revertirPagoGrupo({ ...grupo, pagado: tras.pagado, saldo: tras.saldo }, pago);
    expect(vuelta).toEqual({ ok: true, pagado: grupo.pagado, saldo: grupo.saldo });
  });

  it('monto mayor a lo pagado → error', () => {
    expect(revertirPagoGrupo(grupo, { ...pago, monto: 200001 }).ok).toBe(false);
  });

  it('grupo inexistente, egreso o moneda distinta → error', () => {
    expect(revertirPagoGrupo(null, pago).ok).toBe(false);
    expect(revertirPagoGrupo(grupo, { ...pago, tipo: 'egreso' }).ok).toBe(false);
    expect(revertirPagoGrupo(grupo, { ...pago, moneda: 'USD' }).ok).toBe(false);
  });
});
