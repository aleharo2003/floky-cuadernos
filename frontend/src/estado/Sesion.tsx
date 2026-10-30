import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { servicios } from '../services';
import type { Permiso, Sesion } from '../types';

interface ValorSesion {
  /** null mientras se pregunta al servidor quién está adentro. */
  sesion: Sesion | null;
  error: string | null;
  ingresar(usuario: string, clave: string): Promise<Sesion>;
  salir(): Promise<void>;
  elegirLocal(id: string): Promise<void>;
  puede(permiso: Permiso): boolean;
}

const Contexto = createContext<ValorSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    servicios.sesion
      .actual()
      .then(setSesion)
      .catch((e: Error) => setError(e.message));
  }, []);

  const ingresar = useCallback(async (usuario: string, clave: string) => {
    const nueva = await servicios.sesion.ingresar(usuario, clave);
    setSesion(nueva);
    return nueva;
  }, []);

  const salir = useCallback(async () => setSesion(await servicios.sesion.salir()), []);
  const elegirLocal = useCallback(async (id: string) => setSesion(await servicios.sesion.elegirLocal(id)), []);

  const valor = useMemo<ValorSesion>(
    () => ({
      sesion,
      error,
      ingresar,
      salir,
      elegirLocal,
      // Ocultar un botón no alcanza: la API vuelve a controlar cada permiso (HU-024).
      puede: (permiso) => !!sesion?.active_tenant?.permissions.includes(permiso),
    }),
    [sesion, error, ingresar, salir, elegirLocal],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ValorSesion {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useSesion necesita ProveedorSesion');
  return valor;
}
