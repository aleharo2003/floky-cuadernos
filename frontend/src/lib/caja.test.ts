import { describe, expect, it } from 'vitest';
import type { Caja, CierreCaja } from '../types';
import { cajaDelTurno } from './caja';

const inicial = { fecha: '2026-11-01', turno: 'night' as const, monto: 500000, cargadoPor: 'Lucía', cargadoEl: '2026-11-01T22:00:00' };

const cierre = (fecha: string, turno: 'morning' | 'night', antes: number, despues: number): CierreCaja => ({
  fecha,
  turno,
  ventas: 0,
  sinEfectivo: 0,
  gastosEfectivo: 0,
  gastosSinEfectivo: 0,
  antes,
  despues,
  negativo: despues < 0,
});

const caja = (cierres: CierreCaja[], haberAlFinal: number | null): Caja => ({ inicial, cierres, haberAlFinal });

describe('cajaDelTurno', () => {
  it('sin haber inicial no hay caja', () => {
    expect(cajaDelTurno({ inicial: null, cierres: [], haberAlFinal: null }, '2026-11-05', 'night')).toEqual({ estado: 'sinInicial' });
  });

  it('antes del haber inicial tampoco', () => {
    expect(cajaDelTurno(caja([], null), '2026-10-20', 'night')).toEqual({ estado: 'antesDelInicial' });
  });

  it('con movimientos en el turno, es su cierre', () => {
    const c = caja([cierre('2026-11-05', 'morning', 500000, 455000), cierre('2026-11-05', 'night', 455000, 775000)], 775000);
    expect(cajaDelTurno(c, '2026-11-05', 'morning')).toEqual({ estado: 'ok', haber: 455000, negativo: false });
    expect(cajaDelTurno(c, '2026-11-05', 'night')).toEqual({ estado: 'ok', haber: 775000, negativo: false });
  });

  it('una mañana sin movimientos deja lo que tenía: lo que recibió la noche', () => {
    const c = caja([cierre('2026-11-05', 'night', 455000, 775000)], 775000);
    expect(cajaDelTurno(c, '2026-11-05', 'morning')).toEqual({ estado: 'ok', haber: 455000, negativo: false });
  });

  it('un turno sin movimientos y sin noche después: el haber al terminar el día', () => {
    const c = caja([cierre('2026-11-05', 'morning', 500000, 455000)], 455000);
    expect(cajaDelTurno(c, '2026-11-05', 'night')).toEqual({ estado: 'ok', haber: 455000, negativo: false });
    expect(cajaDelTurno(caja([], 500000), '2026-11-06', 'morning')).toEqual({ estado: 'ok', haber: 500000, negativo: false });
  });

  it('avisa si quedó en negativo', () => {
    const c = caja([cierre('2026-11-05', 'night', 10000, -5000)], -5000);
    expect(cajaDelTurno(c, '2026-11-05', 'night')).toEqual({ estado: 'ok', haber: -5000, negativo: true });
  });
});
