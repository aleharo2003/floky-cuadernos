import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { useSesion } from './estado/Sesion';
import Cuadernos from './pantallas/Cuadernos';
import ElegirLocal from './pantallas/ElegirLocal';
import Ingreso from './pantallas/Ingreso';

function Cargando() {
  return <p className="cargando">Cargando…</p>;
}

function Barra() {
  const { sesion, salir, elegirLocal } = useSesion();
  const navegar = useNavigate();
  if (!sesion?.user || !sesion.active_tenant) return null;
  const activo = sesion.active_tenant;

  return (
    <header className="barra">
      <div className="barra-int">
        <span className="barra-marca">Cuadernos</span>
        <div className="barra-estado">
          {/* El selector aparece solo con más de un local: con uno no hay nada que elegir. */}
          {sesion.tenants.length > 1 ? (
            <select className="barra-local" aria-label="Local" value={activo.id} onChange={(e) => void elegirLocal(e.target.value)}>
              {sesion.tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="barra-local-nombre">{activo.name}</span>
          )}
          <span className="barra-usuario">{sesion.user.name}</span>
          <button
            type="button"
            className="barra-salir"
            onClick={async () => {
              await salir();
              navegar('/ingresar', { replace: true });
            }}
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}

/** Deja pasar solo con sesión y local activo; si no, manda a donde corresponde (FUN-01). */
function ConLocal() {
  const { sesion, error } = useSesion();
  if (error) return <p className="vacio">{error}</p>;
  if (!sesion) return <Cargando />;
  if (!sesion.user) return <Navigate to="/ingresar" replace />;
  if (!sesion.active_tenant) {
    if (sesion.tenants.length > 0) return <Navigate to="/elegir-local" replace />;
    return (
      <div className="aviso-pantalla">
        <h1>Tu usuario no tiene acceso a ningún local</h1>
        <p>Pedile al administrador que te dé acceso.</p>
      </div>
    );
  }
  return (
    <>
      <Barra />
      <main className="pagina">
        {/* key: al cambiar de local la pantalla arranca de cero y pide los datos del nuevo. */}
        <Outlet key={sesion.active_tenant.id} />
      </main>
    </>
  );
}

function SoloSinSesion({ children }: { children: React.ReactNode }) {
  const { sesion } = useSesion();
  if (!sesion) return <Cargando />;
  if (sesion.user && sesion.active_tenant) return <Navigate to="/cuadernos" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/ingresar"
        element={
          <SoloSinSesion>
            <Ingreso />
          </SoloSinSesion>
        }
      />
      <Route path="/elegir-local" element={<ElegirLocal />} />
      <Route element={<ConLocal />}>
        <Route path="/cuadernos" element={<Cuadernos />} />
      </Route>
      <Route path="*" element={<Navigate to="/cuadernos" replace />} />
    </Routes>
  );
}
