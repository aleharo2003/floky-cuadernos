/**
 * Único punto donde se elige la implementación de cada servicio. Hoy es la de memoria;
 * cuando esté la API se reemplaza acá y las pantallas no cambian.
 */
import type { Servicios } from './contratos';
import { cuadernosEnMemoria } from './mock/cuadernos';

export const servicios: Servicios = {
  cuadernos: cuadernosEnMemoria,
};
