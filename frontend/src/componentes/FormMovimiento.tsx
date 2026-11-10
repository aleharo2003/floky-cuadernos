import { type FormEvent, type ReactNode, type Ref } from 'react';
import { Tecla } from '../atajos/Atajos';
import { fechaIso } from '../lib/formato';
import { MEDIO_EN_FRASE, NOMBRE_MEDIO, type Categoria, type MedioPago, type TipoMovimiento, type Turno } from '../types';
import Badge from './Badge';
import Button from './Button';
import CampoDescripcion from './CampoDescripcion';
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
  /** Gasto con un medio que suma venta: sumar también la venta, como en el cuaderno (ADR-0010, ADR-0013). */
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


/** Valor de la opción "+ Nueva categoría…" del desplegable: nunca es el id de una categoría. */
const NUEVA = '__nueva__';

interface Props {
  borrador: Borrador;
  onCambio(parte: Partial<Borrador>): void;
  categorias: Record<TipoMovimiento, Categoria[]>;
  /** Solo el dueño ve "+ Nueva categoría…" al final de la lista. */
  onNuevaCategoria?(): void;
  /**
   * Al cargar, avisa "No es hoy" al lado de la fecha, para no pasar un día atrasado sin querer.
   * Al corregir no hace falta: la fecha de un movimiento viejo casi nunca es hoy.
   */
  avisarSiNoEsHoy?: boolean;
  /** Corrección: pide el motivo. */
  correccion?: boolean;
  /**
   * Mostrar el tilde "Sumarlo también a la venta" en un gasto que no sea en efectivo. Al cargar,
   * siempre; al corregir, solo si el gasto no tiene ya su venta (ADR-0012, ADR-0014).
   */
  ofrecerVenta?: boolean;
  /** Los medios con los que el tilde viene marcado en este local, según los ajustes del dueño. */
  mediosVenta: MedioPago[];
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
  avisarSiNoEsHoy = false,
  correccion = false,
  ofrecerVenta = !correccion,
  mediosVenta,
  campoCategoria,
  aviso,
  avisoOk,
  guardando,
  textoGuardar,
  onGuardar,
  acciones,
}: Props) {
  const noEsHoy = avisarSiNoEsHoy && borrador.fecha !== fechaIso(new Date());

  return (
    <form className="formulario" onSubmit={onGuardar}>
      {/* Siempre a la vista, como Gasto e Ingreso: se carga en el momento, de cualquier turno. */}
      <div className="carga-fecha-turno">
        <label className="campo">
          <span className="campo-rotulo-con-aviso">
            Fecha
            {noEsHoy && <Badge tono="aviso">No es hoy</Badge>}
          </span>
          <input className="campo-texto" type="date" required value={borrador.fecha} onChange={(e) => onCambio({ fecha: e.target.value })} />
        </label>
        <div className="campo">
          <span>Turno</span>
          <SegmentedControl etiqueta="Turno" opciones={TURNOS} valor={borrador.turno} onChange={(turno) => onCambio({ turno })} bloque />
        </div>
      </div>
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
      <CampoDescripcion tipo={borrador.tipo} valor={borrador.descripcion} onChange={(descripcion) => onCambio({ descripcion })} />
      <CampoMonto rotulo="Monto" valor={borrador.monto} onChange={(monto) => onCambio({ monto })} />
      <label className="campo">
        <span>Medio de pago</span>
        <select
          value={borrador.medioPago}
          onChange={(e) => {
            const medioPago = e.target.value as MedioPago;
            // El tilde de la venta viene marcado o no según el medio, como lo ajustó el dueño (ADR-0014).
            onCambio({ medioPago, sumarAVenta: mediosVenta.includes(medioPago) });
          }}
        >
          {MEDIOS.map((m) => (
            <option key={m} value={m}>
              {NOMBRE_MEDIO[m]}
            </option>
          ))}
        </select>
      </label>
      {ofrecerVenta && borrador.tipo === 'egreso' && borrador.medioPago !== 'cash' && (
        <label className="campo-tilde">
          <input type="checkbox" checked={borrador.sumarAVenta} onChange={(e) => onCambio({ sumarAVenta: e.target.checked })} />
          <span>
            Sumarlo también a la venta, {MEDIO_EN_FRASE[borrador.medioPago]}
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
