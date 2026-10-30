import type { ReactNode } from 'react';

interface Props {
  titulo: string;
  valor: string;
  /** Positiva y negativa llevan filete y cifra de color; neutra va en tinta. */
  variante?: 'positiva' | 'negativa' | 'neutra';
  pie?: ReactNode;
}

export default function KpiCard({ titulo, valor, variante = 'neutra', pie }: Props) {
  return (
    <section className={`tarjeta kpi kpi-${variante}`}>
      <h2>{titulo}</h2>
      <p className="kpi-valor">{valor}</p>
      {pie && <p className="kpi-pie">{pie}</p>}
    </section>
  );
}
