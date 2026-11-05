import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tecla } from '../atajos/Atajos';
import Badge from '../componentes/Badge';
import Button from '../componentes/Button';
import Card from '../componentes/Card';
import DataTable, { type Columna } from '../componentes/DataTable';
import FiltroFechas from '../componentes/FiltroFechas';
import FiltrosMovimientos, { describirFiltros } from '../componentes/FiltrosMovimientos';
import FormMovimiento, { type Borrador } from '../componentes/FormMovimiento';
import KpiCard from '../componentes/KpiCard';
import Menu, { type ItemMenu } from '../componentes/Menu';
import Modal from '../componentes/Modal';
import NuevaCategoria from '../componentes/NuevaCategoria';
import ResumenAnual from '../componentes/ResumenAnual';
import TarjetaCaja from '../componentes/TarjetaCaja';
import { useSesion } from '../estado/Sesion';
import { rangoDelMes, rangoEsteMes, rangoValido } from '../lib/fechas';
import { MONTO_ILEGIBLE, diaConNombre, diaLegible, fechaHora, fechaIso, leerMonto, pesos, pesosEnteros, problemaDeMonto } from '../lib/formato';
import { recordarTurno, turnoSugerido } from '../lib/turno';
import { useConsulta } from '../lib/useConsulta';
import { useDemorado } from '../lib/useDemorado';
import { servicios } from '../services';
import {
  NOMBRE_MEDIO,
  NOMBRE_TURNO,
  SIN_FILTROS,
  type Cambio,
  type Categoria,
  type FiltrosMovimientos as Filtros,
  type MedioPago,
  type Movimiento,
  type RangoFechas,
  type ResumenCuadernos,
  type TipoMovimiento,
  type Turno,
} from '../types';

const nombreTipo = (t: TipoMovimiento) => (t === 'ingreso' ? 'Ingreso' : 'Gasto');
const RESUMEN_VACIO: ResumenCuadernos = { ingresos: 0, egresos: 0, saldo: 0, porCategoria: [] };
/** Cuántos renglones trae cada parte de la lista de Reportes. */
const PARTE = 200;

const enBlanco = (): Borrador => ({
  fecha: fechaIso(new Date()),
  tipo: 'egreso',
  categoriaId: '',
  descripcion: '',
  monto: '',
  medioPago: 'cash',
  turno: turnoSugerido(),
  motivo: '',
  sumarAVenta: true,
});

const deMovimiento = (m: Movimiento): Borrador => ({
  fecha: m.fecha,
  tipo: m.tipo,
  categoriaId: m.categoriaId,
  descripcion: m.descripcion,
  monto: m.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 }),
  medioPago: m.medioPago,
  turno: m.turno,
  motivo: '',
  // Si pasa a ser con débito al corregirlo, se propone sumar la venta (la ida y vuelta, ADR-0012).
  // Si ya era con débito y se cargó sin venta, no se propone de entrada.
  sumarAVenta: m.medioPago !== 'debit',
});

const sumaVenta = (b: Borrador) => b.sumarAVenta && b.tipo === 'egreso' && b.medioPago === 'debit';

/** Lo que se le manda al servicio. Devuelve null si el monto no se entiende. */
function datosDe(b: Borrador) {
  const monto = leerMonto(b.monto);
  if (!Number.isFinite(monto) || monto <= 0) return null;
  return { fecha: b.fecha, tipo: b.tipo, categoriaId: b.categoriaId, descripcion: b.descripcion, monto, medioPago: b.medioPago, turno: b.turno };
}

type Solapa = 'cargar' | 'reportes';

/** Una línea legible de lo que cambió entre antes y después, para el historial. */
function detalle(c: Cambio): string {
  const d = (c.despues ?? {}) as Record<string, string>;
  const a = (c.antes ?? {}) as Record<string, string>;
  // Los cambios anteriores al turno no lo tienen guardado.
  const turno = (x: Record<string, string>) => (x.shift ? ` (${NOMBRE_TURNO[x.shift as Turno].toLowerCase()})` : '');
  const fila = (x: Record<string, string>) =>
    `${x.kind === 'income' ? 'Ingreso' : 'Gasto'} del ${diaLegible(x.date)}${turno(x)}, ${x.category}${x.description ? ` (${x.description})` : ''}, ${pesos(
      Number(x.amount),
    )}, ${NOMBRE_MEDIO[x.payment_method as MedioPago] ?? x.payment_method}`;
  if (c.accion === 'Alta') return fila(d);
  if (c.accion === 'Anulación') return `${fila(a)}. Motivo: ${c.motivo}`;
  return `Antes: ${fila(a)}. Después: ${fila(d)}. Motivo: ${c.motivo}`;
}

/** Lo que se puede hacer con un movimiento ya cargado, según los permisos. */
interface AccionesFila {
  puedeCorregir: boolean;
  puedeAnular: boolean;
  onCorregir(m: Movimiento): void;
  onAnular(m: Movimiento): void;
  onHistorial(m: Movimiento): void;
}

function columnasMovimiento(conFecha: boolean, a: AccionesFila): Columna<Movimiento>[] {
  const columnas: Columna<Movimiento>[] = [
    { titulo: 'Turno', render: (m) => NOMBRE_TURNO[m.turno] },
    {
      titulo: 'Tipo',
      render: (m) =>
        m.anulado ? <Badge tono="neutro">Anulado</Badge> : <Badge tono={m.tipo === 'ingreso' ? 'positivo' : 'negativo'}>{nombreTipo(m.tipo)}</Badge>,
    },
    { titulo: 'Categoría', render: (m) => m.categoria },
    {
      titulo: 'Descripción',
      flexible: true,
      render: (m) => (m.anulado ? `${m.descripcion}${m.descripcion ? '. ' : ''}Anulado: ${m.motivoAnulacion}` : m.descripcion),
    },
    { titulo: 'Medio', render: (m) => NOMBRE_MEDIO[m.medioPago] },
    {
      titulo: 'Monto',
      numerica: true,
      render: (m) => <span className={m.anulado ? 'tachado' : undefined}>{pesos(m.tipo === 'egreso' ? -m.monto : m.monto)}</span>,
    },
    {
      titulo: '',
      render: (m) => {
        // Las tres acciones en un solo botón: la fila respira y "Anular" no queda a un clic distraído.
        const items: ItemMenu[] = [];
        // La venta de un gasto con débito se corrige y se anula desde su gasto (ADR-0010).
        const libre = !m.anulado && !m.gastoConDebitoId;
        if (m.gastoConDebitoId && !m.anulado) items.push({ tipo: 'titulo', etiqueta: 'Sale de un gasto con débito' });
        if (a.puedeCorregir && libre) items.push({ etiqueta: 'Corregir', onElegir: () => a.onCorregir(m) });
        items.push({ etiqueta: 'Historial', onElegir: () => a.onHistorial(m) });
        if (a.puedeAnular && libre) items.push({ tipo: 'separador' }, { etiqueta: 'Anular', peligro: true, onElegir: () => a.onAnular(m) });
        return (
          <span className="acciones-fila no-imprimir">
            <Menu contenido="⋯" etiqueta={`Acciones de ${m.categoria} del ${diaLegible(m.fecha)}`} items={items} claseBoton="boton boton-secundario boton-chico boton-mas" />
          </span>
        );
      },
    },
  ];
  return conFecha ? [{ titulo: 'Fecha', render: (m) => diaLegible(m.fecha) }, ...columnas] : columnas;
}

/**
 * Los cuadernos del local, en dos solapas. "Cargar" es lo de todos los días: el formulario y lo
 * cargado en esa fecha. "Reportes" junta período, filtros, totales, caja y exportación.
 * Quien solo consulta ve únicamente Reportes.
 */
export default function Cuadernos() {
  const { puede, sesion } = useSesion();
  const puedeCargar = puede('notebooks.add_entry');
  const puedeCorregir = puede('notebooks.change_entry');
  const puedeAnular = puede('notebooks.void_entry');
  const puedeCrearCategorias = puede('notebooks.manage_categories');

  const [parametros, setParametros] = useSearchParams();
  const solapa: Solapa = puedeCargar && parametros.get('ver') !== 'reportes' ? 'cargar' : 'reportes';
  const irA = (s: Solapa) => setParametros(s === 'reportes' ? { ver: 'reportes' } : {}, { replace: true });

  // Cambia cada vez que se guarda algo, para que todo vuelva a pedir sus números.
  const [vuelta, setVuelta] = useState(0);
  const otraVuelta = () => setVuelta((v) => v + 1);
  const { datos: categorias, recargar: recargarCategorias, error } = useConsulta(() => servicios.cuadernos.categorias(), []);

  const [corrigiendo, setCorrigiendo] = useState<Movimiento | null>(null);
  const [porAnular, setPorAnular] = useState<Movimiento | null>(null);
  const [verHistorial, setVerHistorial] = useState<Movimiento | null>(null);

  const acciones: AccionesFila = {
    puedeCorregir,
    puedeAnular,
    onCorregir: setCorrigiendo,
    onAnular: setPorAnular,
    onHistorial: setVerHistorial,
  };

  if (error) return <p className="vacio">{error}</p>;
  if (!categorias) return <p className="cargando">Cargando los cuadernos…</p>;

  const local = sesion?.active_tenant?.name ?? '';

  return (
    <>
      <h1 className="solo-lectores">Cuadernos de {local}</h1>
      {puedeCargar && <Solapas activa={solapa} onCambio={irA} />}

      <div role={puedeCargar ? 'tabpanel' : undefined} id={`panel-${solapa}`} aria-labelledby={puedeCargar ? `solapa-${solapa}` : undefined}>
        {solapa === 'cargar' ? (
          <SolapaCargar
            categorias={categorias}
            puedeCrearCategorias={puedeCrearCategorias}
            recargarCategorias={recargarCategorias}
            vuelta={vuelta}
            onGuardado={otraVuelta}
            acciones={acciones}
          />
        ) : (
          <SolapaReportes categorias={categorias} local={local} vuelta={vuelta} onCambio={otraVuelta} acciones={acciones} />
        )}
      </div>

      {corrigiendo && (
        <Correccion
          movimiento={corrigiendo}
          categorias={categorias}
          onCerrar={() => setCorrigiendo(null)}
          onGuardada={() => {
            setCorrigiendo(null);
            otraVuelta();
          }}
        />
      )}
      {porAnular && (
        <Anulacion
          movimiento={porAnular}
          onCerrar={() => setPorAnular(null)}
          onAnulado={() => {
            setPorAnular(null);
            otraVuelta();
          }}
        />
      )}
      {verHistorial && <Historial movimiento={verHistorial} onCerrar={() => setVerHistorial(null)} />}
    </>
  );
}

const SOLAPAS: { valor: Solapa; etiqueta: string }[] = [
  { valor: 'cargar', etiqueta: 'Cargar' },
  { valor: 'reportes', etiqueta: 'Reportes' },
];

/** Las dos solapas. Con el teclado: flechas izquierda y derecha para pasar de una a otra. */
function Solapas({ activa, onCambio }: { activa: Solapa; onCambio(s: Solapa): void }) {
  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const otra = activa === 'cargar' ? 'reportes' : 'cargar';
    onCambio(otra);
    document.getElementById(`solapa-${otra}`)?.focus();
  };
  return (
    <div className="solapas no-imprimir" role="tablist" aria-label="Qué querés hacer" onKeyDown={alTeclear}>
      {SOLAPAS.map((s) => (
        <button
          key={s.valor}
          id={`solapa-${s.valor}`}
          type="button"
          role="tab"
          aria-selected={s.valor === activa}
          aria-controls={`panel-${s.valor}`}
          tabIndex={s.valor === activa ? 0 : -1}
          className="solapa"
          onClick={() => onCambio(s.valor)}
        >
          {s.etiqueta}
        </button>
      ))}
    </div>
  );
}

interface PropsCargar {
  categorias: Record<TipoMovimiento, Categoria[]>;
  puedeCrearCategorias: boolean;
  recargarCategorias(): void;
  vuelta: number;
  onGuardado(): void;
  acciones: AccionesFila;
}

/** La carga de todos los días: el formulario y, al lado, lo ya cargado en esa fecha para comparar con el papel. */
function SolapaCargar({ categorias, puedeCrearCategorias, recargarCategorias, vuelta, onGuardado, acciones }: PropsCargar) {
  const [borrador, setBorrador] = useState<Borrador>(enBlanco);
  const [aviso, setAviso] = useState('');
  const [avisoOk, setAvisoOk] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [ultimo, setUltimo] = useState<string>();
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const campoCategoria = useRef<HTMLSelectElement>(null);
  // Una clave por intento de carga: si el mismo envío llega dos veces, se guarda uno solo (HU-021).
  const clave = useRef(crypto.randomUUID());

  const dia = borrador.fecha;
  const { datos: delDia } = useConsulta(
    // Un día entra siempre en una sola parte, aun en un local con mucho movimiento.
    () =>
      dia
        ? servicios.cuadernos.movimientos({ desde: dia, hasta: dia }, SIN_FILTROS, 1000).then((p) => p.movimientos)
        : Promise.resolve([]),
    [dia, vuelta],
  );
  const ingresos = (delDia ?? []).filter((m) => m.tipo === 'ingreso').reduce((t, m) => t + m.monto, 0);
  const gastos = (delDia ?? []).filter((m) => m.tipo === 'egreso').reduce((t, m) => t + m.monto, 0);

  const cambiar = (parte: Partial<Borrador>) => {
    setBorrador((b) => ({ ...b, ...parte }));
    setAviso('');
    setAvisoOk('');
  };

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    const problema = problemaDeMonto(borrador.monto);
    const datos = datosDe(borrador);
    if (problema || !datos) {
      setAviso(problema ?? MONTO_ILEGIBLE);
      return;
    }
    setGuardando(true);
    let nuevo: Movimiento;
    try {
      nuevo = await servicios.cuadernos.crear({ ...datos, sumarAVenta: sumaVenta(borrador) }, clave.current);
    } catch (err) {
      setAviso((err as Error).message);
      return;
    } finally {
      setGuardando(false);
    }
    clave.current = crypto.randomUUID();
    recordarTurno(datos.turno);
    const categoria = categorias[datos.tipo].find((c) => c.id === datos.categoriaId)?.nombre ?? '';
    const yVenta = nuevo.ventaDelDebitoId ? ', y su venta con débito' : '';
    setAvisoOk(`Guardado: ${nombreTipo(datos.tipo).toLowerCase()} de ${categoria}, ${pesos(datos.monto)}${yVenta}.`);
    setUltimo(nuevo.id);
    // Carga en serie: fecha, turno, tipo y medio de pago quedan para el próximo renglón.
    setBorrador((b) => ({ ...b, categoriaId: '', descripcion: '', monto: '', motivo: '' }));
    onGuardado();
    campoCategoria.current?.focus();
  };

  return (
    <div className="carga">
      <Card titulo="Cargar movimiento" className="carga-form no-imprimir">
        <FormMovimiento
          borrador={borrador}
          onCambio={cambiar}
          categorias={categorias}
          onNuevaCategoria={puedeCrearCategorias ? () => setCreandoCategoria(true) : undefined}
          fechaYTurno="resumen"
          campoCategoria={campoCategoria}
          aviso={aviso}
          avisoOk={avisoOk}
          guardando={guardando}
          textoGuardar="Guardar movimiento"
          onGuardar={guardar}
        />
      </Card>

      <Card
        titulo={dia ? `Cargados el ${diaConNombre(dia)}` : 'Cargados'}
        nota={delDia && delDia.length > 0 ? `Ingresos ${pesos(ingresos)}, gastos ${pesos(gastos)}. Los anulados no se muestran.` : undefined}
        className="carga-dia"
      >
        {!delDia ? (
          <p className="cargando">Cargando…</p>
        ) : (
          <DataTable<Movimiento>
            filas={delDia}
            clave={(m) => m.id}
            seleccionada={ultimo}
            vacio="Todavía no hay nada cargado en esta fecha."
            columnas={columnasMovimiento(false, acciones)}
          />
        )}
      </Card>

      {creandoCategoria && (
        <NuevaCategoria
          tipo={borrador.tipo}
          onCerrar={() => setCreandoCategoria(false)}
          onCreada={(c) => {
            setCreandoCategoria(false);
            recargarCategorias();
            cambiar({ categoriaId: c.id });
          }}
        />
      )}
    </div>
  );
}

interface PropsReportes {
  categorias: Record<TipoMovimiento, Categoria[]>;
  local: string;
  vuelta: number;
  onCambio(): void;
  acciones: AccionesFila;
}

/** Todo lo de consulta: período, filtros, totales, movimientos, caja, año y últimos cambios. */
function SolapaReportes({ categorias, local, vuelta, onCambio, acciones }: PropsReportes) {
  const { puede } = useSesion();
  const puedeExportar = puede('notebooks.export');
  const puedeCargarInicial = puede('notebooks.set_cash_opening');
  const [rango, setRango] = useState<RangoFechas>(rangoEsteMes);
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  // El texto se busca cuando se deja de tipear, no en cada tecla.
  const texto = useDemorado(filtros.texto);
  const aplicados: Filtros = { ...filtros, texto };
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  // Con una fecha a medio escribir se sigue mostrando lo último que se pidió.
  const pedido = [rango.desde, rango.hasta, aplicados.tipo, aplicados.categoriaId, aplicados.medioPago, texto, aplicados.verAnulados, vuelta];
  // La lista viene de a partes (un año de un local con mucho trabajo son miles de renglones).
  // Con otro período o filtro se vuelve a la primera parte.
  const [cuantos, setCuantos] = useState(PARTE);
  const clavePedido = pedido.join('|');
  const [pedidoAnterior, setPedidoAnterior] = useState(clavePedido);
  if (pedidoAnterior !== clavePedido) {
    setPedidoAnterior(clavePedido);
    setCuantos(PARTE);
  }
  const { datos: pagina, error } = useConsulta(
    () => (rangoValido(rango) ? servicios.cuadernos.movimientos(rango, aplicados, cuantos) : Promise.resolve({ movimientos: [], total: 0 })),
    [...pedido, cuantos],
  );
  const movimientos = pagina?.movimientos;
  const { datos: resumen } = useConsulta(
    () => (rangoValido(rango) ? servicios.cuadernos.resumen(rango, aplicados) : Promise.resolve(RESUMEN_VACIO)),
    pedido,
  );
  const { datos: cambios } = useConsulta(() => servicios.cuadernos.cambiosRecientes(), [vuelta]);
  // La caja no sigue los filtros: es la caja entera del período.
  const { datos: caja, error: errorCaja } = useConsulta(
    () => (rangoValido(rango) ? servicios.cuadernos.caja(rango) : Promise.resolve(null)),
    [rango.desde, rango.hasta, vuelta],
  );

  const periodo = rangoValido(rango)
    ? rango.desde === rango.hasta
      ? `del ${diaLegible(rango.desde)}`
      : `del ${diaLegible(rango.desde)} al ${diaLegible(rango.hasta)}`
    : '';
  const textoFiltros = describirFiltros(aplicados, categorias);

  // Período y filtros quedan siempre a la vista: si el pedido falla (por ejemplo, un período de
  // más de un año), se corrige desde ahí sin recargar la página.
  const cabecera = (
    <>
      {/* Solo en papel o PDF: qué local, qué período y con qué filtros (HU-027). */}
      <div className="solo-impresion encabezado-impreso">
        <h1>Cuadernos de {local}</h1>
        <p>Período: {periodo.replace(/^del /, '')}</p>
        <p>Filtros: {textoFiltros}</p>
        <p>Emitido el {fechaHora(new Date())}</p>
      </div>

      <div className="reportes-periodo no-imprimir">
        <FiltroFechas valor={rango} onChange={setRango} />
        {puedeExportar && rangoValido(rango) && !error && (
          <div className="acciones reportes-exportar">
            {/* El Excel lo arma el servidor con el mismo período y filtros que se ven (HU-027). */}
            <a className="boton boton-secundario boton-normal" href={servicios.cuadernos.urlExcel(rango, aplicados)} download>
              Bajar Excel
            </a>
            {/* El PDF sale de la impresión del navegador: "Guardar como PDF" en el diálogo. */}
            <Button onClick={() => window.print()}>PDF / Imprimir</Button>
          </div>
        )}
      </div>
      <FiltrosMovimientos valor={filtros} onChange={setFiltros} categorias={categorias} />
    </>
  );

  if (error)
    return (
      <>
        {cabecera}
        <p className="aviso-reportes" role="alert">
          {error}
        </p>
      </>
    );
  if (!movimientos || !resumen || !cambios)
    return (
      <>
        {cabecera}
        <p className="cargando">Cargando los reportes…</p>
      </>
    );

  const proporcion = resumen.ingresos > 0 ? Math.round((resumen.egresos / resumen.ingresos) * 100) : null;

  const verMes = (mes: number) => {
    setRango(rangoDelMes(anio, mes));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {cabecera}

      <div className="panel">
        {/* "Resultado" es lo que ganó o perdió el local; "Caja" es el efectivo que quedó (el haber). No son lo mismo. */}
        <div className="panel-completo indicadores-4 indicadores-compactos">
          <KpiCard titulo="Ingresos del período" valor={pesosEnteros(resumen.ingresos)} variante="positiva" />
          <KpiCard titulo="Gastos del período" valor={pesosEnteros(resumen.egresos)} variante="negativa" />
          <KpiCard
            titulo="Resultado del período"
            valor={pesosEnteros(resumen.saldo)}
            variante={resumen.saldo >= 0 ? 'positiva' : 'negativa'}
            pie={proporcion === null ? 'Ingresos menos gastos' : `Los gastos son el ${proporcion} % de los ingresos`}
          />
          <KpiCard
            titulo="Caja al cierre"
            valor={caja?.haberAlFinal == null ? 'Sin dato' : pesosEnteros(caja.haberAlFinal)}
            variante={caja?.haberAlFinal == null ? 'neutra' : caja.haberAlFinal < 0 ? 'negativa' : 'positiva'}
            pie={!caja ? '' : !caja.inicial ? 'Falta el haber inicial' : 'Efectivo en la caja (haber)'}
          />
        </div>

        <Card
          titulo={`Movimientos ${periodo}`}
          nota={
            pagina && pagina.total > movimientos.length
              ? `Se muestran ${movimientos.length.toLocaleString('es-AR')} de ${pagina.total.toLocaleString('es-AR')}. Los totales y el Excel incluyen todos.`
              : undefined
          }
          className="panel-completo"
        >
          <DataTable<Movimiento>
            filas={movimientos}
            clave={(m) => m.id}
            vacio={textoFiltros === 'Ninguno' ? 'No hay movimientos cargados en este período.' : 'Ningún movimiento coincide con los filtros.'}
            columnas={columnasMovimiento(true, acciones)}
          />
          {pagina && pagina.total > movimientos.length && (
            <div className="acciones ver-mas no-imprimir">
              <Button onClick={() => setCuantos((c) => c + PARTE)}>
                Ver {Math.min(PARTE, pagina.total - movimientos.length).toLocaleString('es-AR')} más
              </Button>
            </div>
          )}
        </Card>

        <TarjetaCaja caja={caja} error={errorCaja} puedeCargarInicial={puedeCargarInicial} onCambio={onCambio} />

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

        <ResumenAnual anio={anio} onAnio={setAnio} onVerMes={verMes} vuelta={vuelta} />

        <Card
          titulo="Últimos cambios"
          nota="Cada alta, corrección o anulación queda anotada. No se puede modificar."
          className="panel-completo no-imprimir"
        >
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
    </>
  );
}

/** Corregir un movimiento: los mismos campos, con fecha y turno a la vista y el motivo obligatorio. */
function Correccion({
  movimiento,
  categorias,
  onCerrar,
  onGuardada,
}: {
  movimiento: Movimiento;
  categorias: Record<TipoMovimiento, Categoria[]>;
  onCerrar(): void;
  onGuardada(): void;
}) {
  const [borrador, setBorrador] = useState<Borrador>(() => deMovimiento(movimiento));
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    const problema = problemaDeMonto(borrador.monto);
    const datos = datosDe(borrador);
    if (problema || !datos) {
      setAviso(problema ?? MONTO_ILEGIBLE);
      return;
    }
    setGuardando(true);
    try {
      const sumarAVenta = !movimiento.ventaDelDebitoId && sumaVenta(borrador);
      await servicios.cuadernos.corregir(movimiento.id, { ...datos, sumarAVenta }, borrador.motivo);
    } catch (err) {
      setAviso((err as Error).message);
      return;
    } finally {
      setGuardando(false);
    }
    onGuardada();
  };

  return (
    <Modal titulo="Corregir movimiento" onCerrar={onCerrar}>
      {movimiento.ventaDelDebitoId && (
        <p className="nota modal-nota">Tiene su venta con débito: se corrige sola. Si deja de ser con débito, la venta se anula.</p>
      )}
      <FormMovimiento
        borrador={borrador}
        onCambio={(parte) => {
          setBorrador((b) => ({ ...b, ...parte }));
          setAviso('');
        }}
        categorias={categorias}
        fechaYTurno="campos"
        correccion
        ofrecerVenta={!movimiento.ventaDelDebitoId}
        aviso={aviso}
        guardando={guardando}
        textoGuardar="Guardar corrección"
        onGuardar={guardar}
        acciones={
          <Button onClick={onCerrar}>
            Cancelar <Tecla id="volver" />
          </Button>
        }
      />
    </Modal>
  );
}

/** Anular pide un motivo. El movimiento deja de sumar pero queda en el historial. */
function Anulacion({ movimiento, onCerrar, onAnulado }: { movimiento: Movimiento; onCerrar(): void; onAnulado(): void }) {
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState('');
  const anular = async () => {
    if (!motivo.trim()) return;
    try {
      await servicios.cuadernos.anular(movimiento.id, motivo);
    } catch (err) {
      setAviso((err as Error).message);
      return;
    }
    onAnulado();
  };
  return (
    <Modal
      titulo="¿Anulás este movimiento?"
      onCerrar={onCerrar}
      onConfirmar={anular}
      acciones={
        <>
          <Button onClick={onCerrar}>
            No, dejarlo <Tecla id="volver" />
          </Button>
          <Button variante="peligro" onClick={anular} disabled={!motivo.trim()}>
            Sí, anular <Tecla id="confirmar" />
          </Button>
        </>
      }
    >
      <p>
        {nombreTipo(movimiento.tipo)} del {diaLegible(movimiento.fecha)}, {movimiento.categoria}, por <strong>{pesos(movimiento.monto)}</strong>. Deja de
        sumar en los saldos, pero sigue visible en el historial.
        {movimiento.ventaDelDebitoId && ' También se anula su venta con débito.'}
      </p>
      <label className="campo">
        <span>Motivo</span>
        <input
          className="campo-texto"
          autoFocus
          maxLength={200}
          value={motivo}
          placeholder="Por ejemplo: cargado dos veces"
          onChange={(e) => setMotivo(e.target.value)}
        />
      </label>
      <p className="login-error" role="alert">
        {aviso}
      </p>
    </Modal>
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
