/** Redondeo a centavos. Toda cuenta de plata pasa por acá antes de guardarse o mostrarse. */
export const redondear = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const numero = (n: number, decimales: number): string =>
  n.toLocaleString('es-AR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    useGrouping: 'always',
  } as Intl.NumberFormatOptions);

/** $ 12.345,67 */
export function pesos(n: number): string {
  return `${n < 0 ? '-' : ''}$ ${numero(Math.abs(n), 2)}`;
}

/** $ 12.346, para cifras grandes de indicadores, donde los centavos son ruido. */
export function pesosEnteros(n: number): string {
  return `${n < 0 ? '-' : ''}$ ${numero(Math.abs(Math.round(n)), 0)}`;
}

/** Para ejes de gráficos: $ 1,2 M, $ 350 mil. */
export function pesosCorto(n: number): string {
  const abs = Math.abs(n);
  const signo = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${signo}$ ${numero(abs / 1_000_000, 1)} M`;
  if (abs >= 1_000) return `${signo}$ ${numero(abs / 1_000, 0)} mil`;
  return `${signo}$ ${numero(abs, 0)}`;
}

export const entero = (n: number): string => numero(n, 0);

const dos = (n: number): string => String(n).padStart(2, '0');

/** dd/mm/aaaa */
export function fecha(iso: string | Date): string {
  const d = new Date(iso);
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** aaaa-mm-dd en hora local, que es como se guardan y se comparan los días. */
export function fechaIso(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** De aaaa-mm-dd a dd/mm/aaaa, sin pasar por Date (que lo correría un día por la zona horaria). */
export function diaLegible(dia: string): string {
  const [a, m, d] = dia.split('-');
  return `${d}/${m}/${a}`;
}

/** hh:mm */
export function hora(iso: string | Date): string {
  const d = new Date(iso);
  return `${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export const fechaHora = (iso: string | Date): string => `${fecha(iso)} ${hora(iso)}`;

/** Acepta "12.345,67", "12345,67" o "12345.67" tal como lo tipea la gente. */
export function leerMonto(texto: string): number {
  const limpio = texto.trim().replace(/\s|\$/g, '');
  if (!limpio) return 0;
  const normal = limpio.includes(',') ? limpio.replace(/\./g, '').replace(',', '.') : limpio;
  const n = Number(normal);
  return Number.isFinite(n) ? redondear(n) : 0;
}

/** 0003-00001234 */
export function numeroComprobante(puntoVenta: number, numero: number): string {
  return `${String(puntoVenta).padStart(4, '0')}-${String(numero).padStart(8, '0')}`;
}
