import { useCallback, useEffect, useState } from 'react';

/** Cada cuánto se vuelve a pedir lo que se ve "en tiempo real" (la caja). */
export const REFRESCO_MS = 15_000;

interface Opciones {
  /**
   * Volver a pedir solo cada tantos milisegundos, para ver lo que cargan otras personas sin recargar
   * la página. Se frena con la pestaña en segundo plano y pide de nuevo al volver a ella.
   */
  cadaMs?: number;
}

/** Pide datos a un servicio y los vuelve a pedir cuando cambian las dependencias o se recarga. */
export function useConsulta<T>(pedir: () => Promise<T>, deps: unknown[], { cadaMs }: Opciones = {}) {
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

  // Mientras llega lo nuevo se sigue viendo lo anterior: nada parpadea.
  useEffect(() => {
    if (!cadaMs) return;
    const visible = () => document.visibilityState === 'visible';
    const reloj = setInterval(() => visible() && recargar(), cadaMs);
    const alVolver = () => visible() && recargar();
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(reloj);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [cadaMs, recargar]);

  return { datos, error, recargar };
}
