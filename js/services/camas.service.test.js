import { describe, it, expect } from 'vitest';
import {
  calcularScoreCama,
  isCamaDisponible,
  calcularOcupacionGlobal,
  calcularOcupacionHabitacion,
  calcularPrecioCama,
  sugerirCama,
} from './camas.service.js';

// Atributos que dan el score máximo teórico (115) con scoreBase 0.
const camaMax = {
  tipo: 'abajo',          // +10
  vista: 'mar',           // +30
  balcon: true,           // +20
  banoSuite: true,        // +25
  habitacionPremium: true,// +15
  ruido: 'bajo',          // +10
  cercaniaBano: 'cerca',  // +5
  scoreBase: 0,
};

describe('calcularScoreCama', () => {
  it('cama vacía → 0', () => {
    expect(calcularScoreCama({})).toBe(0);
  });

  it('todos los atributos al máximo (scoreBase 0) → 115', () => {
    expect(calcularScoreCama(camaMax)).toBe(115);
  });

  it('mismo set con scoreBase=10 → 125', () => {
    expect(calcularScoreCama({ ...camaMax, scoreBase: 10 })).toBe(125);
  });

  it('combinaciones intermedias', () => {
    expect(calcularScoreCama({ vista: 'mar' })).toBe(30);
    expect(calcularScoreCama({ vista: 'parcial', balcon: true })).toBe(35); // 15 + 20
    // valores negativos: arriba(0) + ruido alto(-10) + baño lejos(-5)
    expect(calcularScoreCama({ tipo: 'arriba', ruido: 'alto', cercaniaBano: 'lejos' })).toBe(-15);
    // valores neutros explícitos
    expect(calcularScoreCama({ tipo: 'arriba', vista: 'ninguna', ruido: 'medio', cercaniaBano: 'normal' })).toBe(0);
  });

  it('ignora atributos desconocidos (?? 0)', () => {
    expect(calcularScoreCama({ vista: 'inexistente', ruido: 'raro' })).toBe(0);
  });
});

describe('isCamaDisponible', () => {
  const entrada = '2026-02-10';
  const salida = '2026-02-15';

  it('cama libre en el rango → true', () => {
    expect(isCamaDisponible('c1', entrada, salida, [])).toBe(true);
    // reservas existen pero en otra cama
    const reservas = [{ cama: 'c2', estado: 'confirmada', entrada: '2026-02-10', salida: '2026-02-15' }];
    expect(isCamaDisponible('c1', entrada, salida, reservas)).toBe(true);
  });

  it('reserva exactamente solapada → false', () => {
    const reservas = [{ cama: 'c1', estado: 'confirmada', entrada: '2026-02-10', salida: '2026-02-15' }];
    expect(isCamaDisponible('c1', entrada, salida, reservas)).toBe(false);
  });

  it('reserva que termina el día que empieza la nueva → true (borde sin igualdad)', () => {
    // existente termina 2026-02-10, la nueva empieza 2026-02-10
    const reservas = [{ cama: 'c1', estado: 'confirmada', entrada: '2026-02-05', salida: '2026-02-10' }];
    expect(isCamaDisponible('c1', entrada, salida, reservas)).toBe(true);
  });

  it('reserva que empieza el día que termina la nueva → true', () => {
    const reservas = [{ cama: 'c1', estado: 'confirmada', entrada: '2026-02-15', salida: '2026-02-20' }];
    expect(isCamaDisponible('c1', entrada, salida, reservas)).toBe(true);
  });

  it('reserva solapada pero estado checkout/cancelada → se ignora → true', () => {
    const checkout = [{ cama: 'c1', estado: 'checkout', entrada: '2026-02-10', salida: '2026-02-15' }];
    expect(isCamaDisponible('c1', entrada, salida, checkout)).toBe(true);
    const cancelada = [{ cama: 'c1', estado: 'cancelada', entrada: '2026-02-10', salida: '2026-02-15' }];
    expect(isCamaDisponible('c1', entrada, salida, cancelada)).toBe(true);
  });
});

describe('calcularOcupacionGlobal', () => {
  const entrada = '2026-02-10';
  const salida = '2026-02-15';
  const r = (cama, estado = 'confirmada') => ({ cama, estado, hab: 'h1', entrada: '2026-02-08', salida: '2026-02-20' });

  it('0 reservas → 0', () => {
    expect(calcularOcupacionGlobal(entrada, salida, [], 10)).toBe(0);
  });

  it('totalCamas 0 → 0 (guard)', () => {
    expect(calcularOcupacionGlobal(entrada, salida, [r('c1')], 0)).toBe(0);
  });

  it('todas las camas ocupadas → 100', () => {
    const reservas = [r('c1'), r('c2'), r('c3'), r('c4')];
    expect(calcularOcupacionGlobal(entrada, salida, reservas, 4)).toBe(100);
  });

  it('mitad ocupadas → 50', () => {
    const reservas = [r('c1'), r('c2')];
    expect(calcularOcupacionGlobal(entrada, salida, reservas, 4)).toBe(50);
  });

  it('ignora reservas fuera del período o en checkout', () => {
    const reservas = [
      r('c1'),
      { cama: 'c2', estado: 'checkout', hab: 'h1', entrada: '2026-02-08', salida: '2026-02-20' },
      { cama: 'c3', estado: 'confirmada', hab: 'h1', entrada: '2026-03-01', salida: '2026-03-05' },
    ];
    // sólo c1 cuenta → 1/4 = 25
    expect(calcularOcupacionGlobal(entrada, salida, reservas, 4)).toBe(25);
  });
});

describe('calcularOcupacionHabitacion', () => {
  const entrada = '2026-02-10';
  const salida = '2026-02-15';
  const r = (cama, hab) => ({ cama, hab, estado: 'confirmada', entrada: '2026-02-08', salida: '2026-02-20' });

  it('0 reservas → 0', () => {
    expect(calcularOcupacionHabitacion('h1', entrada, salida, [], 4)).toBe(0);
  });

  it('camasEnHab 0 → 0 (guard)', () => {
    expect(calcularOcupacionHabitacion('h1', entrada, salida, [r('c1', 'h1')], 0)).toBe(0);
  });

  it('cuenta sólo las reservas de la habitación pedida', () => {
    const reservas = [r('c1', 'h1'), r('c2', 'h1'), r('c5', 'h2')];
    // h1 tiene 2 de 4 camas → 50
    expect(calcularOcupacionHabitacion('h1', entrada, salida, reservas, 4)).toBe(50);
    // h2 tiene 1 de 2 → 50
    expect(calcularOcupacionHabitacion('h2', entrada, salida, reservas, 2)).toBe(50);
  });
});

describe('calcularPrecioCama', () => {
  const camaScore0 = { vista: 'ninguna' }; // score 0 → factorCalidad 1

  it('bandas de ocupación (con factorCalidad neutro, base 1000)', () => {
    expect(calcularPrecioCama(camaScore0, 85, 1000)).toBe(1300); // >=85 → 1.30
    expect(calcularPrecioCama(camaScore0, 70, 1000)).toBe(1150); // >=70 → 1.15
    expect(calcularPrecioCama(camaScore0, 50, 1000)).toBe(1050); // >=50 → 1.05
    expect(calcularPrecioCama(camaScore0, 30, 1000)).toBe(1000); // 30..49 → 1.00
    expect(calcularPrecioCama(camaScore0, 29, 1000)).toBe(900);  // <30 → 0.90
    expect(calcularPrecioCama(camaScore0, 0, 1000)).toBe(900);   // <30 → 0.90
  });

  it('factor de calidad lineal con el score (ocupación neutra 40, base 1000)', () => {
    expect(calcularPrecioCama({ ...camaMax }, 40, 1000)).toBe(1500);   // score 115 → +50%
    expect(calcularPrecioCama(camaScore0, 40, 1000)).toBe(1000);       // score 0 → +0%
    expect(calcularPrecioCama({ vista: 'mar' }, 40, 1000)).toBe(1130); // score 30 → 1+(30/115)*0.5
  });

  it('combina calidad y ocupación', () => {
    // score 115 (factor 1.5) y ocupación 85 (1.30) → 1000*1.5*1.30 = 1950
    expect(calcularPrecioCama({ ...camaMax }, 85, 1000)).toBe(1950);
  });
});

describe('sugerirCama', () => {
  const entrada = '2026-02-10';
  const salida = '2026-02-15';
  const camas = [
    { id: 'c1', vista: 'ninguna' },            // score 0
    { id: 'c2', vista: 'mar', balcon: true },  // score 50
    { id: 'c3', vista: 'parcial' },            // score 15
  ];

  it('lista vacía → null', () => {
    expect(sugerirCama(entrada, salida, [], [])).toBeNull();
  });

  it('múltiples camas libres → devuelve la del score más alto', () => {
    const sugerida = sugerirCama(entrada, salida, camas, []);
    expect(sugerida).not.toBeNull();
    expect(sugerida.id).toBe('c2');
  });

  it('omite las ocupadas y sugiere la mejor disponible', () => {
    // c2 (la mejor) ocupada → debería sugerir c3 (15) sobre c1 (0)
    const reservas = [{ cama: 'c2', estado: 'confirmada', entrada: '2026-02-08', salida: '2026-02-20' }];
    const sugerida = sugerirCama(entrada, salida, camas, reservas);
    expect(sugerida.id).toBe('c3');
  });

  it('todas ocupadas → null', () => {
    const reservas = camas.map(c => ({
      cama: c.id, estado: 'confirmada', entrada: '2026-02-08', salida: '2026-02-20',
    }));
    expect(sugerirCama(entrada, salida, camas, reservas)).toBeNull();
  });
});
