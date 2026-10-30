import type { ReactNode } from 'react';

interface Props {
  titulo?: string;
  nota?: string;
  accion?: ReactNode;
  className?: string;
  children: ReactNode;
}

export default function Card({ titulo, nota, accion, className = '', children }: Props) {
  return (
    <section className={`tarjeta ${className}`}>
      {(titulo || accion) && (
        <header className="tarjeta-cabeza">
          <div>
            {titulo && <h2>{titulo}</h2>}
            {nota && <p className="nota">{nota}</p>}
          </div>
          {accion}
        </header>
      )}
      {children}
    </section>
  );
}
