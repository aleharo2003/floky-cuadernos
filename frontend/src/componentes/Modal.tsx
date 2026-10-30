import { useEffect, useId, useRef, type ReactNode } from 'react';
import { CapaDeAtajos, useAtajo } from '../atajos/Atajos';

interface Props {
  titulo: string;
  onCerrar?(): void;
  /** Acción principal del modal: también se dispara con Enter. */
  onConfirmar?(): void;
  acciones?: ReactNode;
  ancho?: 'normal' | 'ancho';
  children: ReactNode;
}

/** Esc cierra y Enter confirma. Van adentro de la capa del modal para tapar a los de la pantalla. */
function TeclasDelModal({ onCerrar, onConfirmar }: Pick<Props, 'onCerrar' | 'onConfirmar'>) {
  useAtajo('volver', () => onCerrar?.(), { activo: !!onCerrar });
  useAtajo('confirmar', () => onConfirmar?.(), { activo: !!onConfirmar, enCampos: true });
  return null;
}

export default function Modal({ titulo, onCerrar, onConfirmar, acciones, ancho = 'normal', children }: Props) {
  const id = useId();
  const ventana = useRef<HTMLDivElement>(null);

  // Al abrir, el foco pasa al modal (salvo que adentro haya un campo con autoFocus); al cerrar,
  // vuelve a donde estaba.
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    if (!ventana.current?.contains(document.activeElement)) ventana.current?.focus();
    return () => anterior?.focus();
  }, []);

  return (
    <CapaDeAtajos>
      <TeclasDelModal onCerrar={onCerrar} onConfirmar={onConfirmar} />
      <div className="modal-fondo" onClick={onCerrar}>
        <div
          ref={ventana}
          className={`modal modal-${ancho}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={id}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id={id}>{titulo}</h2>
          <div className="modal-cuerpo">{children}</div>
          {acciones && <div className="modal-acciones">{acciones}</div>}
        </div>
      </div>
    </CapaDeAtajos>
  );
}
