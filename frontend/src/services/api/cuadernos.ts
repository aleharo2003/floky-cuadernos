import type { Cambio, Categoria, FiltrosMovimientos, MedioPago, Movimiento, MovimientoNuevo, RangoFechas, TipoMovimiento } from '../../types';
import type { CuadernosService } from '../contratos';
import { BASE_API, pedir } from '../http';

/* La API habla en inglés y con importes en texto ("45000.50"); las pantallas, en español y con números. */

type Kind = 'income' | 'expense';
const aTipo = (k: Kind): TipoMovimiento => (k === 'income' ? 'ingreso' : 'egreso');
const aKind = (t: TipoMovimiento): Kind => (t === 'ingreso' ? 'income' : 'expense');

interface EntryApi {
  id: string;
  date: string;
  kind: Kind;
  category_id: string;
  category_name: string;
  description: string;
  amount: string;
  payment_method: MedioPago;
  is_voided: boolean;
  void_reason: string;
  created_by: string;
}

interface ChangeApi {
  id: string;
  at: string;
  who: string;
  action: 'entry.create' | 'entry.correct' | 'entry.void';
  entity_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string;
}

const ACCION: Record<ChangeApi['action'], Cambio['accion']> = {
  'entry.create': 'Alta',
  'entry.correct': 'Corrección',
  'entry.void': 'Anulación',
};

const aMovimiento = (e: EntryApi): Movimiento => ({
  id: e.id,
  fecha: e.date,
  tipo: aTipo(e.kind),
  categoriaId: e.category_id,
  categoria: e.category_name,
  descripcion: e.description,
  monto: Number(e.amount),
  medioPago: e.payment_method,
  anulado: e.is_voided,
  motivoAnulacion: e.void_reason,
  cargadoPor: e.created_by,
});

const aCambio = (c: ChangeApi): Cambio => ({
  id: c.id,
  fecha: c.at,
  usuario: c.who,
  accion: ACCION[c.action],
  movimientoId: c.entity_id,
  antes: c.before,
  despues: c.after,
  motivo: c.reason,
});

const cuerpo = (m: MovimientoNuevo) => ({
  date: m.fecha,
  kind: aKind(m.tipo),
  category_id: m.categoriaId,
  description: m.descripcion,
  // El importe viaja como texto con dos decimales: nunca como número con coma flotante.
  amount: m.monto.toFixed(2),
  payment_method: m.medioPago,
});

/** Período y filtros a query string. Lo vacío no viaja. */
function consulta(r: RangoFechas, f: FiltrosMovimientos): string {
  const q = new URLSearchParams({ from: r.desde, to: r.hasta });
  if (f.tipo) q.set('kind', aKind(f.tipo));
  if (f.categoriaId) q.set('category_id', f.categoriaId);
  if (f.medioPago) q.set('payment_method', f.medioPago);
  if (f.texto.trim()) q.set('q', f.texto.trim());
  if (f.verAnulados) q.set('voided', '1');
  return q.toString();
}

export const cuadernosApi: CuadernosService = {
  async categorias() {
    const lista = await pedir<{ id: string; name: string; kind: Kind }[]>('GET', '/notebooks/categories/');
    const porTipo: Record<TipoMovimiento, Categoria[]> = { ingreso: [], egreso: [] };
    for (const c of lista) porTipo[aTipo(c.kind)].push({ id: c.id, nombre: c.name, tipo: aTipo(c.kind) });
    return porTipo;
  },

  async movimientos(rango, filtros) {
    return (await pedir<EntryApi[]>('GET', `/notebooks/entries/?${consulta(rango, filtros)}`)).map(aMovimiento);
  },

  async resumen(rango, filtros) {
    const r = await pedir<{
      income: string;
      expense: string;
      balance: string;
      by_category: { category: string; kind: Kind; total: string; count: number }[];
    }>('GET', `/notebooks/summary/?${consulta(rango, filtros)}`);
    return {
      ingresos: Number(r.income),
      egresos: Number(r.expense),
      saldo: Number(r.balance),
      porCategoria: r.by_category.map((c) => ({ categoria: c.category, tipo: aTipo(c.kind), monto: Number(c.total), movimientos: c.count })),
    };
  },

  async anual(anio) {
    const r = await pedir<{ months: { month: number; income: string; expense: string; balance: string }[] }>(
      'GET',
      `/notebooks/monthly/?year=${anio}`,
    );
    return r.months.map((m) => ({ mes: m.month, ingresos: Number(m.income), egresos: Number(m.expense), saldo: Number(m.balance) }));
  },

  urlExcel(rango, filtros) {
    return `${BASE_API}/notebooks/export/?${consulta(rango, filtros)}`;
  },

  async crear(movimiento, clave) {
    return aMovimiento(await pedir<EntryApi>('POST', '/notebooks/entries/', cuerpo(movimiento), { 'Idempotency-Key': clave }));
  },

  async corregir(id, movimiento, motivo) {
    return aMovimiento(await pedir<EntryApi>('PUT', `/notebooks/entries/${id}/`, { ...cuerpo(movimiento), reason: motivo }));
  },

  async anular(id, motivo) {
    return aMovimiento(await pedir<EntryApi>('POST', `/notebooks/entries/${id}/void/`, { reason: motivo }));
  },

  async historial(id) {
    return (await pedir<ChangeApi[]>('GET', `/notebooks/entries/${id}/history/`)).map(aCambio);
  },

  async cambiosRecientes() {
    return (await pedir<ChangeApi[]>('GET', '/notebooks/changes/')).map(aCambio);
  },
};
