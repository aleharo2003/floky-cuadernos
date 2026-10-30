/**
 * Único punto donde se elige la implementación de cada servicio. Cuando un servicio pasa de
 * memoria a la API se cambia acá y las pantallas no se tocan.
 */
import { sesionApi } from './api/sesion';
import type { Servicios } from './contratos';
import { cuadernosEnMemoria } from './mock/cuadernos';

export const servicios: Servicios = {
  sesion: sesionApi,
  // Los cuadernos siguen en memoria hasta que exista su API (HU-021).
  cuadernos: cuadernosEnMemoria,
};
