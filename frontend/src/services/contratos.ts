import type { EventoAuditoria, Movimiento, MovimientoNuevo, RangoFechas, ResumenCuadernos, TipoMovimiento } from '../types';

/**
 * Lo que las pantallas le piden a los cuadernos. Hoy lo cumple una implementación en memoria;
 * cuando esté la API se cambia en `services/index.ts` y las pantallas no se tocan.
 */
export interface CuadernosService {
  categorias(): Promise<Record<TipoMovimiento, string[]>>;
  movimientos(rango: RangoFechas): Promise<Movimiento[]>;
  resumen(rango: RangoFechas): Promise<ResumenCuadernos>;
  crear(movimiento: MovimientoNuevo): Promise<Movimiento>;
  editar(id: string, movimiento: MovimientoNuevo): Promise<Movimiento>;
  /** Se reemplaza por anular con motivo en HU-026. */
  borrar(id: string): Promise<void>;
  auditoria(): Promise<EventoAuditoria[]>;
}

export interface Servicios {
  cuadernos: CuadernosService;
}
