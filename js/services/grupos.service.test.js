import { describe, it, expect } from 'vitest';
import { validarGrupo, construirReservasHijas, aplicarPagoGrupo } from './grupos.service.js';

const base = {
  nombre: 'Grupo Vóley Rosario',
  huespedTitularId: 'h1',
  entrada: '2026-10-10',
  salida: '2026-10-13',
  camas: ['1-1', '1-2', '2-1'],
  totalAcordado: 750000,
  reservas: [],
};

describe('validarGrupo', () => {
  it('datos completos y camas libres → ok', () => {
    const r = validarGrupo(base);
    expect(r.ok).toBe(true);
    expect(r.errores).toEqual([]);
  });

  it('salida igual o anterior a entrada → error', () => {
    expect(validarGrupo({ ...base, salida: '2026-10-10' }).ok).toBe(false);
    expect(validarGrupo({ ...base, salida: '2026-10-09' }).errores)
      .toContain('La fecha de salida debe ser posterior a la de entrada');
  });

  it('fechas faltantes → error', () => {
    expect(validarGrupo({ ...base, entrada: '' }).errores).toContain('Completá fecha de entrada y salida');
  });

  it('menos de 2 camas → error', () => {
    const r = validarGrupo({ ...base, camas: ['1-1'] });
    expect(r.ok).toBe(false);
    expect(r.errores.some(e => e.includes('al menos 2'))).toBe(true);
  });

  it('camas repetidas → error', () => {
    expect(validarGrupo({ ...base, camas: ['1-1', '1-1'] }).ok).toBe(false);
  });

  it('total 0, negativo o no numérico → error', () => {
    for (const t of [0, -5, 'abc', undefined]) {
      expect(validarGrupo({ ...base, totalAcordado: t }).errores)
        .toContain('El total acordado debe ser mayor a 0');
    }
  });

  it('sin nombre o sin titular → error', () => {
    expect(validarGrupo({ ...base, nombre: '   ' }).ok).toBe(false);
    expect(validarGrupo({ ...base, huespedTitularId: '' }).ok).toBe(false);
  });

  it('cama con reserva solapada activa → error y la lista', () => {
    const reservas = [{ cama: '1-2', estado: 'confirmada', entrada: '2026-10-12', salida: '2026-10-15' }];
    const r = validarGrupo({ ...base, reservas });
    expect(r.ok).toBe(false);
    expect(r.camasOcupadas).toEqual(['1-2']);
  });

  it('reserva cancelada/checkout o sin solape no bloquea', () => {
    const reservas = [
      { cama: '1-1', estado: 'cancelada', entrada: '2026-10-10', salida: '2026-10-13' },
      { cama: '1-2', estado: 'checkout', entrada: '2026-10-10', salida: '2026-10-13' },
      { cama: '2-1', estado: 'confirmada', entrada: '2026-10-13', salida: '2026-10-15' }, // entra el día que salen
    ];
    expect(validarGrupo({ ...base, reservas }).ok).toBe(true);
  });
});

describe('construirReservasHijas', () => {
  const grupo = { ...base, id: 'g1700000000000', moneda: 'ARS' };

  it('una hija por cama, precio 0, flag grupal y campos de grupo', () => {
    const hijas = construirReservasHijas(grupo);
    expect(hijas).toHaveLength(3);
    for (const h of hijas) {
      expect(h.precio).toBe(0);
      expect(h.esGrupal).toBe(true);
      expect(h.grupoId).toBe('g1700000000000');
      expect(h.grupoNombre).toBe('Grupo Vóley Rosario');
      expect(h.estado).toBe('confirmada');
      expect(h.huespedId).toBe('h1');
    }
    expect(hijas.map(h => h.hab)).toEqual(['1', '1', '2']);
  });

  it('ids únicos', () => {
    const ids = construirReservasHijas(grupo).map(h => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('aplicarPagoGrupo', () => {
  const g = { pagado: 100, saldo: 400 };

  it('pago válido actualiza pagado y saldo', () => {
    expect(aplicarPagoGrupo(g, 150)).toEqual({ ok: true, pagado: 250, saldo: 250 });
  });

  it('pago que cancela el saldo deja saldo 0', () => {
    expect(aplicarPagoGrupo(g, 400)).toMatchObject({ ok: true, saldo: 0, pagado: 500 });
  });

  it('monto inválido o mayor al saldo → error sin cambios', () => {
    expect(aplicarPagoGrupo(g, 0).ok).toBe(false);
    expect(aplicarPagoGrupo(g, 401)).toMatchObject({ ok: false, pagado: 100, saldo: 400 });
  });
});
