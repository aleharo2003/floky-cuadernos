import { useLayoutEffect, useRef, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
import { cursorDespuesDeFormatear, montoMientrasSeEscribe, montoPegado } from '../lib/formato';

/** Rótulo arriba, control abajo. */
export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
    </label>
  );
}

/**
 * Importe en pesos, en formato argentino: el signo $ fijo adelante, los puntos de miles se ponen
 * solos mientras se escribe y la coma separa los decimales. El punto del teclado escribe la coma,
 * como en las cajas registradoras y en el Excel en castellano.
 */
export function CampoMonto({
  rotulo,
  valor,
  onChange,
  autoFocus,
}: {
  rotulo: string;
  valor: string;
  onChange(v: string): void;
  autoFocus?: boolean;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const cursor = useRef<number | null>(null);

  // Al poner los puntos cambia el largo del texto: el cursor vuelve detrás de lo que se escribió.
  useLayoutEffect(() => {
    const input = campo.current;
    if (cursor.current === null || !input || document.activeElement !== input) return;
    input.setSelectionRange(cursor.current, cursor.current);
    cursor.current = null;
  }, [valor]);

  const poner = (crudo: string, posicion: number) => {
    const nuevo = montoMientrasSeEscribe(crudo);
    cursor.current = cursorDespuesDeFormatear(crudo, posicion, nuevo);
    onChange(nuevo);
  };

  const alTeclear = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== '.' && e.key !== 'Decimal') return;
    e.preventDefault();
    const t = e.currentTarget;
    const desde = t.selectionStart ?? t.value.length;
    const hasta = t.selectionEnd ?? desde;
    // Una sola coma: si ya hay una fuera de lo seleccionado, el punto no hace nada.
    if (t.value.includes(',') && !t.value.slice(desde, hasta).includes(',')) return;
    poner(`${t.value.slice(0, desde)},${t.value.slice(hasta)}`, desde + 1);
  };

  const alPegar = (e: ClipboardEvent<HTMLInputElement>) => {
    const pegado = montoPegado(e.clipboardData.getData('text'));
    if (pegado === null) return; // lo que no se entiende entra tal cual y el aviso lo explica
    e.preventDefault();
    cursor.current = pegado.length;
    onChange(pegado);
  };

  return (
    <Campo rotulo={rotulo}>
      <span className="monto">
        <span aria-hidden="true">$</span>
        <input
          ref={campo}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          value={valor}
          placeholder="0,00"
          // Al llegar al campo queda todo seleccionado: se pisa el importe tecleando el nuevo.
          onFocus={(e) => e.target.select()}
          onKeyDown={alTeclear}
          onPaste={alPegar}
          onChange={(e) => poner(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        />
      </span>
    </Campo>
  );
}

/** Contador con botones grandes de menos y más. */
export function Contador({
  valor,
  onChange,
  min = 0,
  max = 99,
  etiqueta,
}: {
  valor: number;
  onChange(v: number): void;
  min?: number;
  max?: number;
  etiqueta: string;
}) {
  return (
    <div className="contador" role="group" aria-label={etiqueta}>
      <button type="button" aria-label={`Restar ${etiqueta}`} disabled={valor <= min} onClick={() => onChange(valor - 1)}>
        −
      </button>
      <output>{valor}</output>
      <button type="button" aria-label={`Sumar ${etiqueta}`} disabled={valor >= max} onClick={() => onChange(valor + 1)}>
        +
      </button>
    </div>
  );
}
