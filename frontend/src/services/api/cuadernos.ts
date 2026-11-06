import type { AjustesLocal, Caja, Cambio, Categoria, FiltrosMovimientos, MedioPago, Movimiento, MovimientoNuevo, RangoFechas, TipoMovimiento, Turno } from '../../types';
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
  shift: Turno;
  is_voided: boolean;
  void_reason: string;
  created_by: string;
  sale_id: string | null;
  from_expense_id: string | null;
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
  turno: e.shift,
  anulado: e.is_voided,
  motivoAnulacion: e.void_reason,
  cargadoPor: e.created_by,
  ventaId: e.sale_id ?? null,
  deGastoId: e.from_expense_id ?? null,
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
  shift: m.turno,
});

interface CashApi {
  opening: { date: string; shift: Turno; amount: string; updated_by: string; updated_at: string } | null;
  haber_at_end: string | null;
  closes: {
    date: string;
    shift: Turno;
    sales: string;
    sales_not_cash: string;
    expenses_cash: string;
    expenses_not_cash: string;
    before: string;
    after: string;
    negative: boolean;
  }[];
}

const aCaja = (c: CashApi): Caja => ({
  inicial: c.opening && {
    fecha: c.opening.date,
    turno: c.opening.shift,
    monto: Number(c.opening.amount),
    cargadoPor: c.opening.updated_by,
    cargadoEl: c.opening.updated_at,
  },
  haberAlFinal: c.haber_at_end === null ? null : Number(c.haber_at_end),
  cierres: c.closes.map((x) => ({
    fecha: x.date,
    turno: x.shift,
    ventas: Number(x.sales),
    sinEfectivo: Number(x.sales_not_cash),
    gastosEfectivo: Number(x.expenses_cash),
    gastosSinEfectivo: Number(x.expenses_not_cash),
    antes: Number(x.before),
    despues: Number(x.after),
    negativo: x.negative,
  })),
});

const aAjustes = (r: { sale_methods: MedioPago[] }): AjustesLocal => ({ mediosQueSumanVenta: r.sale_methods });

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

  async crearCategoria(nombre, tipo) {
    const c = await pedir<{ id: string; name: string; kind: Kind }>('POST', '/notebooks/categories/', { name: nombre, kind: aKind(tipo) });
    return { id: c.id, nombre: c.name, tipo: aTipo(c.kind) };
  },

  async movimientos(rango, filtros, cuantos = 200) {
    const r = await pedir<{ count: number; results: EntryApi[] }>('GET', `/notebooks/entries/?${consulta(rango, filtros)}&limit=${cuantos}`);
    return { movimientos: r.results.map(aMovimiento), total: r.count };
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

  async caja(rango) {
    return aCaja(await pedir<CashApi>('GET', `/notebooks/cash/?from=${rango.desde}&to=${rango.hasta}`));
  },

  async cargarHaberInicial(fecha, turno, monto, motivo) {
    await pedir('PUT', '/notebooks/cash/opening/', { date: fecha, shift: turno, amount: monto.toFixed(2), reason: motivo });
  },

  async ajustes() {
    const r = await pedir<{ sale_methods: MedioPago[] }>('GET', '/notebooks/settings/');
    return aAjustes(r);
  },

  async guardarAjustes(ajustes: AjustesLocal) {
    const r = await pedir<{ sale_methods: MedioPago[] }>('PUT', '/notebooks/settings/', { sale_methods: ajustes.mediosQueSumanVenta });
    return aAjustes(r);
  },

  urlExcel(rango, filtros) {
    return `${BASE_API}/notebooks/export/?${consulta(rango, filtros)}`;
  },

  async crear(movimiento, clave) {
    const datos = { ...cuerpo(movimiento), add_sale: !!movimiento.sumarAVenta };
    return aMovimiento(await pedir<EntryApi>('POST', '/notebooks/entries/', datos, { 'Idempotency-Key': clave }));
  },

  async corregir(id, movimiento, motivo) {
    const datos = { ...cuerpo(movimiento), reason: motivo, add_sale: !!movimiento.sumarAVenta };
    return aMovimiento(await pedir<EntryApi>('PUT', `/notebooks/entries/${id}/`, datos));
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
