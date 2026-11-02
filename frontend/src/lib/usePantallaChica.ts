import { useEffect, useState } from 'react';

/** Mismo corte que los estilos de celular (700 px). Se actualiza si se gira el teléfono o se achica la ventana. */
const CONSULTA = '(max-width: 700px)';

export function usePantallaChica(): boolean {
  const [chica, setChica] = useState(() => window.matchMedia(CONSULTA).matches);
  useEffect(() => {
    const mq = window.matchMedia(CONSULTA);
    const cambio = () => setChica(mq.matches);
    mq.addEventListener('change', cambio);
    return () => mq.removeEventListener('change', cambio);
  }, []);
  return chica;
}
