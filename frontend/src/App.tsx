import { useState } from 'react';
import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import BotonSalir from './componentes/BotonSalir';
import Menu, { type ItemMenu } from './componentes/Menu';
import CambiarClave from './componentes/CambiarClave';
import { useSesion } from './estado/Sesion';
import { type PreferenciaTema, useTema } from './lib/tema';
import Cuadernos from './pantallas/Cuadernos';
import ElegirLocal from './pantallas/ElegirLocal';
import Ingreso from './pantallas/Ingreso';

function Cargando() {
  return <p className="cargando">Cargando…</p>;
}

/** Lo que la persona hace con su propia cuenta. Pensado para sumar opciones más adelante. */
function MenuUsuario({ nombre, onCambiarClave }: { nombre: string; onCambiarClave(): void }) {
  const { salir } = useSesion();
  const navegar = useNavigate();
  const [tema, elegirTema] = useTema();
  const opcionTema = (valor: PreferenciaTema, etiqueta: string): ItemMenu => ({
    tipo: 'opcion',
    etiqueta,
    marcada: tema === valor,
    onElegir: () => elegirTema(valor),
  });
  return (
    <Menu
      claseBoton="barra-usuario barra-usuario-boton"
      contenido={
        <>
          {nombre} <span aria-hidden="true">▾</span>
        </>
      }
      etiqueta={`${nombre}: opciones de tu cuenta`}
      items={[
        { etiqueta: 'Cambiar contraseña', onElegir: onCambiarClave },
        { tipo: 'separador' },
        { tipo: 'titulo', etiqueta: 'Tema' },
        opcionTema('claro', 'Claro'),
        opcionTema('oscuro', 'Oscuro'),
        opcionTema('auto', 'Como el dispositivo'),
        { tipo: 'separador' },
        {
          etiqueta: 'Salir',
          onElegir: async () => {
            await salir();
            navegar('/ingresar', { replace: true });
          },
        },
      ]}
    />
  );
}

function Barra() {
  const { sesion, elegirLocal } = useSesion();
  const [cambiandoClave, setCambiandoClave] = useState(false);
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
          <MenuUsuario nombre={sesion.user.name} onCambiarClave={() => setCambiandoClave(true)} />
        </div>
      </div>
      {cambiandoClave && <CambiarClave onCerrar={() => setCambiandoClave(false)} />}
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
        <BotonSalir className="boton boton-secundario" />
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
