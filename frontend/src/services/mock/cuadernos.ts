/**
 * Cuadernos en memoria, para trabajar en el front sin backend. Se reinician al recargar.
 * Datos inventados. Se reemplaza por la API real en services/index.ts.
 */
import { diaLegible, fechaIso, pesos, redondear } from '../../lib/formato';
import type { EventoAuditoria, MedioPago, Movimiento, MovimientoNuevo, RangoFechas, TipoMovimiento } from '../../types';
import type { CuadernosService } from '../contratos';

const MEDIOS: MedioPago[] = ['Efectivo', 'Débito', 'Crédito', 'QR', 'Transferencia'];

const CATEGORIAS: Record<TipoMovimiento, string[]> = {
  ingreso: ['Ventas', 'Otros ingresos'],
  egreso: ['Proveedores', 'Sueldos', 'Servicios', 'Alquiler', 'Impuestos', 'Otros gastos'],
};

let ultimoId = 0;
const nuevoId = (prefijo: string) => `${prefijo}-${++ultimoId}`;
const copia = <T,>(dato: T): T => structuredClone(dato);

const movimientos: Movimiento[] = [];
const auditoria: EventoAuditoria[] = [];

// Ejemplos de este mes: solo días que ya pasaron.
const hoy = new Date();
const ejemplos: [number, TipoMovimiento, string, string, number, MedioPago][] = [
  [1, 'egreso', 'Alquiler', 'Alquiler del mes', 500000, 'Transferencia'],
  [2, 'ingreso', 'Ventas', 'Ventas del día', 320000, 'Efectivo'],
  [2, 'egreso', 'Proveedores', 'Verdulería', 45000, 'Efectivo'],
  [3, 'ingreso', 'Ventas', 'Ventas del día', 280000, 'Efectivo'],
  [3, 'egreso', 'Servicios', 'Luz', 95000, 'Débito'],
  [4, 'egreso', 'Sueldos', 'Adelanto', 60000, 'Efectivo'],
];
for (const [dia, tipo, categoria, descripcion, monto, medioPago] of ejemplos) {
  if (dia > hoy.getDate()) continue;
  const fecha = fechaIso(new Date(hoy.getFullYear(), hoy.getMonth(), dia));
  movimientos.push({ id: nuevoId('mov'), fecha, tipo, categoria, descripcion, monto, medioPago });
}

function validar(m: MovimientoNuevo): MovimientoNuevo {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.fecha)) throw new Error('Falta la fecha del movimiento.');
  if (m.tipo !== 'ingreso' && m.tipo !== 'egreso') throw new Error('Elegí si es un ingreso o un gasto.');
  if (!CATEGORIAS[m.tipo].includes(m.categoria)) throw new Error('Elegí una categoría.');
  if (!(m.monto > 0)) throw new Error('El monto tiene que ser mayor que cero.');
  if (!MEDIOS.includes(m.medioPago)) throw new Error('Elegí el medio de pago.');
  return { ...m, descripcion: m.descripcion.trim(), monto: redondear(m.monto) };
}

const describir = (m: MovimientoNuevo) =>
  `${m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} del ${diaLegible(m.fecha)}, ${m.categoria}${
    m.descripcion ? ` (${m.descripcion})` : ''
  }, ${pesos(m.monto)}, ${m.medioPago}`;

function auditar(accion: EventoAuditoria['accion'], detalle: string) {
  auditoria.push({ id: nuevoId('aud'), fecha: new Date().toISOString(), usuario: 'Usuario de prueba', accion, detalle });
}

function buscar(id: string): Movimiento {
  const m = movimientos.find((x) => x.id === id);
  if (!m) throw new Error('No encontramos ese movimiento.');
  return m;
}

const delRango = ({ desde, hasta }: RangoFechas) =>
  movimientos
    .filter((m) => m.fecha >= desde && m.fecha <= hasta)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));

export const cuadernosEnMemoria: CuadernosService = {
  async categorias() {
    return copia(CATEGORIAS);
  },

  async movimientos(rango) {
    return copia(delRango(rango));
  },

  async resumen(rango) {
    const lista = delRango(rango);
    const total = (tipo: TipoMovimiento) => redondear(lista.filter((m) => m.tipo === tipo).reduce((s, m) => s + m.monto, 0));
    const grupos = new Map<string, { categoria: string; tipo: TipoMovimiento; monto: number; movimientos: number }>();
    for (const m of lista) {
      const clave = `${m.tipo}|${m.categoria}`;
      const g = grupos.get(clave) ?? { categoria: m.categoria, tipo: m.tipo, monto: 0, movimientos: 0 };
      grupos.set(clave, { ...g, monto: redondear(g.monto + m.monto), movimientos: g.movimientos + 1 });
    }
    const ingresos = total('ingreso');
    const egresos = total('egreso');
    return {
      ingresos,
      egresos,
      saldo: redondear(ingresos - egresos),
      porCategoria: [...grupos.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || b.monto - a.monto),
    };
  },

  async crear(movimiento) {
    const nuevo = { id: nuevoId('mov'), ...validar(movimiento) };
    movimientos.push(nuevo);
    auditar('Alta', describir(nuevo));
    return copia(nuevo);
  },

  async editar(id, movimiento) {
    const actual = buscar(id);
    const antes = describir(actual);
    Object.assign(actual, validar(movimiento));
    auditar('Edición', `Antes: ${antes}. Después: ${describir(actual)}`);
    return copia(actual);
  },

  async borrar(id) {
    const actual = buscar(id);
    movimientos.splice(movimientos.indexOf(actual), 1);
    auditar('Borrado', describir(actual));
  },

  async auditoria() {
    return copia([...auditoria].reverse());
  },
};
