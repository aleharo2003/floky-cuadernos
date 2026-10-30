import type { Cambio, Categoria, Movimiento, MovimientoNuevo, RangoFechas, ResumenCuadernos, Sesion, TipoMovimiento } from '../types';

/** Ingreso, salida y local activo. Cada método devuelve la sesión como quedó. */
export interface SesionService {
  actual(): Promise<Sesion>;
  ingresar(usuario: string, clave: string): Promise<Sesion>;
  salir(): Promise<Sesion>;
  elegirLocal(id: string): Promise<Sesion>;
}

/** Lo que las pantallas le piden a los cuadernos del local activo. */
export interface CuadernosService {
  categorias(): Promise<Record<TipoMovimiento, Categoria[]>>;
  movimientos(rango: RangoFechas): Promise<Movimiento[]>;
  resumen(rango: RangoFechas): Promise<ResumenCuadernos>;
  /** La misma clave dos veces guarda un solo movimiento (doble toque, reintento de red). */
  crear(movimiento: MovimientoNuevo, clave: string): Promise<Movimiento>;
  corregir(id: string, movimiento: MovimientoNuevo, motivo: string): Promise<Movimiento>;
  anular(id: string, motivo: string): Promise<Movimiento>;
  historial(id: string): Promise<Cambio[]>;
  cambiosRecientes(): Promise<Cambio[]>;
}

export interface Servicios {
  sesion: SesionService;
  cuadernos: CuadernosService;
}
