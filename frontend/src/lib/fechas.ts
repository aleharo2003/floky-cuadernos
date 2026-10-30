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

/** Los atajos de un toque de los filtros de fechas. Las fechas se pueden ajustar a mano después. */
export const periodosRapidos = (): PeriodoRapido[] => [
  { etiqueta: 'Hoy', rango: rangoHoy() },
  { etiqueta: 'Esta semana', rango: rangoEstaSemana() },
  { etiqueta: 'Este mes', rango: rangoEsteMes() },
];

export const rangoValido = (r: RangoFechas): boolean => !!r.desde && !!r.hasta && r.desde <= r.hasta;

/** Si una fecha ISO con hora cae dentro del rango de días (los dos incluidos), en hora local. */
export const enRango = (iso: string, r: RangoFechas): boolean => {
  const dia = fechaIso(new Date(iso));
  return dia >= r.desde && dia <= r.hasta;
};
