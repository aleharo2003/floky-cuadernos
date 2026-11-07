import { describe, expect, it } from 'vitest';
import {
  MONTO_ILEGIBLE,
  cursorDespuesDeFormatear,
  diaConNombre,
  leerMonto,
  montoMientrasSeEscribe,
  montoPegado,
  pesos,
  problemaDeMonto,
} from './formato';

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

describe('montoMientrasSeEscribe', () => {
  it.each([
    ['', ''],
    ['4', '4'],
    ['4500', '4.500'],
    ['45000', '45.000'],
    ['1234567', '1.234.567'],
    ['45.000', '45.000'],
    ['4.5000', '45.000'], // los puntos los pone el campo, no quien escribe
    ['45000,5', '45.000,5'],
    ['45000,50', '45.000,50'],
    ['45.000,999', '45.000,999'], // no corta: el aviso de decimales lo da problemaDeMonto
    [',5', '0,5'],
    ['007', '7'],
    ['0,50', '0,50'],
    ['12a3', '123'],
    ['1,2,3', '1,23'],
  ])('%s queda %s', (texto, esperado) => {
    expect(montoMientrasSeEscribe(texto)).toBe(esperado);
  });
});

describe('cursorDespuesDeFormatear', () => {
  it('al final sigue al final', () => {
    expect(cursorDespuesDeFormatear('45000', 5, '45.000')).toBe(6);
  });

  it('en el medio queda detrás de las mismas cifras', () => {
    // Se escribió el 9 después del 1 en "1.234": "19.234" -> el cursor queda después del 9.
    expect(cursorDespuesDeFormatear('19.234', 2, '19.234')).toBe(2);
    // Se borró el 2 de "1.234": "1.34" -> "134", el cursor queda después del 1.
    expect(cursorDespuesDeFormatear('1.34', 2, '134')).toBe(1);
  });

  it('al principio queda al principio', () => {
    expect(cursorDespuesDeFormatear('45000', 0, '45.000')).toBe(0);
  });
});

describe('montoPegado', () => {
  it.each([
    ['45.000,50', '45.000,50'],
    ['$ 45.000', '45.000'],
    ['12345.67', '12.345,67'],
    ['10,999', '10,999'],
    ['1300000', '1.300.000'],
  ])('%s queda %s', (texto, esperado) => {
    expect(montoPegado(texto)).toBe(esperado);
  });

  it('lo que no se entiende devuelve null', () => {
    expect(montoPegado('cuarenta mil')).toBeNull();
  });
});
