import { useState } from 'react';
import { Tecla } from '../atajos/Atajos';
import { diaLegible, fechaHora, leerMonto, pesos, problemaDeMonto } from '../lib/formato';
import { servicios } from '../services';
import { NOMBRE_TURNO, type Caja, type CierreCaja, type HaberInicial } from '../types';
import Badge from './Badge';
import Button from './Button';
import { CampoMonto } from './Campos';
import Card from './Card';
import DataTable from './DataTable';
import Modal from './Modal';

interface Props {
  /** La pide la pantalla, porque también la usa el indicador de caja. */
  caja: Caja | null;
  error: string | null;
  puedeCargarInicial: boolean;
  /** Avisa que el haber inicial cambió, para que la pantalla actualice lo demás. */
  onCambio(): void;
}

/**
 * La caja en efectivo, turno por turno, como el cuaderno "Comedor TJ" (P-01, ADR-0008).
 * Haber = haber anterior + ventas en efectivo, menos gastos en efectivo. No sigue los filtros de la lista.
 */
/** Unos 30 días de dos turnos. */
const TURNOS_POR_PARTE = 62;

export default function TarjetaCaja({ caja, error, puedeCargarInicial, onCambio }: Props) {
  const [editando, setEditando] = useState(false);
  const [verTurnos, setVerTurnos] = useState(TURNOS_POR_PARTE);

  const titulo = 'Caja en efectivo (haber) por turno';
  if (error) return <Card titulo={titulo} className="panel-ancho panel-completo"><p className="vacio">{error}</p></Card>;
  if (!caja) return <Card titulo={titulo} className="panel-ancho panel-completo"><p className="cargando">Cargando…</p></Card>;

  const guardado = () => {
    setEditando(false);
    onCambio();
  };

  if (!caja.inicial) {
    return (
      <Card titulo={titulo} className="panel-ancho panel-completo">
        {puedeCargarInicial ? (
          <>
            <p className="nota nota-inicial">
              Para calcular la caja hace falta el punto de partida: cuánta plata en efectivo hay en la caja. Desde ahí, cada movimiento en efectivo
              que se cargue la suma o la resta.
            </p>
            <FormularioInicial onGuardado={guardado} />
          </>
        ) : (
          <p className="vacio">Falta el haber inicial de la caja. Lo carga el dueño del local.</p>
        )}
      </Card>
    );
  }

  const negativos = caja.cierres.filter((c) => c.negativo);
  // Un año son más de 700 turnos: se muestran los últimos y el resto a pedido.
  const todos = [...caja.cierres].reverse();
  const ultimos = todos.slice(0, verTurnos);

  return (
    <Card
      titulo={titulo}
      nota={textoInicial(caja.inicial)}
      className="panel-ancho panel-completo"
      accion={
        puedeCargarInicial && (
          <Button tamano="chico" className="no-imprimir" onClick={() => setEditando(true)}>
            Cambiar haber inicial
          </Button>
        )
      }
    >
      {negativos.length > 0 && (
        <p className="aviso-caja" role="alert">
          La caja no puede quedar negativa: revisá si falta cargar una venta o sobra un gasto en{' '}
          {negativos.map((c) => `${diaLegible(c.fecha)} (${NOMBRE_TURNO[c.turno].toLowerCase()})`).join(', ')}.
        </p>
      )}
      <DataTable<CierreCaja>
        filas={ultimos}
        clave={(c) => `${c.fecha}-${c.turno}`}
        vacio="Sin cierres en este período."
        columnas={[
          { titulo: 'Fecha', render: (c) => diaLegible(c.fecha) },
          { titulo: 'Turno', render: (c) => NOMBRE_TURNO[c.turno] },
          { titulo: 'Haber anterior', numerica: true, render: (c) => pesos(c.antes) },
          { titulo: 'Ventas', numerica: true, render: (c) => pesos(c.ventas) },
          { titulo: 'Cobrado sin efectivo', numerica: true, render: (c) => pesos(-c.sinEfectivo) },
          { titulo: 'Gastos en efectivo', numerica: true, render: (c) => pesos(-c.gastosEfectivo) },
          {
            titulo: 'Haber',
            numerica: true,
            render: (c) =>
              c.negativo ? (
                <span className="texto-negativo">
                  {pesos(c.despues)} <Badge tono="negativo">Revisar</Badge>
                </span>
              ) : (
                <strong>{pesos(c.despues)}</strong>
              ),
          },
        ]}
      />
      {todos.length > ultimos.length && (
        <div className="acciones ver-mas no-imprimir">
          <Button onClick={() => setVerTurnos((n) => n + TURNOS_POR_PARTE)}>
            Ver {Math.min(TURNOS_POR_PARTE, todos.length - ultimos.length)} turnos más (quedan {todos.length - ultimos.length})
          </Button>
        </div>
      )}
      <p className="nota nota-caja">
        Lo cobrado con Mercado Pago, tarjeta o transferencia es venta, pero no entra a la caja. Los gastos pagados por transferencia o
        tarjeta tampoco salen de la caja.
      </p>
      {editando && <ModalInicial inicial={caja.inicial} onCerrar={() => setEditando(false)} onGuardado={guardado} />}
    </Card>
  );
}

const textoInicial = (i: HaberInicial) =>
  `Arranca con ${pesos(i.monto)}; cada movimiento en efectivo la suma o la resta. Lo cargó ${i.cargadoPor} el ${fechaHora(i.cargadoEl)}.`;

/** El monto del haber inicial: uno solo, sin fecha ni turno (ADR-0017). El motivo se pide solo al cambiarlo. */
function useFormularioInicial(inicial?: HaberInicial) {
  const [monto, setMonto] = useState(inicial ? inicial.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '');
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async (onGuardado: () => void) => {
    if (guardando) return;
    const problema = problemaDeMonto(monto, { permitirCero: true });
    if (problema) return setAviso(problema);
    const importe = leerMonto(monto);
    setGuardando(true);
    try {
      await servicios.cuadernos.cargarHaberInicial(importe, motivo);
    } catch (err) {
      setAviso((err as Error).message);
      return;
    } finally {
      setGuardando(false);
    }
    onGuardado();
  };

  const campos = (
    <>
      <CampoMonto rotulo="Haber inicial (efectivo en la caja)" valor={monto} onChange={setMonto} />
    </>
  );

  return { campos, motivo, setMotivo, aviso, guardando, guardar };
}

function FormularioInicial({ onGuardado }: { onGuardado(): void }) {
  const f = useFormularioInicial();
  return (
    <form
      className="formulario formulario-inicial"
      onSubmit={(e) => {
        e.preventDefault();
        void f.guardar(onGuardado);
      }}
    >
      {f.campos}
      {/* Vacío no ocupa lugar: antes dejaba un hueco grande arriba del botón. */}
      <div className="formulario-mensajes">
        <p className="login-error" role="alert">
          {f.aviso}
        </p>
      </div>
      <div className="acciones">
        <Button type="submit" variante="primario" disabled={f.guardando}>
          Guardar haber inicial
        </Button>
      </div>
    </form>
  );
}

function ModalInicial({ inicial, onCerrar, onGuardado }: { inicial: HaberInicial; onCerrar(): void; onGuardado(): void }) {
  const f = useFormularioInicial(inicial);
  return (
    <Modal
      titulo="Cambiar el haber inicial"
      onCerrar={onCerrar}
      onConfirmar={() => void f.guardar(onGuardado)}
      acciones={
        <>
          <Button onClick={onCerrar}>
            Cancelar <Tecla id="volver" />
          </Button>
          <Button variante="primario" disabled={f.guardando || !f.motivo.trim()} onClick={() => void f.guardar(onGuardado)}>
            Guardar cambio <Tecla id="confirmar" />
          </Button>
        </>
      }
    >
      <p>Cambia el haber de todos los turnos que siguen. Queda anotado quién lo cambió y por qué.</p>
      <div className="formulario">
        {f.campos}
        <label className="campo">
          <span>Motivo del cambio</span>
          <input
            className="campo-texto"
            maxLength={200}
            value={f.motivo}
            placeholder="Por ejemplo: lo había copiado mal"
            onChange={(e) => f.setMotivo(e.target.value)}
          />
        </label>
      </div>
      <p className="login-error" role="alert">
        {f.aviso}
      </p>
    </Modal>
  );
}
