import { describe, expect, it } from 'vitest';
import { leerMonto, pesos } from './formato';

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
