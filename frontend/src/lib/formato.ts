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

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** De aaaa-mm-dd a "martes 3/11". Se arma la fecha a mediodía para que la zona horaria no la corra de día. */
export function diaConNombre(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number);
  const f = new Date(a, m - 1, d, 12);
  return `${DIAS[f.getDay()]} ${d}/${m}`;
}

/** hh:mm */
export function hora(iso: string | Date): string {
  const d = new Date(iso);
  return `${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export const fechaHora = (iso: string | Date): string => `${fecha(iso)} ${hora(iso)}`;

/**
 * Lee un importe como lo tipea la gente en Argentina: "12.345,67", "12345,67", "45.000", "1.300.000"
 * o "12345.67". Sin coma, los puntos en grupos de tres son miles ("45.000" son cuarenta y cinco mil).
 * Si no se entiende devuelve NaN, nunca un 0 inventado: quien llama decide qué decirle a la persona.
 */
export function leerMonto(texto: string): number {
  const normal = normalizarMonto(texto);
  return normal === null ? NaN : redondear(Number(normal));
}

/** "12.345,67" a "12345.67". null si no se entiende. */
function normalizarMonto(texto: string): string | null {
  const limpio = texto.trim().replace(/\s|\$/g, '');
  if (!limpio) return null;
  let normal: string;
  if (limpio.includes(',')) {
    if ((limpio.match(/,/g) ?? []).length > 1) return null;
    normal = limpio.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) {
    normal = limpio.replace(/\./g, '');
  } else {
    normal = limpio;
  }
  return /^\d+(\.\d+)?$/.test(normal) ? normal : null;
}

/**
 * El monto como se va escribiendo, con los puntos de miles puestos solos: "45000" queda "45.000" y
 * "1234567,5" queda "1.234.567,5". Los puntos que traiga se ignoran (los pone el campo) y la primera
 * coma separa los decimales. No corta ni redondea decimales: si sobran, avisa problemaDeMonto.
 */
export function montoMientrasSeEscribe(texto: string): string {
  const coma = texto.indexOf(',');
  const entera = (coma === -1 ? texto : texto.slice(0, coma)).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const conPuntos = entera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (coma === -1) return conPuntos;
  return `${conPuntos || '0'},${texto.slice(coma + 1).replace(/\D/g, '')}`;
}

/** Dónde dejar el cursor después de poner los puntos: detrás de las mismas cifras que tenía antes. */
export function cursorDespuesDeFormatear(antes: string, cursor: number, despues: string): number {
  if (cursor >= antes.length) return despues.length;
  const cifras = antes.slice(0, cursor).replace(/[^\d,]/g, '').length;
  let vistas = 0;
  for (let i = 0; i < despues.length && vistas < cifras; i++) {
    if (/[\d,]/.test(despues[i])) vistas++;
    if (vistas === cifras) return i + 1;
  }
  return cifras === 0 ? 0 : despues.length;
}

/**
 * Un monto pegado de otro lado ("12345.67", "$ 45.000,50") en el formato del campo, o null si no se
 * entiende. Tampoco redondea: "10,999" queda "10,999" y el aviso lo da problemaDeMonto.
 */
export function montoPegado(texto: string): string | null {
  const normal = normalizarMonto(texto);
  return normal === null ? null : montoMientrasSeEscribe(normal.replace('.', ','));
}

/** El mayor importe que guarda la base: 12 cifras enteras y 2 decimales. */
const MONTO_MAXIMO = 999_999_999_999.99;

/**
 * Qué decirle a la persona si el monto no se puede guardar tal cual, o null si está bien.
 * Nunca se redondea en silencio: 10,999 no se convierte en 11,00 sin avisar.
 */
export function problemaDeMonto(texto: string, { permitirCero = false } = {}): string | null {
  const normal = normalizarMonto(texto);
  if (normal === null) return MONTO_ILEGIBLE;
  if ((normal.split('.')[1] ?? '').length > 2) return 'El monto puede tener hasta 2 decimales.';
  const n = Number(normal);
  if (n > MONTO_MAXIMO) return 'El monto es demasiado grande.';
  if (!permitirCero && n <= 0) return 'El monto tiene que ser mayor que cero.';
  return null;
}

/** El mensaje para un importe que no se pudo leer. */
export const MONTO_ILEGIBLE = 'Escribí el monto con números, por ejemplo 45.000 o 45.000,50.';

/** 0003-00001234 */
export function numeroComprobante(puntoVenta: number, numero: number): string {
  return `${String(puntoVenta).padStart(4, '0')}-${String(numero).padStart(8, '0')}`;
}
