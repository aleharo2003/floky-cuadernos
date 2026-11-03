import { useNavigate } from 'react-router-dom';
import { useSesion } from '../estado/Sesion';

/** Cierra la sesión y vuelve al ingreso. Va en toda pantalla donde haya alguien adentro. */
export default function BotonSalir({ className = 'barra-salir' }: { className?: string }) {
  const { salir } = useSesion();
  const navegar = useNavigate();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await salir();
        navegar('/ingresar', { replace: true });
      }}
    >
      Salir
    </button>
  );
}
