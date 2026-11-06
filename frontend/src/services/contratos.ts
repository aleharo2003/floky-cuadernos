import type {
  AjustesLocal,
  Caja,
  Cambio,
  Categoria,
  FiltrosMovimientos,
  MesDelAnio,
  Movimiento,
  MovimientoNuevo,
  PaginaMovimientos,
  RangoFechas,
  ResumenCuadernos,
  Sesion,
  TipoMovimiento,
  Turno,
} from '../types';

/** Ingreso, salida y local activo. Cada método devuelve la sesión como quedó. */
export interface SesionService {
  actual(): Promise<Sesion>;
  ingresar(usuario: string, clave: string): Promise<Sesion>;
  salir(): Promise<Sesion>;
  elegirLocal(id: string): Promise<Sesion>;
  /** Cambia la contraseña propia. Este dispositivo sigue adentro; los demás se cierran. */
  cambiarClave(actual: string, nueva: string): Promise<void>;
}

/** Lo que las pantallas le piden a los cuadernos del local activo. */
export interface CuadernosService {
  categorias(): Promise<Record<TipoMovimiento, Categoria[]>>;
  /** Solo el dueño. Si existía desactivada con el mismo nombre, vuelve en lugar de duplicarse. */
  crearCategoria(nombre: string, tipo: TipoMovimiento): Promise<Categoria>;
  /** La lista, el resumen y el Excel usan los mismos filtros: nunca muestran cosas distintas. */
  /** Los movimientos de a partes: los primeros `cuantos` y el total del período (la API pagina). */
  movimientos(rango: RangoFechas, filtros: FiltrosMovimientos, cuantos?: number): Promise<PaginaMovimientos>;
  /** Los anulados nunca suman, aunque se pida verlos en la lista. */
  resumen(rango: RangoFechas, filtros: FiltrosMovimientos): Promise<ResumenCuadernos>;
  /** Los doce meses del año, con ingresos, gastos y saldo de cada uno. */
  anual(anio: number): Promise<MesDelAnio[]>;
  /** La caja por turno en el período. No sigue los filtros: es la caja entera. */
  caja(rango: RangoFechas): Promise<Caja>;
  /** Solo el dueño. Cambiarlo pide motivo, porque mueve todos los haberes siguientes. */
  cargarHaberInicial(fecha: string, turno: Turno, monto: number, motivo: string): Promise<void>;
  /** Descripciones ya usadas en el local para ese tipo, para sugerirlas al cargar (HU-030). */
  descripciones(tipo: TipoMovimiento, texto: string): Promise<string[]>;
  /** Lo ve todo el que entra al local: la carga lo necesita para saber cuándo proponer la venta. */
  ajustes(): Promise<AjustesLocal>;
  /** Solo el dueño. Vale para lo que se cargue o corrija después; lo ya cargado queda igual. */
  guardarAjustes(ajustes: AjustesLocal): Promise<AjustesLocal>;
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
