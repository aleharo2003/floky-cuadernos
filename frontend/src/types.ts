/** Tipos de los cuadernos. Los nombres siguen la demo; ver la deuda de idioma en el README del front. */

export interface RangoFechas {
  /** aaaa-mm-dd */
  desde: string;
  /** aaaa-mm-dd */
  hasta: string;
}

export type TipoMovimiento = 'ingreso' | 'egreso';
/** Los códigos son los de la API. Lo que ve la persona sale de NOMBRE_MEDIO. */
export type MedioPago = 'cash' | 'debit' | 'credit' | 'qr' | 'transfer';

export const NOMBRE_MEDIO: Record<MedioPago, string> = {
  cash: 'Efectivo',
  debit: 'Débito',
  credit: 'Crédito',
  qr: 'QR / Mercado Pago',
  transfer: 'Transferencia',
};

/** La caja se cierra dos veces por día (P-01). El turno noche que termina después de medianoche
 * conserva la fecha en que empezó. */
export type Turno = 'morning' | 'night';

export const NOMBRE_TURNO: Record<Turno, string> = { morning: 'Mañana', night: 'Noche' };

export interface Categoria {
  id: string;
  nombre: string;
  tipo: TipoMovimiento;
}

export interface Movimiento {
  id: string;
  /** aaaa-mm-dd */
  fecha: string;
  tipo: TipoMovimiento;
  categoriaId: string;
  categoria: string;
  descripcion: string;
  monto: number;
  medioPago: MedioPago;
  turno: Turno;
  anulado: boolean;
  motivoAnulacion: string;
  cargadoPor: string;
  /** Gasto con débito: la venta que se sumó con él (ADR-0010). */
  ventaDelDebitoId: string | null;
  /** Venta que sale de un gasto con débito: solo se corrige o anula desde ese gasto. */
  gastoConDebitoId: string | null;
}

export interface MovimientoNuevo {
  fecha: string;
  tipo: TipoMovimiento;
  categoriaId: string;
  descripcion: string;
  monto: number;
  medioPago: MedioPago;
  turno: Turno;
  /** Solo en un gasto con débito sin venta: sumar también la venta con débito, como en el cuaderno. */
  sumarAVenta?: boolean;
}

export interface ResumenCuadernos {
  ingresos: number;
  egresos: number;
  saldo: number;
  porCategoria: { categoria: string; tipo: TipoMovimiento; monto: number; movimientos: number }[];
}

/** Lo que se puede filtrar además del período (HU-028). Lo vacío no filtra. */
export interface FiltrosMovimientos {
  tipo: TipoMovimiento | '';
  categoriaId: string;
  medioPago: MedioPago | '';
  texto: string;
  verAnulados: boolean;
}

export const SIN_FILTROS: FiltrosMovimientos = { tipo: '', categoriaId: '', medioPago: '', texto: '', verAnulados: false };

/** Un mes del reporte anual (HU-023). */
export interface MesDelAnio {
  /** 1 a 12 */
  mes: number;
  ingresos: number;
  egresos: number;
  saldo: number;
}

/** El último haber anotado en papel: la caja arranca de ahí (P-01). */
export interface HaberInicial {
  fecha: string;
  turno: Turno;
  monto: number;
  cargadoPor: string;
  cargadoEl: string;
}

/** Un cierre de caja, como en el cuaderno (ADR-0008). */
export interface CierreCaja {
  fecha: string;
  turno: Turno;
  /** Todo lo vendido, con cualquier medio de pago. */
  ventas: number;
  /** Mercado Pago, tarjetas y transferencias: se vendió, pero no está en la caja. */
  sinEfectivo: number;
  gastosEfectivo: number;
  /** Pagados por transferencia o tarjeta: son gasto, pero la caja no se movió. */
  gastosSinEfectivo: number;
  antes: number;
  despues: number;
  negativo: boolean;
}

export interface Caja {
  inicial: HaberInicial | null;
  cierres: CierreCaja[];
  /** El haber al terminar el período en pantalla. null si el período es anterior al haber inicial. */
  haberAlFinal: number | null;
}

/** Un cambio de un movimiento, tal como lo guarda la auditoría. */
export interface Cambio {
  id: string;
  fecha: string;
  usuario: string;
  accion: 'Alta' | 'Corrección' | 'Anulación';
  movimientoId: string;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  motivo: string;
}

export type Rol = 'owner' | 'editor' | 'viewer';
export type Permiso =
  | 'notebooks.view'
  | 'notebooks.export'
  | 'notebooks.add_entry'
  | 'notebooks.change_entry'
  | 'notebooks.void_entry'
  | 'notebooks.manage_categories'
  | 'notebooks.set_cash_opening';

export interface LocalDisponible {
  id: string;
  name: string;
  role: Rol;
}

export interface LocalActivo extends LocalDisponible {
  permissions: Permiso[];
}

/** Lo que devuelve /api/auth/session/: quién entró, a qué locales puede ir y en cuál está. */
export interface Sesion {
  user: { id: number; username: string; name: string } | null;
  tenants: LocalDisponible[];
  active_tenant: LocalActivo | null;
}
