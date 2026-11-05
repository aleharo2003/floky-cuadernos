import { describe, expect, it } from 'vitest';
import { MONTO_ILEGIBLE, diaConNombre, leerMonto, pesos, problemaDeMonto } from './formato';

describe('leerMonto', () => {
  it.each([
    ['45000', 45000],
    ['45.000', 45000],
    ['1.300.000', 1300000],
    ['1.234.567,89', 1234567.89],
    ['45.000,50', 45000.5],
    ['45000,5', 45000.5],
    ['12345.67', 12345.67],
    ['12.50', 12.5],
    ['$ 1.000', 1000],
    [' 0 ', 0],
    ['0,10', 0.1],
    ['10,005', 10.01],
  ])('lee "%s" como %d', (texto, esperado) => {
    expect(leerMonto(texto)).toBe(esperado);
  });

  it.each(['', '   ', 'abc', '1,2,3', '12a', '-500', '1..2'])('no inventa un número para "%s"', (texto) => {
    expect(leerMonto(texto)).toBeNaN();
  });
});

describe('pesos', () => {
  it('formatea en pesos argentinos, con el signo adelante', () => {
    expect(pesos(1234567.8)).toBe('$ 1.234.567,80');
    expect(pesos(-200000)).toBe('-$ 200.000,00');
  });
});

describe('diaConNombre', () => {
  it('nombra el día sin correrlo por la zona horaria', () => {
    expect(diaConNombre('2026-11-03')).toBe('martes 3/11');
    expect(diaConNombre('2026-11-01')).toBe('domingo 1/11');
    expect(diaConNombre('2026-12-31')).toBe('jueves 31/12');
  });
});

describe('problemaDeMonto', () => {
  it.each(['45.000', '45.000,50', '1.300.000', '0,01', '999.999.999.999,99'])('"%s" se puede guardar', (texto) => {
    expect(problemaDeMonto(texto)).toBeNull();
  });

  it('no redondea en silencio: más de 2 decimales avisa', () => {
    expect(problemaDeMonto('10,999')).toBe('El monto puede tener hasta 2 decimales.');
    expect(problemaDeMonto('10.999')).toBeNull(); // sin coma, el punto es de miles: diez mil novecientos noventa y nueve
    expect(problemaDeMonto('12.5555')).toBe('El monto puede tener hasta 2 decimales.');
  });

  it('avisa si es demasiado grande, cero o ilegible', () => {
    expect(problemaDeMonto('99999999999999')).toBe('El monto es demasiado grande.');
    expect(problemaDeMonto('0')).toBe('El monto tiene que ser mayor que cero.');
    expect(problemaDeMonto('0', { permitirCero: true })).toBeNull();
    expect(problemaDeMonto('abc')).toBe(MONTO_ILEGIBLE);
  });
});
