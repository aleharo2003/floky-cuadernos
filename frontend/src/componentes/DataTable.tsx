import type { ReactNode } from 'react';

export interface Columna<T> {
  titulo: string;
  render(fila: T): ReactNode;
  /** Los importes y cantidades van a la derecha, con números tabulares. */
  numerica?: boolean;
  /** Permite que el texto largo baje de renglón en vez de ensanchar la tabla. */
  flexible?: boolean;
}

interface Props<T> {
  columnas: Columna<T>[];
  filas: T[];
  clave(fila: T): string;
  /** Clave de la fila elegida con el teclado, si la tabla se recorre con las flechas. */
  seleccionada?: string;
  vacio?: string;
  pie?: ReactNode;
}

export default function DataTable<T>({
  columnas,
  filas,
  clave,
  seleccionada,
  vacio = 'No hay datos para mostrar.',
  pie,
}: Props<T>) {
  if (!filas.length) return <p className="vacio">{vacio}</p>;

  return (
    <div className="tabla-scroll">
      <table className="tabla">
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.titulo} className={c.numerica ? 'num' : undefined}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={clave(f)} className={clave(f) === seleccionada ? 'fila-seleccionada' : undefined}>
              {columnas.map((c) => (
                <td
                  key={c.titulo}
                  // En celular cada fila se apila y este rótulo hace de encabezado.
                  data-titulo={c.titulo}
                  className={[c.numerica ? 'num' : '', c.flexible ? 'flexible' : ''].join(' ').trim() || undefined}
                >
                  {c.render(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {pie && <tfoot>{pie}</tfoot>}
      </table>
    </div>
  );
}
