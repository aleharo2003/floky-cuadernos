import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ATAJOS, TECLAS_BLOQUEADAS, type IdAtajo } from './config';

/**
 * Sistema central de atajos. Hay un solo oyente de teclado para toda la aplicación; las
 * pantallas no escuchan teclas por su cuenta, declaran qué hacen con `useAtajo`.
 *
 * - Si dos componentes declaran el mismo atajo gana el que se montó último: la pantalla le gana
 *   al marco general (F8 factura en la pantalla de factura y, en el resto, lleva a Comprobantes).
 * - Un modal abre una capa nueva: mientras está abierto solo valen los atajos declarados adentro.
 */

/** Si devuelve `false` deja pasar la tecla: no la tomó (por ejemplo, Supr con texto en el campo). */
type Manejador = (e: KeyboardEvent) => unknown;

interface Registro {
  id: IdAtajo;
  capa: number;
  /** Si vale también mientras se escribe en un campo de texto. */
  enCampos: boolean;
  /** Los del marco general: ceden ante cualquier atajo igual que declare la pantalla. */
  deFondo: boolean;
  manejador: { current: Manejador };
}

export type Modo = 'teclado' | 'mouse';

interface Central {
  registrar(registro: Registro): () => void;
  abrirCapa(capa: number): () => void;
  /** Atajos que responden en este momento, para el cartel de ayuda. */
  activos(): Set<IdAtajo>;
  modo: Modo;
}

const ContextoCentral = createContext<Central | null>(null);
const ContextoCapa = createContext(0);

/** Teclas que en un campo de texto sirven para escribir o mover el cursor. */
const esDeEscritura = (tecla: string) =>
  tecla.length === 1 || ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(tecla);

const CAMPO = 'input, textarea, select, [contenteditable="true"]';
/** Donde Enter ya tiene sentido propio: activar el botón o el enlace, o bajar de renglón. */
const ENTER_PROPIO = 'button, a, textarea, select';

export function coincide(e: { key: string }, id: IdAtajo): boolean {
  return (ATAJOS[id].teclas as string[]).includes(e.key);
}

export function ProveedorAtajos({ children }: { children: ReactNode }) {
  const registros = useRef<Registro[]>([]);
  const capas = useRef<number[]>([]);
  const [modo, setModo] = useState<Modo>('mouse');

  const capaActiva = () => Math.max(0, ...capas.current);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta') setModo('teclado');
      // Si un control ya resolvió la tecla por su cuenta, no se pisa.
      const resuelta = e.defaultPrevented;
      if (TECLAS_BLOQUEADAS.includes(e.key)) e.preventDefault();
      if (resuelta || e.ctrlKey || e.metaKey || e.altKey) return;

      const destino = e.target as HTMLElement;
      const enCampo = !!destino.closest?.(CAMPO);
      const capa = capaActiva();

      // Primero los de la pantalla y después los de fondo; dentro de cada grupo, del más nuevo
      // al más viejo. El primero que corresponde se queda con la tecla.
      const enOrden = [...registros.current].reverse().sort((a, b) => Number(a.deFondo) - Number(b.deFondo));
      for (const r of enOrden) {
        if (r.capa !== capa || !coincide(e, r.id)) continue;
        if (enCampo && esDeEscritura(e.key) && !r.enCampos) continue;
        if (e.key === 'Enter' && destino.closest?.(ENTER_PROPIO)) continue;
        if (r.manejador.current(e) === false) continue;
        e.preventDefault();
        return;
      }
    };
    const alApuntar = () => setModo('mouse');

    window.addEventListener('keydown', alTeclear);
    window.addEventListener('pointerdown', alApuntar);
    return () => {
      window.removeEventListener('keydown', alTeclear);
      window.removeEventListener('pointerdown', alApuntar);
    };
  }, []);

  // El modo queda en <html> para que los estilos marquen más fuerte la selección con teclado.
  useEffect(() => {
    document.documentElement.dataset.modo = modo;
  }, [modo]);

  const registrar = useCallback((registro: Registro) => {
    registros.current.push(registro);
    return () => {
      registros.current = registros.current.filter((r) => r !== registro);
    };
  }, []);

  const abrirCapa = useCallback((capa: number) => {
    capas.current.push(capa);
    return () => {
      capas.current.splice(capas.current.lastIndexOf(capa), 1);
    };
  }, []);

  const activos = useCallback(() => {
    const capa = capaActiva();
    return new Set(registros.current.filter((r) => r.capa === capa).map((r) => r.id));
  }, []);

  const central = useMemo(() => ({ registrar, abrirCapa, activos, modo }), [registrar, abrirCapa, activos, modo]);
  return <ContextoCentral.Provider value={central}>{children}</ContextoCentral.Provider>;
}

function useCentral(): Central {
  const central = useContext(ContextoCentral);
  if (!central) throw new Error('Los atajos se usan dentro de <ProveedorAtajos>.');
  return central;
}

interface Opciones {
  /** Falso para apagarlo sin dejar de llamar al hook (por ejemplo, si el rol no puede cobrar). */
  activo?: boolean;
  /** Que valga también con el cursor en un campo de texto. Las teclas F y Esc valen siempre. */
  enCampos?: boolean;
  /** Para los atajos del marco general: la pantalla les gana si declara el mismo. */
  deFondo?: boolean;
}

/** Declara qué hace un atajo mientras este componente está en pantalla. */
export function useAtajo(
  id: IdAtajo,
  manejador: Manejador,
  { activo = true, enCampos = false, deFondo = false }: Opciones = {},
) {
  const { registrar } = useCentral();
  const capa = useContext(ContextoCapa);
  const ultimo = useRef(manejador);
  ultimo.current = manejador;

  // useLayoutEffect: el atajo queda registrado (y se da de baja) en el mismo momento en que la
  // pantalla cambia, no un instante después. Si no, una tecla muy rápida cae en el hueco.
  useLayoutEffect(() => {
    if (!activo) return;
    return registrar({ id, capa, enCampos, deFondo, manejador: ultimo });
  }, [registrar, id, capa, enCampos, deFondo, activo]);
}

/**
 * Capa nueva de atajos (la usa Modal). Todo lo que se declare adentro tapa a lo de afuera
 * mientras el componente esté montado.
 */
export function CapaDeAtajos({ children }: { children: ReactNode }) {
  const { abrirCapa } = useCentral();
  const capa = useContext(ContextoCapa) + 1;
  useLayoutEffect(() => abrirCapa(capa), [abrirCapa, capa]);
  return <ContextoCapa.Provider value={capa}>{children}</ContextoCapa.Provider>;
}

export function useModo(): Modo {
  return useCentral().modo;
}

export function useAtajosActivos(): () => Set<IdAtajo> {
  return useCentral().activos;
}

/** La tecla de un atajo, dibujada como tecla. Sale de la configuración: si cambia, cambia acá. */
export function Tecla({ id }: { id: IdAtajo }) {
  return (
    <kbd className="tecla" aria-hidden="true">
      {ATAJOS[id].etiqueta}
    </kbd>
  );
}
