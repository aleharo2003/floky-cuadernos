import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { servicios } from '../services';
import { EVENTO_SESION } from '../services/http';
import type { Permiso, Sesion } from '../types';

interface ValorSesion {
  /** null mientras se pregunta al servidor quién está adentro. */
  sesion: Sesion | null;
  error: string | null;
  /** La sesión se cerró sola (no con "Salir"): la pantalla de ingreso lo explica. */
  sesionCerrada: boolean;
  ingresar(usuario: string, clave: string): Promise<Sesion>;
  salir(): Promise<void>;
  elegirLocal(id: string): Promise<void>;
  puede(permiso: Permiso): boolean;
}

const Contexto = createContext<ValorSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sesionCerrada, setSesionCerrada] = useState(false);

  useEffect(() => {
    servicios.sesion
      .actual()
      .then(setSesion)
      .catch((e: Error) => setError(e.message));
  }, []);

  // La API avisó que la sesión o el local ya no valen: se pregunta de nuevo y las rutas llevan
  // al ingreso, a elegir local o al aviso de sin acceso, según lo que conteste.
  useEffect(() => {
    const revisar = () => {
      servicios.sesion
        .actual()
        .then((nueva) => {
          setSesionCerrada(!nueva.user);
          setSesion(nueva);
        })
        .catch(() => undefined);
    };
    window.addEventListener(EVENTO_SESION, revisar);
    return () => window.removeEventListener(EVENTO_SESION, revisar);
  }, []);

  const ingresar = useCallback(async (usuario: string, clave: string) => {
    const nueva = await servicios.sesion.ingresar(usuario, clave);
    setSesionCerrada(false);
    setSesion(nueva);
    return nueva;
  }, []);

  const salir = useCallback(async () => {
    setSesionCerrada(false);
    setSesion(await servicios.sesion.salir());
  }, []);
  const elegirLocal = useCallback(async (id: string) => setSesion(await servicios.sesion.elegirLocal(id)), []);

  const valor = useMemo<ValorSesion>(
    () => ({
      sesion,
      error,
      sesionCerrada,
      ingresar,
      salir,
      elegirLocal,
      // Ocultar un botón no alcanza: la API vuelve a controlar cada permiso (HU-024).
      puede: (permiso) => !!sesion?.active_tenant?.permissions.includes(permiso),
    }),
    [sesion, error, sesionCerrada, ingresar, salir, elegirLocal],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): ValorSesion {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useSesion necesita ProveedorSesion');
  return valor;
}
