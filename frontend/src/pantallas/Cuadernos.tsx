import { useRef, useState, type FormEvent } from 'react';
import { Tecla, useAtajo } from '../atajos/Atajos';
import Badge from '../componentes/Badge';
import Button from '../componentes/Button';
import { CampoMonto } from '../componentes/Campos';
import Card from '../componentes/Card';
import DataTable from '../componentes/DataTable';
import FiltroFechas from '../componentes/FiltroFechas';
import KpiCard from '../componentes/KpiCard';
import Modal from '../componentes/Modal';
import SegmentedControl from '../componentes/SegmentedControl';
import { useSesion } from '../estado/Sesion';
import { rangoEsteMes, rangoValido } from '../lib/fechas';
import { diaLegible, fechaHora, fechaIso, leerMonto, pesos, pesosEnteros } from '../lib/formato';
import { useConsulta } from '../lib/useConsulta';
import { servicios } from '../services';
import { NOMBRE_MEDIO, type Cambio, type MedioPago, type Movimiento, type RangoFechas, type ResumenCuadernos, type TipoMovimiento } from '../types';

const MEDIOS = Object.keys(NOMBRE_MEDIO) as MedioPago[];
const TIPOS: { valor: TipoMovimiento; etiqueta: string }[] = [
  { valor: 'egreso', etiqueta: 'Gasto' },
  { valor: 'ingreso', etiqueta: 'Ingreso' },
];
const nombreTipo = (t: TipoMovimiento) => (t === 'ingreso' ? 'Ingreso' : 'Gasto');
const RESUMEN_VACIO: ResumenCuadernos = { ingresos: 0, egresos: 0, saldo: 0, porCategoria: [] };

interface Borrador {
  fecha: string;
  tipo: TipoMovimiento;
  categoriaId: string;
  descripcion: string;
  monto: string;
  medioPago: MedioPago;
  motivo: string;
}
const enBlanco = (): Borrador => ({
  fecha: fechaIso(new Date()),
  tipo: 'egreso',
  categoriaId: '',
  descripcion: '',
  monto: '',
  medioPago: 'cash',
  motivo: '',
});

/** Una línea legible de lo que cambió entre antes y después, para el historial. */
function detalle(c: Cambio): string {
  const d = (c.despues ?? {}) as Record<string, string>;
  const a = (c.antes ?? {}) as Record<string, string>;
  const fila = (x: Record<string, string>) =>
    `${x.kind === 'income' ? 'Ingreso' : 'Gasto'} del ${diaLegible(x.date)}, ${x.category}${x.description ? ` (${x.description})` : ''}, ${pesos(
      Number(x.amount),
    )}, ${NOMBRE_MEDIO[x.payment_method as MedioPago] ?? x.payment_method}`;
  if (c.accion === 'Alta') return fila(d);
  if (c.accion === 'Anulación') return `${fila(a)}. Motivo: ${c.motivo}`;
  return `Antes: ${fila(a)}. Después: ${fila(d)}. Motivo: ${c.motivo}`;
}

/** Los cuadernos del local: cargar, corregir, anular y mirar los movimientos del período. */
export default function Cuadernos() {
  const { puede } = useSesion();
  const puedeCargar = puede('notebooks.add_entry');
  const puedeCorregir = puede('notebooks.change_entry');
  const puedeAnular = puede('notebooks.void_entry');
  const [rango, setRango] = useState<RangoFechas>(rangoEsteMes);
  const [vuelta, setVuelta] = useState(0);
  // Con una fecha a medio escribir se sigue mostrando lo último que se pidió.
  const pedido = [rango.desde, rango.hasta, vuelta];
  const { datos: categorias } = useConsulta(() => servicios.cuadernos.categorias(), []);
  const { datos: movimientos, error } = useConsulta(
    () => (rangoValido(rango) ? servicios.cuadernos.movimientos(rango) : Promise.resolve([])),
    pedido,
  );
  const { datos: resumen } = useConsulta(() => (rangoValido(rango) ? servicios.cuadernos.resumen(rango) : Promise.resolve(RESUMEN_VACIO)), pedido);
  const { datos: cambios } = useConsulta(() => servicios.cuadernos.cambiosRecientes(), [vuelta]);

  const [borrador, setBorrador] = useState<Borrador>(enBlanco);
  const [editando, setEditando] = useState<Movimiento | null>(null);
  const [porAnular, setPorAnular] = useState<Movimiento | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');
  const [verHistorial, setVerHistorial] = useState<Movimiento | null>(null);
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const campoFecha = useRef<HTMLInputElement>(null);
  // Una clave por intento de carga: si el mismo envío llega dos veces, se guarda uno solo (HU-021).
  const clave = useRef(crypto.randomUUID());

  const cambiar = (parte: Partial<Borrador>) => {
    setBorrador((b) => ({ ...b, ...parte }));
    setAviso('');
  };
  const cancelar = () => {
    setEditando(null);
    setBorrador(enBlanco());
    setAviso('');
  };

  useAtajo('volver', cancelar, { activo: editando !== null });

  if (error) return <p className="vacio">{error}</p>;
  if (!categorias || !movimientos || !resumen || !cambios) return <p className="cargando">Cargando los cuadernos…</p>;

  const periodo = rangoValido(rango)
    ? rango.desde === rango.hasta
      ? `del ${diaLegible(rango.desde)}`
      : `del ${diaLegible(rango.desde)} al ${diaLegible(rango.hasta)}`
    : '';

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    const datos = {
      fecha: borrador.fecha,
      tipo: borrador.tipo,
      categoriaId: borrador.categoriaId,
      descripcion: borrador.descripcion,
      monto: leerMonto(borrador.monto),
      medioPago: borrador.medioPago,
    };
    setGuardando(true);
    try {
      if (editando) await servicios.cuadernos.corregir(editando.id, datos, borrador.motivo);
      else await servicios.cuadernos.crear(datos, clave.current);
    } catch (err) {
      setAviso((err as Error).message);
      return;
    } finally {
      setGuardando(false);
    }
    clave.current = crypto.randomUUID();
    // Si el movimiento guardado cae fuera del período, se lo estira para que no "desaparezca".
    if (datos.fecha < rango.desde) setRango({ ...rango, desde: datos.fecha });
    else if (datos.fecha > rango.hasta) setRango({ ...rango, hasta: datos.fecha });
    setVuelta((v) => v + 1);
    cancelar();
    campoFecha.current?.focus();
  };

  const editar = (m: Movimiento) => {
    setEditando(m);
    setBorrador({
      fecha: m.fecha,
      tipo: m.tipo,
      categoriaId: m.categoriaId,
      descripcion: m.descripcion,
      monto: m.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 }),
      medioPago: m.medioPago,
      motivo: '',
    });
    setAviso('');
    campoFecha.current?.focus();
  };

  const anular = async () => {
    if (!porAnular) return;
    try {
      await servicios.cuadernos.anular(porAnular.id, motivoAnulacion);
    } catch (err) {
      setAviso((err as Error).message);
      return;
    }
    if (editando?.id === porAnular.id) cancelar();
    setPorAnular(null);
    setMotivoAnulacion('');
    setVuelta((v) => v + 1);
  };

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Cuadernos</h1>
          <p className="encabezado-dato">Ingresos y gastos del local.</p>
        </div>
      </div>

      <FiltroFechas valor={rango} onChange={setRango} />

      <div className="panel">
        {/* Los tres indicadores van en su propia fila, a todo el ancho, en cualquier pantalla. */}
        <div className="panel-completo indicadores-3">
          <KpiCard titulo="Ingresos del período" valor={pesosEnteros(resumen.ingresos)} variante="positiva" />
          <KpiCard titulo="Gastos del período" valor={pesosEnteros(resumen.egresos)} variante="negativa" />
          <KpiCard
            titulo="Saldo del período"
            valor={pesosEnteros(resumen.saldo)}
            variante={resumen.saldo >= 0 ? 'positiva' : 'negativa'}
            pie="Ingresos menos gastos"
          />
        </div>

        {/* Consulta no carga ni corrige: el formulario no aparece (HU-024). */}
        {(puedeCargar || (puedeCorregir && editando)) && (
          <Card titulo={editando ? 'Corregir movimiento' : 'Cargar movimiento'}>
            <form className="formulario" onSubmit={guardar}>
              <label className="campo">
                <span>Fecha</span>
                <input
                  ref={campoFecha}
                  className="campo-texto"
                  type="date"
                  required
                  value={borrador.fecha}
                  onChange={(e) => cambiar({ fecha: e.target.value })}
                />
              </label>
              <div className="campo">
                <span>Tipo</span>
                <SegmentedControl
                  etiqueta="Tipo"
                  opciones={TIPOS}
                  valor={borrador.tipo}
                  onChange={(tipo) => cambiar({ tipo, categoriaId: '' })}
                  bloque
                />
              </div>
              <label className="campo">
                <span>Categoría</span>
                <select required value={borrador.categoriaId} onChange={(e) => cambiar({ categoriaId: e.target.value })}>
                  <option value="">Elegí una categoría</option>
                  {categorias[borrador.tipo].map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="campo">
                <span>Descripción</span>
                <input
                  className="campo-texto"
                  type="text"
                  maxLength={120}
                  value={borrador.descripcion}
                  placeholder="Por ejemplo: verdura"
                  onChange={(e) => cambiar({ descripcion: e.target.value })}
                />
              </label>
              <CampoMonto rotulo="Monto" valor={borrador.monto} onChange={(monto) => cambiar({ monto })} />
              <label className="campo">
                <span>Medio de pago</span>
                <select value={borrador.medioPago} onChange={(e) => cambiar({ medioPago: e.target.value as MedioPago })}>
                  {MEDIOS.map((m) => (
                    <option key={m} value={m}>
                      {NOMBRE_MEDIO[m]}
                    </option>
                  ))}
                </select>
              </label>
              {editando && (
                <label className="campo">
                  <span>Motivo de la corrección</span>
                  <input
                    className="campo-texto"
                    type="text"
                    required
                    maxLength={200}
                    value={borrador.motivo}
                    placeholder="Por ejemplo: el monto era otro"
                    onChange={(e) => cambiar({ motivo: e.target.value })}
                  />
                </label>
              )}
              <p className="login-error" role="alert">
                {aviso}
              </p>
              <div className="acciones">
                <Button type="submit" variante="primario" disabled={guardando}>
                  {editando ? 'Guardar corrección' : 'Guardar movimiento'} <Tecla id="confirmar" />
                </Button>
                {editando && (
                  <Button onClick={cancelar}>
                    Cancelar <Tecla id="volver" />
                  </Button>
                )}
              </div>
            </form>
          </Card>
        )}

        <Card titulo={`Movimientos ${periodo}`} className="panel-ancho">
          <DataTable<Movimiento>
            filas={movimientos}
            clave={(m) => m.id}
            seleccionada={editando?.id}
            vacio="No hay movimientos cargados en este período."
            columnas={[
              { titulo: 'Fecha', render: (m) => diaLegible(m.fecha) },
              { titulo: 'Tipo', render: (m) => <Badge tono={m.tipo === 'ingreso' ? 'positivo' : 'negativo'}>{nombreTipo(m.tipo)}</Badge> },
              { titulo: 'Categoría', render: (m) => m.categoria },
              { titulo: 'Descripción', flexible: true, render: (m) => m.descripcion },
              { titulo: 'Medio', render: (m) => NOMBRE_MEDIO[m.medioPago] },
              { titulo: 'Monto', numerica: true, render: (m) => pesos(m.tipo === 'egreso' ? -m.monto : m.monto) },
              {
                titulo: '',
                render: (m) => (
                  <span className="acciones-fila">
                    {puedeCorregir && (
                      <Button tamano="chico" aria-label={`Corregir ${m.categoria} del ${diaLegible(m.fecha)}`} onClick={() => editar(m)}>
                        Corregir
                      </Button>
                    )}
                    {puedeAnular && (
                      <Button
                        tamano="chico"
                        variante="peligro"
                        aria-label={`Anular ${m.categoria} del ${diaLegible(m.fecha)}`}
                        onClick={() => {
                          setPorAnular(m);
                          setMotivoAnulacion('');
                          setAviso('');
                        }}
                      >
                        Anular
                      </Button>
                    )}
                    <Button tamano="chico" aria-label={`Historial de ${m.categoria} del ${diaLegible(m.fecha)}`} onClick={() => setVerHistorial(m)}>
                      Historial
                    </Button>
                  </span>
                ),
              },
            ]}
          />
        </Card>

        <Card titulo={`Resumen por categoría ${periodo}`}>
          <DataTable<ResumenCuadernos['porCategoria'][number]>
            filas={resumen.porCategoria}
            clave={(c) => `${c.tipo}-${c.categoria}`}
            vacio="Sin movimientos en este período."
            columnas={[
              { titulo: 'Categoría', render: (c) => c.categoria },
              { titulo: 'Tipo', render: (c) => nombreTipo(c.tipo) },
              { titulo: 'Movimientos', numerica: true, render: (c) => c.movimientos },
              { titulo: 'Total', numerica: true, render: (c) => pesos(c.monto) },
            ]}
          />
        </Card>

        <Card titulo="Últimos cambios" nota="Cada alta, corrección o anulación queda anotada. No se puede modificar." className="panel-ancho">
          <DataTable<Cambio>
            filas={cambios.slice(0, 8)}
            clave={(c) => c.id}
            vacio="Todavía no hubo cambios."
            columnas={[
              { titulo: 'Cuándo', render: (c) => fechaHora(c.fecha) },
              { titulo: 'Quién', render: (c) => c.usuario },
              { titulo: 'Qué', render: (c) => c.accion },
              { titulo: 'Detalle', flexible: true, render: (c) => detalle(c) },
            ]}
          />
        </Card>
      </div>

      {porAnular && (
        <Modal
          titulo="¿Anulás este movimiento?"
          onCerrar={() => setPorAnular(null)}
          onConfirmar={anular}
          acciones={
            <>
              <Button onClick={() => setPorAnular(null)}>
                No, dejarlo <Tecla id="volver" />
              </Button>
              <Button variante="peligro" onClick={anular} disabled={!motivoAnulacion.trim()}>
                Sí, anular <Tecla id="confirmar" />
              </Button>
            </>
          }
        >
          <p>
            {nombreTipo(porAnular.tipo)} del {diaLegible(porAnular.fecha)}, {porAnular.categoria}, por <strong>{pesos(porAnular.monto)}</strong>. Deja de
            sumar en los saldos, pero sigue visible en el historial.
          </p>
          <label className="campo">
            <span>Motivo</span>
            <input
              className="campo-texto"
              autoFocus
              maxLength={200}
              value={motivoAnulacion}
              placeholder="Por ejemplo: cargado dos veces"
              onChange={(e) => setMotivoAnulacion(e.target.value)}
            />
          </label>
          <p className="login-error" role="alert">
            {aviso}
          </p>
        </Modal>
      )}

      {verHistorial && <Historial movimiento={verHistorial} onCerrar={() => setVerHistorial(null)} />}
    </>
  );
}

/** Qué le pasó a un movimiento, en orden: alta, correcciones y anulación (HU-026). */
function Historial({ movimiento, onCerrar }: { movimiento: Movimiento; onCerrar(): void }) {
  const { datos: cambios, error } = useConsulta(() => servicios.cuadernos.historial(movimiento.id), [movimiento.id]);
  return (
    <Modal titulo="Historial del movimiento" onCerrar={onCerrar} ancho="ancho" acciones={<Button onClick={onCerrar}>Cerrar <Tecla id="volver" /></Button>}>
      {error && <p className="vacio">{error}</p>}
      {!cambios && !error && <p className="cargando">Cargando…</p>}
      {cambios && (
        <DataTable<Cambio>
          filas={cambios}
          clave={(c) => c.id}
          vacio="Sin cambios."
          columnas={[
            { titulo: 'Cuándo', render: (c) => fechaHora(c.fecha) },
            { titulo: 'Quién', render: (c) => c.usuario },
            { titulo: 'Qué', render: (c) => c.accion },
            { titulo: 'Detalle', flexible: true, render: (c) => detalle(c) },
          ]}
        />
      )}
    </Modal>
  );
}
