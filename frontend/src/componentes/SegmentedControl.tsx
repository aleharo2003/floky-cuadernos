interface Opcion<T extends string | number> {
  valor: T;
  etiqueta: string;
}

interface Props<T extends string | number> {
  opciones: Opcion<T>[];
  valor: T;
  /** NoInfer: el tipo sale de `valor` y `opciones`, no del setter que se pase acá. */
  onChange(valor: NoInfer<T>): void;
  /** Nombre del grupo para lectores de pantalla. */
  etiqueta: string;
  bloque?: boolean;
}

export default function SegmentedControl<T extends string | number>({
  opciones,
  valor,
  onChange,
  etiqueta,
  bloque = false,
}: Props<T>) {
  return (
    <div className={`segmentado${bloque ? ' segmentado-bloque' : ''}`} role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={o.valor === valor}
          onClick={() => onChange(o.valor)}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}
