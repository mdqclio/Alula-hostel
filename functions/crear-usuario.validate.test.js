import { describe, it, expect } from 'vitest';
import { validateCrearUsuarioBody } from './crear-usuario.validate.js';

const ROLES = ['rol-admin', 'rol-recepcion', 'rol-limpieza'];

const base = {
  email: 'nuevo@alula.com',
  password: 'secreto123',
  nombre: 'Juana Pérez',
  rolId: 'rol-recepcion',
};

describe('validateCrearUsuarioBody', () => {
  it('acepta un body válido y normaliza los valores', () => {
    const r = validateCrearUsuarioBody({ ...base, email: '  nuevo@alula.com  ', nombre: '  Juana Pérez  ' }, ROLES);
    expect(r.valid).toBe(true);
    expect(r.value).toEqual({
      email: 'nuevo@alula.com',
      password: 'secreto123',
      nombre: 'Juana Pérez',
      rolId: 'rol-recepcion',
    });
  });

  it('rechaza email con formato inválido', () => {
    const r = validateCrearUsuarioBody({ ...base, email: 'no-es-un-email' }, ROLES);
    expect(r.valid).toBe(false);
    expect(r.error).toBe('email_invalido');
  });

  it('rechaza email vacío / ausente', () => {
    expect(validateCrearUsuarioBody({ ...base, email: '' }, ROLES).error).toBe('email_invalido');
    expect(validateCrearUsuarioBody({ password: 'secreto123', nombre: 'X', rolId: 'rol-admin' }, ROLES).error).toBe('email_invalido');
  });

  it('rechaza password de menos de 6 caracteres', () => {
    const r = validateCrearUsuarioBody({ ...base, password: '123' }, ROLES);
    expect(r.valid).toBe(false);
    expect(r.error).toBe('password_corta');
  });

  it('acepta password de exactamente 6 caracteres (mínimo de Firebase)', () => {
    const r = validateCrearUsuarioBody({ ...base, password: '123456' }, ROLES);
    expect(r.valid).toBe(true);
  });

  it('rechaza nombre vacío', () => {
    const r = validateCrearUsuarioBody({ ...base, nombre: '   ' }, ROLES);
    expect(r.valid).toBe(false);
    expect(r.error).toBe('nombre_invalido');
  });

  it('rechaza nombre de más de 80 caracteres', () => {
    const r = validateCrearUsuarioBody({ ...base, nombre: 'a'.repeat(81) }, ROLES);
    expect(r.valid).toBe(false);
    expect(r.error).toBe('nombre_invalido');
  });

  it('rechaza rolId inexistente', () => {
    const r = validateCrearUsuarioBody({ ...base, rolId: 'rol-inventado' }, ROLES);
    expect(r.valid).toBe(false);
    expect(r.error).toBe('rol_inexistente');
  });

  it('rechaza cuando no hay roles definidos', () => {
    const r = validateCrearUsuarioBody(base, []);
    expect(r.valid).toBe(false);
    expect(r.error).toBe('rol_inexistente');
  });

  it('no explota con body no-objeto', () => {
    expect(validateCrearUsuarioBody(null, ROLES).valid).toBe(false);
    expect(validateCrearUsuarioBody('nope', ROLES).valid).toBe(false);
  });
});
