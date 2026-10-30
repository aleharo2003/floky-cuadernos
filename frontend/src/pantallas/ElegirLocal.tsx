import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSesion } from '../estado/Sesion';

const NOMBRE_ROL = { owner: 'Dueño', editor: 'Carga', viewer: 'Consulta' } as const;

/** Solo la ve quien tiene más de un local (FUN-01). */
export default function ElegirLocal() {
  const { sesion, elegirLocal } = useSesion();
  const navegar = useNavigate();
  const [error, setError] = useState('');

  const elegir = async (id: string) => {
    try {
      await elegirLocal(id);
      navegar('/cuadernos', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="login">
      <header className="login-cabeza">
        <h1>¿En qué local trabajás?</h1>
        <p>Después podés cambiar desde la barra de arriba</p>
      </header>
      <div className="login-cuerpo login-cuerpo-simple">
        <section className="tarjeta">
          <div className="login-lista">
            {sesion?.tenants.map((local) => (
              <button key={local.id} type="button" className="login-usuario" onClick={() => elegir(local.id)}>
                <span className="login-inicial" aria-hidden="true">
                  {local.name[0]}
                </span>
                <span className="login-datos">
                  <strong>{local.name}</strong>
                  <span>{NOMBRE_ROL[local.role]}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="login-error" role="alert">
            {error}
          </p>
        </section>
      </div>
    </div>
  );
}
