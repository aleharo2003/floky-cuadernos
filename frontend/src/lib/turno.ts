import type { Turno } from '../types';

/** A partir de esta hora se propone el turno noche. */
const HORA_NOCHE = 16;
const CLAVE = 'cuadernos.ultimoTurno';

interface Recordado {
  turno: Turno;
  dia: string;
}

/**
 * El turno que se propone al cargar. Si en este navegador ya se tocó uno hoy, se repite ese, aunque
 * no se haya guardado nada; si no, decide la hora. El recuerdo vence al cambiar el día: "Noche" de
 * anoche no se propone a la mañana.
 */
export function turnoSugerido(ahora: Date = new Date(), almacen: Pick<Storage, 'getItem'> | null = guardado()): Turno {
  try {
    const r = JSON.parse(almacen?.getItem(CLAVE) ?? 'null') as Recordado | null;
    if (r && r.dia === dia(ahora) && (r.turno === 'morning' || r.turno === 'night')) return r.turno;
  } catch {
    // Un valor viejo o roto no traba la carga: se decide por la hora.
  }
  return ahora.getHours() < HORA_NOCHE ? 'morning' : 'night';
}

export function recordarTurno(turno: Turno, ahora: Date = new Date(), almacen: Pick<Storage, 'setItem'> | null = guardado()): void {
  try {
    almacen?.setItem(CLAVE, JSON.stringify({ turno, dia: dia(ahora) } satisfies Recordado));
  } catch {
    // Sin almacenamiento (modo privado, por ejemplo): la próxima vez decide la hora.
  }
}

const dia = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

function guardado(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
