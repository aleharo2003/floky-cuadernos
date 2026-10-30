/** Tipos de los cuadernos. Los nombres siguen la demo; ver la deuda de idioma en el README del front. */

export interface RangoFechas {
  /** aaaa-mm-dd */
  desde: string;
  /** aaaa-mm-dd */
  hasta: string;
}

export type TipoMovimiento = 'ingreso' | 'egreso';
export type MedioPago = 'Efectivo' | 'Débito' | 'Crédito' | 'QR' | 'Transferencia';

export interface Movimiento {
  id: string;
  /** aaaa-mm-dd */
  fecha: string;
  tipo: TipoMovimiento;
  categoria: string;
  descripcion: string;
  monto: number;
  medioPago: MedioPago;
}

export type MovimientoNuevo = Omit<Movimiento, 'id'>;

export interface ResumenCuadernos {
  ingresos: number;
  egresos: number;
  saldo: number;
  porCategoria: { categoria: string; tipo: TipoMovimiento; monto: number; movimientos: number }[];
}

export interface EventoAuditoria {
  id: string;
  fecha: string;
  usuario: string;
  accion: 'Alta' | 'Edición' | 'Borrado';
  detalle: string;
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
