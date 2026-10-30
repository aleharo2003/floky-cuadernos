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
  anulado: boolean;
  motivoAnulacion: string;
  cargadoPor: string;
}

export interface MovimientoNuevo {
  fecha: string;
  tipo: TipoMovimiento;
  categoriaId: string;
  descripcion: string;
  monto: number;
  medioPago: MedioPago;
}

export interface ResumenCuadernos {
  ingresos: number;
  egresos: number;
  saldo: number;
  porCategoria: { categoria: string; tipo: TipoMovimiento; monto: number; movimientos: number }[];
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
  | 'notebooks.manage_categories';

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
