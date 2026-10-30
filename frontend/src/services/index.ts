/**
 * Único punto donde se elige la implementación de cada servicio. Cuando un servicio pasa de
 * memoria a la API se cambia acá y las pantallas no se tocan.
 */
import { cuadernosApi } from './api/cuadernos';
import { sesionApi } from './api/sesion';
import type { Servicios } from './contratos';

export const servicios: Servicios = {
  sesion: sesionApi,
  cuadernos: cuadernosApi,
};
