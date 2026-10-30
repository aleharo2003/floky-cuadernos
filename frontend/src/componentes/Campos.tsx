import type { ReactNode } from 'react';

/** Rótulo arriba, control abajo. */
export function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
    </label>
  );
}

/** Importe en pesos: el signo $ fijo adelante. */
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
  return (
    <Campo rotulo={rotulo}>
      <span className="monto">
        <span aria-hidden="true">$</span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          value={valor}
          placeholder="0,00"
          // Al llegar al campo queda todo seleccionado: se pisa el importe tecleando el nuevo.
          onFocus={(e) => e.target.select()}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
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
