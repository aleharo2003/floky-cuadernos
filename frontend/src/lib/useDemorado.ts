import { useEffect, useState } from 'react';

/** Devuelve el valor recién cuando dejó de cambiar un rato: así la búsqueda no consulta en cada tecla. */
export function useDemorado<T>(valor: T, ms = 300): T {
  const [quieto, setQuieto] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setQuieto(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return quieto;
}
