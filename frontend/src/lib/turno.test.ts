import { describe, expect, it } from 'vitest';
import { recordarTurno, turnoSugerido } from './turno';

function almacen() {
  const datos = new Map<string, string>();
  return { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => void datos.set(k, v) };
}

const a = (texto: string) => new Date(texto);

describe('turnoSugerido', () => {
  it('sin nada recordado, decide la hora', () => {
    expect(turnoSugerido(a('2026-11-03T09:00'), almacen())).toBe('morning');
    expect(turnoSugerido(a('2026-11-03T15:59'), almacen())).toBe('morning');
    expect(turnoSugerido(a('2026-11-03T16:00'), almacen())).toBe('night');
  });

  it('repite el turno elegido hoy, aunque la hora diga otra cosa', () => {
    const s = almacen();
    recordarTurno('night', a('2026-11-03T10:00'), s);
    expect(turnoSugerido(a('2026-11-03T11:00'), s)).toBe('night');
  });

  it('lo de anoche no se propone a la mañana siguiente', () => {
    const s = almacen();
    recordarTurno('night', a('2026-11-02T23:30'), s);
    expect(turnoSugerido(a('2026-11-03T09:00'), s)).toBe('morning');
  });

  it('un valor viejo o roto no traba nada', () => {
    const s = almacen();
    s.setItem('cuadernos.ultimoTurno', 'night');
    expect(turnoSugerido(a('2026-11-03T09:00'), s)).toBe('morning');
    s.setItem('cuadernos.ultimoTurno', '{roto');
    expect(turnoSugerido(a('2026-11-03T20:00'), s)).toBe('night');
  });

  it('sin almacenamiento, decide la hora', () => {
    expect(turnoSugerido(a('2026-11-03T20:00'), null)).toBe('night');
  });
});
