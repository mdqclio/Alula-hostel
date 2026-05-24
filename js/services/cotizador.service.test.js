import { describe, it, expect } from 'vitest';
import { cotizar } from './cotizador.service.js';

// ---------- fixtures plain (sin mocks, sin Firebase) ----------

const hab = (id, camas, activa = true) => ({ id, camas, activa, nota: '' });

// Temporada media simple sin períodos (resolverTemporada cae al default 'media').
const temporadasMedia = { media: { precio: 27000, moneda: 'ARS', periodos: [] } };

const monedas = [{ code: 'ARS', symbol: '$' }, { code: 'USD', symbol: 'USD' }];

// 4 camas con atributos de score creciente: 1-1=0, 1-3=20, 1-2=30, 1-4=40
const camasConfig4 = {
  '1-1': {},
  '1-2': { vista: 'mar' },                              // +30
  '1-3': { balcon: true },                              // +20
  '1-4': { banoSuite: true, habitacionPremium: true },  // +25 +15 = 40
};

const base4 = {
  entrada: '2026-02-10',
  salida: '2026-02-13', // 3 noches
  reservas: [],
  camasConfig: camasConfig4,
  habitaciones: [hab('1', 4)],
  temporadas: temporadasMedia,
  monedas,
};

describe('cotizar — validación de fechas', () => {
  it('1. fechas inválidas → ok:false, error fechas_invalidas', () => {
    expect(cotizar({ ...base4, entrada: 'no-date' }).error).toBe('fechas_invalidas');
    expect(cotizar({ ...base4, salida: '2026-13-40' }).error).toBe('fechas_invalidas');
    expect(cotizar({ ...base4, entrada: '2026-02-30' }).error).toBe('fechas_invalidas'); // día inexistente
    expect(cotizar({}).error).toBe('fechas_invalidas');
  });

  it('2. salida <= entrada → ok:false, error fechas_invertidas', () => {
    expect(cotizar({ ...base4, salida: '2026-02-10' }).error).toBe('fechas_invertidas'); // igual
    expect(cotizar({ ...base4, entrada: '2026-02-13', salida: '2026-02-10' }).error).toBe('fechas_invertidas');
  });
});

describe('cotizar — caso OK base', () => {
  it('3. sin reservas, 3 noches, 4 camas → 4 disponibles, orden por precio asc, sugerencia = mayor score', () => {
    const r = cotizar(base4);
    expect(r.ok).toBe(true);
    expect(r.noches).toBe(3);
    expect(r.camas).toHaveLength(4);
    // orden por precioTotal ascendente
    const totales = r.camas.map(c => c.precioTotal);
    expect([...totales].sort((a, b) => a - b)).toEqual(totales);
    // la más barata es la de menor score (1-1), la sugerencia es la de mayor score (1-4)
    expect(r.camas[0].camaId).toBe('1-1');
    expect(r.sugerencia.camaId).toBe('1-4');
    expect(r.sugerencia.score).toBe(40);
    expect(r.warnings).toEqual([]); // hay precio de temporada
  });

  it('10. precioTotal === precioPorNoche × noches para cada cama', () => {
    const r = cotizar(base4);
    r.camas.forEach(c => expect(c.precioTotal).toBe(c.precioPorNoche * r.noches));
  });
});

describe('cotizar — disponibilidad', () => {
  it('4. todas las camas reservadas en el rango → ok:false, error sin_camas', () => {
    const reservas = ['1-1', '1-2', '1-3', '1-4'].map(cama => ({
      cama, estado: 'confirmada', entrada: '2026-02-08', salida: '2026-02-20',
    }));
    const r = cotizar({ ...base4, reservas });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('sin_camas');
    expect(typeof r.mensaje).toBe('string');
  });

  it('5. algunas reservadas → solo las libres aparecen en camas', () => {
    const reservas = [{ cama: '1-2', estado: 'confirmada', entrada: '2026-02-08', salida: '2026-02-20' }];
    const r = cotizar({ ...base4, reservas });
    expect(r.ok).toBe(true);
    expect(r.camas.map(c => c.camaId).sort()).toEqual(['1-1', '1-3', '1-4']);
    expect(r.camas.find(c => c.camaId === '1-2')).toBeUndefined();
  });

  it('5b. reserva en checkout/cancelada NO bloquea (se ignora)', () => {
    const reservas = [
      { cama: '1-1', estado: 'checkout', entrada: '2026-02-08', salida: '2026-02-20' },
      { cama: '1-2', estado: 'cancelada', entrada: '2026-02-08', salida: '2026-02-20' },
    ];
    const r = cotizar({ ...base4, reservas });
    expect(r.camas).toHaveLength(4); // ninguna bloqueada
  });
});

describe('cotizar — temporadas y precios', () => {
  it('6. sin temporadas configuradas → warning, precioBase 0, precios 0, ok:true', () => {
    const r = cotizar({ ...base4, temporadas: {} });
    expect(r.ok).toBe(true);
    expect(r.precioBase).toBe(0);
    expect(r.temporada).toBeNull();
    expect(r.warnings).toContain('Sin precios de temporada configurados');
    expect(r.camas.every(c => c.precioTotal === 0 && c.precioPorNoche === 0)).toBe(true);
  });

  it('6b. temporada presente pero sin precio (0) → warning y precioBase 0', () => {
    const r = cotizar({ ...base4, temporadas: { media: { precio: 0, moneda: 'ARS', periodos: [] } } });
    expect(r.ok).toBe(true);
    expect(r.precioBase).toBe(0);
    expect(r.warnings).toContain('Sin precios de temporada configurados');
  });

  it('7. temporada alta vs baja → precioBase distinto para el mismo rango', () => {
    const periodoFeb = [{ tipo: 'especifico', desde: '2026-02-01', hasta: '2026-02-28' }];
    const tAlta = { alta: { precio: 35000, moneda: 'ARS', periodos: periodoFeb }, media: { precio: 27000, periodos: [] }, baja: { precio: 22000, periodos: [] } };
    const tBaja = { alta: { precio: 35000, periodos: [] }, media: { precio: 27000, periodos: [] }, baja: { precio: 22000, moneda: 'ARS', periodos: periodoFeb } };
    const rAlta = cotizar({ ...base4, temporadas: tAlta });
    const rBaja = cotizar({ ...base4, temporadas: tBaja });
    expect(rAlta.temporada).toBe('alta');
    expect(rAlta.precioBase).toBe(35000);
    expect(rBaja.temporada).toBe('baja');
    expect(rBaja.precioBase).toBe(22000);
    expect(rAlta.precioBase).not.toBe(rBaja.precioBase);
  });

  it('moneda: usa la de la temporada; si falta, cae a la default de monedas', () => {
    const rUsd = cotizar({ ...base4, temporadas: { media: { precio: 100, moneda: 'USD', periodos: [] } } });
    expect(rUsd.moneda).toBe('USD');
    const rDefault = cotizar({ ...base4, temporadas: { media: { precio: 100, periodos: [] } } });
    expect(rDefault.moneda).toBe('ARS'); // primera de `monedas`
  });
});

describe('cotizar — tiers', () => {
  it('8a. 1 cama disponible → tier economico', () => {
    const r = cotizar({ ...base4, habitaciones: [hab('1', 1)], camasConfig: { '1-1': {} } });
    expect(r.camas).toHaveLength(1);
    expect(r.camas[0].tier).toBe('economico');
  });

  it('8b. 3 camas → economico / medio / premium', () => {
    const cfg = { '1-1': {}, '1-2': { vista: 'parcial' }, '1-3': { vista: 'mar' } }; // scores 0/15/30
    const r = cotizar({ ...base4, habitaciones: [hab('1', 3)], camasConfig: cfg });
    expect(r.camas.map(c => c.tier)).toEqual(['economico', 'medio', 'premium']);
  });

  it('8c. 9 camas → 3 de cada tier (tertiles)', () => {
    const cfg = {};
    for (let i = 1; i <= 9; i++) cfg['1-' + i] = { scoreBase: i }; // scores distintos crecientes
    const r = cotizar({ ...base4, habitaciones: [hab('1', 9)], camasConfig: cfg });
    const counts = r.camas.reduce((m, c) => (m[c.tier] = (m[c.tier] || 0) + 1, m), {});
    expect(counts).toEqual({ economico: 3, medio: 3, premium: 3 });
  });
});

describe('cotizar — sugerencia y alternativas', () => {
  it('9. la sugerencia es la de mayor score aunque no sea la más barata', () => {
    const r = cotizar(base4);
    // 1-4 (score 40) es la más cara y aun así es la sugerencia
    expect(r.sugerencia.camaId).toBe('1-4');
    expect(r.sugerencia.camaId).not.toBe(r.camas[0].camaId); // no es la más barata
    expect(Math.max(...r.camas.map(c => c.score))).toBe(r.sugerencia.score);
  });

  it('9b. empate de score → gana la más barata', () => {
    // dos camas con score 0; la sugerencia debe ser una de score 0 y la más barata entre empatadas
    const cfg = { '1-1': {}, '1-2': {} };
    const r = cotizar({ ...base4, habitaciones: [hab('1', 2)], camasConfig: cfg });
    expect(r.sugerencia.score).toBe(0);
    expect(r.sugerencia.precioTotal).toBe(Math.min(...r.camas.map(c => c.precioTotal)));
  });

  it('alternativas: excluye la sugerencia y trae como máximo 5', () => {
    const cfg = {};
    for (let i = 1; i <= 8; i++) cfg['1-' + i] = { scoreBase: i };
    const r = cotizar({ ...base4, habitaciones: [hab('1', 8)], camasConfig: cfg });
    expect(r.alternativas.length).toBeLessThanOrEqual(5);
    expect(r.alternativas.find(c => c.camaId === r.sugerencia.camaId)).toBeUndefined();
  });
});

describe('cotizar — forma de la respuesta', () => {
  it('incluye todos los campos del contrato en caso OK', () => {
    const r = cotizar(base4);
    expect(Object.keys(r).sort()).toEqual(
      ['alternativas', 'camas', 'entrada', 'moneda', 'noches', 'ocupacion', 'ok', 'precioBase', 'salida', 'sugerencia', 'temporada', 'warnings'].sort()
    );
    const c = r.camas[0];
    expect(Object.keys(c).sort()).toEqual(
      ['atributos', 'camaId', 'disponible', 'habitacionId', 'label', 'precioPorNoche', 'precioTotal', 'score', 'tier'].sort()
    );
    expect(c.label).toMatch(/^Hab 1 — Cama \d+$/);
    expect(c.disponible).toBe(true);
  });
});
