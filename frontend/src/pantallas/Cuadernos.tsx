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
import { rangoEsteMes, rangoValido } from '../lib/fechas';
import { diaLegible, fechaHora, fechaIso, leerMonto, pesos, pesosEnteros } from '../lib/formato';
import { useConsulta } from '../lib/useConsulta';
import { servicios } from '../services';
import type { EventoAuditoria, MedioPago, Movimiento, RangoFechas, ResumenCuadernos, TipoMovimiento } from '../types';

const MEDIOS: MedioPago[] = ['Efectivo', 'Débito', 'Crédito', 'QR', 'Transferencia'];
const TIPOS: { valor: TipoMovimiento; etiqueta: string }[] = [
  { valor: 'egreso', etiqueta: 'Gasto' },
  { valor: 'ingreso', etiqueta: 'Ingreso' },
];

interface Borrador {
  fecha: string;
  tipo: TipoMovimiento;
  categoria: string;
  descripcion: string;
  monto: string;
  medioPago: MedioPago;
}
const enBlanco = (): Borrador => ({
  fecha: fechaIso(new Date()),
  tipo: 'egreso',
  categoria: '',
  descripcion: '',
  monto: '',
  medioPago: 'Efectivo',
});

/** Los cuadernos del local: cargar, corregir y mirar los movimientos del período. */
export default function Cuadernos() {
  const [rango, setRango] = useState<RangoFechas>(rangoEsteMes);
  const [vuelta, setVuelta] = useState(0);
  // Con una fecha a medio escribir se sigue mostrando lo último que se pidió.
  const pedido = [rango.desde, rango.hasta, vuelta];
  const { datos: categorias } = useConsulta(() => servicios.cuadernos.categorias(), []);
  const { datos: movimientos, error } = useConsulta(
    () => (rangoValido(rango) ? servicios.cuadernos.movimientos(rango) : Promise.resolve([])),
    pedido,
  );
  const { datos: resumen } = useConsulta(
    () => (rangoValido(rango) ? servicios.cuadernos.resumen(rango) : Promise.resolve({ ingresos: 0, egresos: 0, saldo: 0, porCategoria: [] })),
    pedido,
  );
  const { datos: auditoria } = useConsulta(() => servicios.cuadernos.auditoria(), [vuelta]);

  const [borrador, setBorrador] = useState<Borrador>(enBlanco);
  const [editando, setEditando] = useState<string | null>(null);
  const [porBorrar, setPorBorrar] = useState<Movimiento | null>(null);
  const [aviso, setAviso] = useState('');
  const campoFecha = useRef<HTMLInputElement>(null);

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
  if (!categorias || !movimientos || !resumen || !auditoria) return <p className="cargando">Cargando los cuadernos…</p>;

  const periodo = rangoValido(rango)
    ? rango.desde === rango.hasta
      ? `del ${diaLegible(rango.desde)}`
      : `del ${diaLegible(rango.desde)} al ${diaLegible(rango.hasta)}`
    : '';

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const datos = { ...borrador, monto: leerMonto(borrador.monto) };
    try {
      if (editando) await servicios.cuadernos.editar(editando, datos);
      else await servicios.cuadernos.crear(datos);
    } catch (err) {
      setAviso((err as Error).message);
      return;
    }
    // Si el movimiento guardado cae fuera del período, se lo estira para que no "desaparezca".
    if (datos.fecha < rango.desde) setRango({ ...rango, desde: datos.fecha });
    else if (datos.fecha > rango.hasta) setRango({ ...rango, hasta: datos.fecha });
    setVuelta((v) => v + 1);
    cancelar();
    campoFecha.current?.focus();
  };

  const editar = (m: Movimiento) => {
    setEditando(m.id);
    setBorrador({ ...m, monto: m.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 }) });
    setAviso('');
    campoFecha.current?.focus();
  };

  const borrar = async () => {
    if (!porBorrar) return;
    await servicios.cuadernos.borrar(porBorrar.id);
    if (editando === porBorrar.id) cancelar();
    setPorBorrar(null);
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

        <Card titulo={editando ? 'Editar movimiento' : 'Cargar movimiento'}>
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
                onChange={(tipo) => cambiar({ tipo, categoria: '' })}
                bloque
              />
            </div>
            <label className="campo">
              <span>Categoría</span>
              <select required value={borrador.categoria} onChange={(e) => cambiar({ categoria: e.target.value })}>
                <option value="">Elegí una categoría</option>
                {categorias[borrador.tipo].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="campo">
              <span>Descripción</span>
              <input
                className="campo-texto"
                type="text"
                maxLength={80}
                value={borrador.descripcion}
                placeholder="Por ejemplo: alquiler de octubre"
                onChange={(e) => cambiar({ descripcion: e.target.value })}
              />
            </label>
            <CampoMonto rotulo="Monto" valor={borrador.monto} onChange={(monto) => cambiar({ monto })} />
            <label className="campo">
              <span>Medio de pago</span>
              <select value={borrador.medioPago} onChange={(e) => cambiar({ medioPago: e.target.value as MedioPago })}>
                {MEDIOS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <p className="login-error" role="alert">
              {aviso}
            </p>
            <div className="acciones">
              <Button type="submit" variante="primario">
                {editando ? 'Guardar cambios' : 'Guardar movimiento'} <Tecla id="confirmar" />
              </Button>
              {editando && (
                <Button onClick={cancelar}>
                  Cancelar <Tecla id="volver" />
                </Button>
              )}
            </div>
          </form>
        </Card>

        <Card titulo={`Movimientos ${periodo}`} className="panel-ancho">
          <DataTable<Movimiento>
            filas={movimientos}
            clave={(m) => m.id}
            seleccionada={editando ?? undefined}
            vacio="No hay movimientos cargados en este período."
            columnas={[
              { titulo: 'Fecha', render: (m) => diaLegible(m.fecha) },
              {
                titulo: 'Tipo',
                render: (m) => <Badge tono={m.tipo === 'ingreso' ? 'positivo' : 'negativo'}>{m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}</Badge>,
              },
              { titulo: 'Categoría', render: (m) => m.categoria },
              { titulo: 'Descripción', flexible: true, render: (m) => m.descripcion },
              { titulo: 'Medio', render: (m) => m.medioPago },
              { titulo: 'Monto', numerica: true, render: (m) => pesos(m.tipo === 'egreso' ? -m.monto : m.monto) },
              {
                titulo: '',
                render: (m) => (
                  <span className="acciones-fila">
                    <Button tamano="chico" aria-label={`Editar ${m.categoria} del ${diaLegible(m.fecha)}`} onClick={() => editar(m)}>
                      Editar
                    </Button>
                    <Button tamano="chico" variante="peligro" aria-label={`Borrar ${m.categoria} del ${diaLegible(m.fecha)}`} onClick={() => setPorBorrar(m)}>
                      Borrar
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
              { titulo: 'Tipo', render: (c) => (c.tipo === 'ingreso' ? 'Ingreso' : 'Gasto') },
              { titulo: 'Movimientos', numerica: true, render: (c) => c.movimientos },
              { titulo: 'Total', numerica: true, render: (c) => pesos(c.monto) },
            ]}
          />
        </Card>

        <Card titulo="Registro de cambios" nota="Cada alta, edición o borrado queda anotado. No se puede modificar." className="panel-ancho">
          <DataTable<EventoAuditoria>
            filas={auditoria.slice(0, 8)}
            clave={(a) => a.id}
            vacio="Todavía no hubo cambios en esta sesión."
            columnas={[
              { titulo: 'Cuándo', render: (a) => fechaHora(a.fecha) },
              { titulo: 'Quién', render: (a) => a.usuario },
              { titulo: 'Qué', render: (a) => a.accion },
              { titulo: 'Detalle', flexible: true, render: (a) => a.detalle },
            ]}
          />
        </Card>
      </div>

      {porBorrar && (
        <Modal
          titulo="¿Borrás este movimiento?"
          onCerrar={() => setPorBorrar(null)}
          onConfirmar={borrar}
          acciones={
            <>
              <Button onClick={() => setPorBorrar(null)}>
                No, dejarlo <Tecla id="volver" />
              </Button>
              <Button variante="peligro" onClick={borrar}>
                Sí, borrar <Tecla id="confirmar" />
              </Button>
            </>
          }
        >
          <p>
            {porBorrar.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} del {diaLegible(porBorrar.fecha)}, {porBorrar.categoria}, por{' '}
            <strong>{pesos(porBorrar.monto)}</strong>. El borrado queda en el registro de cambios.
          </p>
        </Modal>
      )}
    </>
  );
}
