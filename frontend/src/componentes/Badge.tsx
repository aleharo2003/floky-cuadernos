import type { ReactNode } from 'react';

export type Tono = 'positivo' | 'negativo' | 'aviso' | 'info' | 'neutro';

export default function Badge({ tono = 'neutro', children }: { tono?: Tono; children: ReactNode }) {
  return <span className={`badge badge-${tono}`}>{children}</span>;
}
