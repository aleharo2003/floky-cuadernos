import { useEffect, useState } from 'react';
import { NOMBRE_MEDIO, SIN_FILTROS, type Categoria, type FiltrosMovimientos as Filtros, type MedioPago, type TipoMovimiento } from '../types';
import Button from './Button';

const MEDIOS = Object.keys(NOMBRE_MEDIO) as MedioPago[];

interface Props {
  valor: Filtros;
  onChange(filtros: Filtros): void;
  categorias: Record<TipoMovimiento, Categoria[]>;
}

/** Cuántos filtros hay puestos, para avisarlo cuando el panel está cerrado. */
export const filtrosActivos = (f: Filtros): number =>
  [f.tipo, f.categoriaId, f.medioPago, f.texto.trim(), f.verAnulados].filter(Boolean).length;

/**
 * Tipo, categoría, medio, texto y anulados (HU-028).
 * En celular arranca cerrado para no tapar los totales; en la computadora, abierto.
 */
export default function FiltrosMovimientos({ valor, onChange, categorias }: Props) {
  const [abierto, setAbierto] = useState(() => window.matchMedia('(min-width: 701px)').matches);
  useEffect(() => {
    if (filtrosActivos(valor)) setAbierto(true);
    // Solo al montar: si vuelve con filtros puestos, que se vean.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cambiar = (parte: Partial<Filtros>) => onChange({ ...valor, ...parte });
  const lista = valor.tipo ? categorias[valor.tipo] : [...categorias.ingreso, ...categorias.egreso];
  const activos = filtrosActivos(valor);

  return (
    <details
      className="tarjeta filtros-panel no-imprimir"
      open={abierto}
      onToggle={(e) => setAbierto((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>
        Filtros{activos > 0 && <span className="filtros-cuenta">{activos} {activos === 1 ? 'activo' : 'activos'}</span>}
      </summary>
      <div className="filtros">
        <label className="campo">
          <span>Tipo</span>
          <select
            value={valor.tipo}
            onChange={(e) => {
              const tipo = e.target.value as Filtros['tipo'];
              // Una categoría de gastos no tiene sentido filtrando ingresos.
              const sigue = !tipo || categorias[tipo].some((c) => c.id === valor.categoriaId);
              cambiar({ tipo, categoriaId: sigue ? valor.categoriaId : '' });
            }}
          >
            <option value="">Todos</option>
            <option value="ingreso">Ingresos</option>
            <option value="egreso">Gastos</option>
          </select>
        </label>
        <label className="campo">
          <span>Categoría</span>
          <select value={valor.categoriaId} onChange={(e) => cambiar({ categoriaId: e.target.value })}>
            <option value="">Todas</option>
            {lista.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {valor.tipo ? '' : c.tipo === 'ingreso' ? ' (ingreso)' : ' (gasto)'}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Medio de pago</span>
          <select value={valor.medioPago} onChange={(e) => cambiar({ medioPago: e.target.value as Filtros['medioPago'] })}>
            <option value="">Todos</option>
            {MEDIOS.map((m) => (
              <option key={m} value={m}>
                {NOMBRE_MEDIO[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Buscar</span>
          <input
            className="campo-texto"
            type="search"
            maxLength={60}
            value={valor.texto}
            placeholder="Descripción o categoría"
            onChange={(e) => cambiar({ texto: e.target.value })}
          />
        </label>
        <label className="casilla">
          <input type="checkbox" checked={valor.verAnulados} onChange={(e) => cambiar({ verAnulados: e.target.checked })} />
          Ver anulados
        </label>
        {activos > 0 && (
          <Button variante="texto" onClick={() => onChange(SIN_FILTROS)}>
            Quitar filtros
          </Button>
        )}
      </div>
    </details>
  );
}

/** Los filtros en palabras, para el encabezado impreso. */
export function describirFiltros(f: Filtros, categorias: Record<TipoMovimiento, Categoria[]>): string {
  const partes: string[] = [];
  if (f.tipo) partes.push(f.tipo === 'ingreso' ? 'solo ingresos' : 'solo gastos');
  if (f.categoriaId) {
    const c = [...categorias.ingreso, ...categorias.egreso].find((x) => x.id === f.categoriaId);
    if (c) partes.push(`categoría ${c.nombre}`);
  }
  if (f.medioPago) partes.push(`medio ${NOMBRE_MEDIO[f.medioPago]}`);
  if (f.texto.trim()) partes.push(`texto "${f.texto.trim()}"`);
  if (f.verAnulados) partes.push('con anulados (no suman)');
  return partes.join(', ') || 'Ninguno';
}
