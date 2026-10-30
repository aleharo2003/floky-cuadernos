import type {
  Cambio,
  Categoria,
  FiltrosMovimientos,
  MesDelAnio,
  Movimiento,
  MovimientoNuevo,
  RangoFechas,
  ResumenCuadernos,
  Sesion,
  TipoMovimiento,
} from '../types';

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
  /** La lista, el resumen y el Excel usan los mismos filtros: nunca muestran cosas distintas. */
  movimientos(rango: RangoFechas, filtros: FiltrosMovimientos): Promise<Movimiento[]>;
  /** Los anulados nunca suman, aunque se pida verlos en la lista. */
  resumen(rango: RangoFechas, filtros: FiltrosMovimientos): Promise<ResumenCuadernos>;
  /** Los doce meses del año, con ingresos, gastos y saldo de cada uno. */
  anual(anio: number): Promise<MesDelAnio[]>;
  /** Dirección del Excel del período y filtros en pantalla. Lo baja el navegador. */
  urlExcel(rango: RangoFechas, filtros: FiltrosMovimientos): string;
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
