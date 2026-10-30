import { useConsulta } from '../lib/useConsulta';
import { pesos } from '../lib/formato';
import { servicios } from '../services';
import type { MesDelAnio } from '../types';
import Button from './Button';
import Card from './Card';
import DataTable from './DataTable';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Qué parte de lo que entró se fue en gastos. Sin ingresos no hay porcentaje que mostrar. */
const proporcion = (m: Pick<MesDelAnio, 'ingresos' | 'egresos'>) =>
  m.ingresos > 0 ? `${Math.round((m.egresos / m.ingresos) * 100)} %` : m.egresos > 0 ? 'Sin ingresos' : '';

interface Props {
  anio: number;
  onAnio(anio: number): void;
  /** Al tocar un mes, la pantalla pasa a mostrar ese mes. */
  onVerMes(mes: number): void;
  /** Cambia cada vez que se guarda algo, para volver a pedir los números. */
  vuelta: number;
}

/** Los doce meses del año uno abajo del otro: ingresos, gastos y saldo (HU-023). Los anulados no suman. */
export default function ResumenAnual({ anio, onAnio, onVerMes, vuelta }: Props) {
  const { datos: meses, error } = useConsulta(() => servicios.cuadernos.anual(anio), [anio, vuelta]);
  const total = (meses ?? []).reduce(
    (t, m) => ({ ingresos: t.ingresos + m.ingresos, egresos: t.egresos + m.egresos, saldo: t.saldo + m.saldo }),
    { ingresos: 0, egresos: 0, saldo: 0 },
  );
  const esteAnio = new Date().getFullYear();

  return (
    <Card
      titulo={`Resumen del año ${anio}`}
      nota="Mes por mes. Tocá un mes para verlo en detalle."
      className="panel-ancho no-imprimir"
      accion={
        <span className="acciones-fila">
          <Button tamano="chico" aria-label="Año anterior" onClick={() => onAnio(anio - 1)}>
            ‹ {anio - 1}
          </Button>
          <Button tamano="chico" aria-label="Año siguiente" disabled={anio >= esteAnio} onClick={() => onAnio(anio + 1)}>
            {anio + 1} ›
          </Button>
        </span>
      }
    >
      {error && <p className="vacio">{error}</p>}
      {!meses && !error && <p className="cargando">Cargando…</p>}
      {meses && (
        <DataTable<MesDelAnio>
          filas={meses}
          clave={(m) => String(m.mes)}
          columnas={[
            {
              titulo: 'Mes',
              render: (m) => (
                <Button variante="texto" tamano="chico" onClick={() => onVerMes(m.mes)}>
                  {MESES[m.mes - 1]}
                </Button>
              ),
            },
            { titulo: 'Ingresos', numerica: true, render: (m) => pesos(m.ingresos) },
            { titulo: 'Gastos', numerica: true, render: (m) => pesos(m.egresos) },
            { titulo: 'Saldo', numerica: true, render: (m) => <span className={m.saldo < 0 ? 'texto-negativo' : undefined}>{pesos(m.saldo)}</span> },
            { titulo: 'Gastos sobre ingresos', numerica: true, render: (m) => proporcion(m) },
          ]}
          pie={
            <tr>
              <th scope="row">Total {anio}</th>
              <td className="num" data-titulo="Ingresos">{pesos(total.ingresos)}</td>
              <td className="num" data-titulo="Gastos">{pesos(total.egresos)}</td>
              <td className="num" data-titulo="Saldo">{pesos(total.saldo)}</td>
              <td className="num" data-titulo="Gastos sobre ingresos">{proporcion(total)}</td>
            </tr>
          }
        />
      )}
    </Card>
  );
}
