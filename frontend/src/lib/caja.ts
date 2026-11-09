import type { Caja, Turno } from '../types';

/** Lo que muestra Cargar sobre la caja de un turno. */
export type CajaDelTurno =
  | { estado: 'sinInicial' }
  | { estado: 'antesDelInicial' }
  | { estado: 'ok'; haber: number; negativo: boolean };

/**
 * El efectivo que debería haber al cerrar un turno, a partir de la caja de ese día (ADR-0008).
 *
 * Si el turno tiene movimientos, es su cierre. Si no, la caja no se movió: queda lo que había antes.
 * Para la mañana eso es lo que la noche del mismo día recibió al empezar; si tampoco hubo noche, el
 * haber al terminar el día, que la API calcula con los días anteriores.
 */
export function cajaDelTurno(caja: Caja, dia: string, turno: Turno): CajaDelTurno {
  if (!caja.inicial) return { estado: 'sinInicial' };
  if (caja.haberAlFinal === null) return { estado: 'antesDelInicial' };
  const delDia = caja.cierres.filter((c) => c.fecha === dia);
  const propio = delDia.find((c) => c.turno === turno);
  if (propio) return { estado: 'ok', haber: propio.despues, negativo: propio.negativo };
  const noche = delDia.find((c) => c.turno === 'night');
  const haber = turno === 'morning' && noche ? noche.antes : caja.haberAlFinal;
  return { estado: 'ok', haber, negativo: haber < 0 };
}
