import { useCallback, useEffect, useState } from 'react';

/** Pide datos a un servicio y los vuelve a pedir cuando cambian las dependencias o se recarga. */
export function useConsulta<T>(pedir: () => Promise<T>, deps: unknown[]) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    let vigente = true;
    pedir()
      .then((d) => {
        if (!vigente) return;
        setDatos(d);
        setError(null);
      })
      .catch((e: Error) => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, vuelta]);

  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  return { datos, error, recargar };
}
