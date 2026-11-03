import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CapaDeAtajos } from '../atajos/Atajos';

export type ItemMenu =
  | { tipo?: 'accion'; etiqueta: string; onElegir(): void; peligro?: boolean }
  | { tipo: 'opcion'; etiqueta: string; marcada: boolean; onElegir(): void }
  | { tipo: 'titulo'; etiqueta: string }
  | { tipo: 'separador' };

interface Props {
  /** Lo que se ve en el botón que abre el menú. */
  contenido: ReactNode;
  /** Nombre del botón para lectores de pantalla, cuando el contenido no alcanza (por ejemplo "⋯"). */
  etiqueta?: string;
  items: ItemMenu[];
  claseBoton?: string;
  /** De qué lado del botón se alinea el menú. */
  alinear?: 'izquierda' | 'derecha';
}


/**
 * Botón que abre una lista de acciones. Se maneja con mouse o con teclado: flechas para moverse,
 * Enter para elegir, Esc para cerrar. Se dibuja sobre la página (portal) para que una tabla con
 * scroll no lo corte.
 */
export default function Menu({ contenido, etiqueta, items, claseBoton = 'boton boton-secundario boton-chico', alinear = 'derecha' }: Props) {
  const id = useId();
  const boton = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [lugar, setLugar] = useState<{ top: number; left?: number; right?: number } | null>(null);

  const cerrar = (devolverFoco = true) => {
    setAbierto(false);
    setLugar(null);
    if (devolverFoco) boton.current?.focus();
  };

  // Se ubica debajo del botón; si abajo no entra, arriba.
  const ubicar = () => {
    if (!boton.current || !lista.current) return;
    const b = boton.current.getBoundingClientRect();
    // Si el botón salió de la pantalla (se scrolleó lejos), el menú ya no tiene sentido.
    if (b.bottom < 0 || b.top > window.innerHeight) {
      cerrar(false);
      return;
    }
    const alto = lista.current.offsetHeight;
    const abajo = b.bottom + 4 + alto <= window.innerHeight;
    const top = abajo ? b.bottom + 4 : Math.max(4, b.top - 4 - alto);
    setLugar(alinear === 'derecha' ? { top, right: window.innerWidth - b.right } : { top, left: b.left });
  };
  useLayoutEffect(() => {
    if (abierto) ubicar();
    // ubicar solo lee refs y props: alcanza con correrlo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  // Al aparecer, el foco va a la primera opción.
  const ubicado = lugar !== null;
  useEffect(() => {
    if (ubicado) elegibles()[0]?.focus({ preventScroll: true });
  }, [ubicado]);

  // Un clic afuera lo cierra. Con scroll o al cambiar el tamaño de la ventana, acompaña al botón.
  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!lista.current?.contains(t) && !boton.current?.contains(t)) cerrar(false);
    };
    document.addEventListener('pointerdown', afuera);
    window.addEventListener('scroll', ubicar, true);
    window.addEventListener('resize', ubicar);
    return () => {
      document.removeEventListener('pointerdown', afuera);
      window.removeEventListener('scroll', ubicar, true);
      window.removeEventListener('resize', ubicar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const elegibles = () => Array.from(lista.current?.querySelectorAll<HTMLElement>('[data-elegible]') ?? []);

  const alTeclear = (e: KeyboardEvent) => {
    const opciones = elegibles();
    const actual = opciones.indexOf(document.activeElement as HTMLElement);
    const ir = (i: number) => opciones[(i + opciones.length) % opciones.length]?.focus();
    if (e.key === 'ArrowDown') ir(actual + 1);
    else if (e.key === 'ArrowUp') ir(actual - 1);
    else if (e.key === 'Home') ir(0);
    else if (e.key === 'End') ir(opciones.length - 1);
    else if (e.key === 'Escape') cerrar();
    else if (e.key === 'Tab') cerrar(false);
    else return;
    // Resuelta acá: los atajos de la pantalla no la vuelven a tomar.
    if (e.key !== 'Tab') e.preventDefault();
  };

  const abrirConTeclado = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setAbierto(true);
    }
  };

  return (
    <>
      <button
        ref={boton}
        type="button"
        className={claseBoton}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        aria-label={etiqueta}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        onKeyDown={abrirConTeclado}
      >
        {contenido}
      </button>
      {abierto &&
        createPortal(
          <CapaDeAtajos>
            <div
              ref={lista}
              id={id}
              role="menu"
              className="menu"
              style={lugar ?? { top: 0, left: 0, visibility: 'hidden' }}
              onKeyDown={alTeclear}
            >
              {items.map((item, i) => {
                if (item.tipo === 'separador') return <div key={i} role="separator" className="menu-separador" />;
                if (item.tipo === 'titulo')
                  return (
                    <div key={i} role="presentation" className="menu-titulo">
                      {item.etiqueta}
                    </div>
                  );
                const opcion = item.tipo === 'opcion';
                return (
                  <button
                    key={i}
                    type="button"
                    data-elegible
                    role={opcion ? 'menuitemradio' : 'menuitem'}
                    aria-checked={opcion ? item.marcada : undefined}
                    tabIndex={-1}
                    className={`menu-item${!opcion && item.peligro ? ' menu-item-peligro' : ''}`}
                    onClick={() => {
                      cerrar();
                      item.onElegir();
                    }}
                  >
                    {opcion && (
                      <span className="menu-marca" aria-hidden="true">
                        {item.marcada ? '✓' : ''}
                      </span>
                    )}
                    {item.etiqueta}
                  </button>
                );
              })}
            </div>
          </CapaDeAtajos>,
          document.body,
        )}
    </>
  );
}
