import type { RangoFechas } from '../types';
import { fechaIso } from './formato';

export interface PeriodoRapido {
  etiqueta: string;
  rango: RangoFechas;
}

const haceDias = (n: number) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - n);
};

export const rangoHoy = (): RangoFechas => ({ desde: fechaIso(new Date()), hasta: fechaIso(new Date()) });

/** La semana arranca el lunes. */
export const rangoEstaSemana = (): RangoFechas => ({
  desde: fechaIso(haceDias((new Date().getDay() + 6) % 7)),
  hasta: fechaIso(new Date()),
});

export const rangoEsteMes = (): RangoFechas => {
  const hoy = new Date();
  return { desde: fechaIso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: fechaIso(hoy) };
};

/** El mes calendario anterior completo, para comparar con el actual. */
export const rangoMesPasado = (): RangoFechas => {
  const hoy = new Date();
  return {
    desde: fechaIso(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
    hasta: fechaIso(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
  };
};

/** Del primero al último día de un mes (1 a 12). */
export const rangoDelMes = (anio: number, mes: number): RangoFechas => ({
  desde: fechaIso(new Date(anio, mes - 1, 1)),
  hasta: fechaIso(new Date(anio, mes, 0)),
});

/** Los atajos de un toque de los filtros de fechas. Las fechas se pueden ajustar a mano después. */
export const periodosRapidos = (): PeriodoRapido[] => [
  { etiqueta: 'Hoy', rango: rangoHoy() },
  { etiqueta: 'Esta semana', rango: rangoEstaSemana() },
  { etiqueta: 'Este mes', rango: rangoEsteMes() },
  { etiqueta: 'Mes pasado', rango: rangoMesPasado() },
];

export const rangoValido = (r: RangoFechas): boolean => !!r.desde && !!r.hasta && r.desde <= r.hasta;

/** Si una fecha ISO con hora cae dentro del rango de días (los dos incluidos), en hora local. */
export const enRango = (iso: string, r: RangoFechas): boolean => {
  const dia = fechaIso(new Date(iso));
  return dia >= r.desde && dia <= r.hasta;
};
