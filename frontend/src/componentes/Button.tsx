import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'peligro' | 'texto';
  tamano?: 'normal' | 'chico' | 'grande';
  bloque?: boolean;
}

export default function Button({
  variante = 'secundario',
  tamano = 'normal',
  bloque = false,
  className = '',
  type = 'button',
  ...resto
}: Props) {
  const clases = ['boton', `boton-${variante}`, `boton-${tamano}`, bloque ? 'boton-bloque' : '', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={clases} {...resto} />;
}
