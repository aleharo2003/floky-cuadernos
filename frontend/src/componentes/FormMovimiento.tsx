import { useState, type FormEvent, type ReactNode, type Ref } from 'react';
import { Tecla } from '../atajos/Atajos';
import { diaConNombre, fechaIso } from '../lib/formato';
import { NOMBRE_MEDIO, type Categoria, type MedioPago, type TipoMovimiento, type Turno } from '../types';
import Badge from './Badge';
import Button from './Button';
import { CampoMonto } from './Campos';
import SegmentedControl from './SegmentedControl';

export interface Borrador {
  fecha: string;
  tipo: TipoMovimiento;
  categoriaId: string;
  descripcion: string;
  monto: string;
  medioPago: MedioPago;
  turno: Turno;
  motivo: string;
  /** Gasto con débito: sumar también la venta con débito, como en el cuaderno (ADR-0010). */
  sumarAVenta: boolean;
}

const MEDIOS = Object.keys(NOMBRE_MEDIO) as MedioPago[];
const TIPOS: { valor: TipoMovimiento; etiqueta: string }[] = [
  { valor: 'egreso', etiqueta: 'Gasto' },
  { valor: 'ingreso', etiqueta: 'Ingreso' },
];
const TURNOS: { valor: Turno; etiqueta: string }[] = [
  { valor: 'morning', etiqueta: 'Mañana' },
  { valor: 'night', etiqueta: 'Noche' },
];

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Valor de la opción "+ Nueva categoría…" del desplegable: nunca es el id de una categoría. */
const NUEVA = '__nueva__';

interface Props {
  borrador: Borrador;
  onCambio(parte: Partial<Borrador>): void;
  categorias: Record<TipoMovimiento, Categoria[]>;
  /** Solo el dueño ve "+ Nueva categoría…" al final de la lista. */
  onNuevaCategoria?(): void;
  /**
   * "resumen": fecha y turno en una línea, con un botón para cambiarlos (la carga del día a día).
   * "campos": a la vista desde el principio (una corrección, donde suelen ser lo que se corrige).
   */
  fechaYTurno: 'resumen' | 'campos';
  /** Corrección: pide el motivo. */
  correccion?: boolean;
  /**
   * Mostrar el tilde "Sumarlo también a la venta" en un gasto con débito. Al cargar, siempre; al
   * corregir, solo si el gasto no tiene ya su venta (ADR-0012).
   */
  ofrecerVenta?: boolean;
  campoCategoria?: Ref<HTMLSelectElement>;
  aviso: string;
  /** Confirmación de lo último que se guardó. */
  avisoOk?: string;
  guardando: boolean;
  textoGuardar: string;
  onGuardar(e: FormEvent): void;
  /** Botones extra al lado de Guardar (por ejemplo Cancelar). */
  acciones?: ReactNode;
}

/** Los campos de un movimiento. Lo usan la carga del día y la corrección. */
export default function FormMovimiento({
  borrador,
  onCambio,
  categorias,
  onNuevaCategoria,
  fechaYTurno,
  correccion = false,
  ofrecerVenta = !correccion,
  campoCategoria,
  aviso,
  avisoOk,
  guardando,
  textoGuardar,
  onGuardar,
  acciones,
}: Props) {
  const [cambiando, setCambiando] = useState(false);
  const verCampos = fechaYTurno === 'campos' || cambiando;
  const esHoy = borrador.fecha === fechaIso(new Date());
  const turno = TURNOS.find((t) => t.valor === borrador.turno)?.etiqueta.toLowerCase();

  return (
    <form className="formulario" onSubmit={onGuardar}>
      {fechaYTurno === 'resumen' && (
        <div className="carga-contexto">
          <p>
            <strong>{borrador.fecha ? mayuscula(diaConNombre(borrador.fecha)) : 'Sin fecha'}</strong>, turno {turno}
          </p>
          {!esHoy && <Badge tono="aviso">No es hoy</Badge>}
          <Button
            tamano="chico"
            variante="texto"
            aria-expanded={cambiando}
            aria-label={cambiando ? 'Listo, ocultar fecha y turno' : 'Cambiar fecha o turno'}
            onClick={() => setCambiando((c) => !c)}
          >
            {cambiando ? 'Listo' : 'Cambiar'}
          </Button>
        </div>
      )}
      {verCampos && (
        <div className="carga-fecha-turno">
          <label className="campo">
            <span>Fecha</span>
            <input className="campo-texto" type="date" required value={borrador.fecha} onChange={(e) => onCambio({ fecha: e.target.value })} />
          </label>
          <div className="campo">
            <span>Turno</span>
            <SegmentedControl etiqueta="Turno" opciones={TURNOS} valor={borrador.turno} onChange={(turno) => onCambio({ turno })} bloque />
          </div>
        </div>
      )}
      <div className="campo">
        <span>Tipo</span>
        <SegmentedControl etiqueta="Tipo" opciones={TIPOS} valor={borrador.tipo} onChange={(tipo) => onCambio({ tipo, categoriaId: '' })} bloque />
      </div>
      <label className="campo">
        <span>Categoría</span>
        <select
          ref={campoCategoria}
          required
          value={borrador.categoriaId}
          onChange={(e) => {
            // La última opción no es una categoría: abre la ventana para crear una nueva.
            if (e.target.value === NUEVA) onNuevaCategoria?.();
            else onCambio({ categoriaId: e.target.value });
          }}
        >
          <option value="">Elegí una categoría</option>
          {categorias[borrador.tipo].map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
          {onNuevaCategoria && <option value={NUEVA}>+ Nueva categoría…</option>}
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
          onChange={(e) => onCambio({ descripcion: e.target.value })}
        />
      </label>
      <CampoMonto rotulo="Monto" valor={borrador.monto} onChange={(monto) => onCambio({ monto })} />
      <label className="campo">
        <span>Medio de pago</span>
        <select value={borrador.medioPago} onChange={(e) => onCambio({ medioPago: e.target.value as MedioPago })}>
          {MEDIOS.map((m) => (
            <option key={m} value={m}>
              {NOMBRE_MEDIO[m]}
            </option>
          ))}
        </select>
      </label>
      {ofrecerVenta && borrador.tipo === 'egreso' && borrador.medioPago === 'debit' && (
        <label className="campo-tilde">
          <input type="checkbox" checked={borrador.sumarAVenta} onChange={(e) => onCambio({ sumarAVenta: e.target.checked })} />
          <span>
            Sumarlo también a la venta, con débito
            <small>Como en el cuaderno: se carga una venta por el mismo monto.</small>
          </span>
        </label>
      )}
      {correccion && (
        <label className="campo">
          <span>Motivo de la corrección</span>
          <input
            className="campo-texto"
            type="text"
            required
            maxLength={200}
            value={borrador.motivo}
            placeholder="Por ejemplo: el monto era otro"
            onChange={(e) => onCambio({ motivo: e.target.value })}
          />
        </label>
      )}
      {/* Los dos avisos existen siempre (vacíos no ocupan lugar) para que el lector de pantalla los anuncie al aparecer. */}
      <div className="formulario-mensajes">
        <p className="login-error" role="alert">
          {aviso}
        </p>
        <p className="aviso-ok" role="status">
          {aviso ? '' : avisoOk}
        </p>
      </div>
      <div className="acciones">
        <Button type="submit" variante="primario" disabled={guardando}>
          {textoGuardar} <Tecla id="confirmar" />
        </Button>
        {acciones}
      </div>
    </form>
  );
}
