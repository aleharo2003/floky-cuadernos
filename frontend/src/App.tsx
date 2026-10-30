import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import Cuadernos from './pantallas/Cuadernos';

/** Barra y página. El ingreso, el local activo y el usuario llegan con HU-012. */
function Marco() {
  return (
    <>
      <header className="barra">
        <div className="barra-int">
          <span className="barra-marca">Cuadernos</span>
        </div>
      </header>
      <main className="pagina">
        <Outlet />
      </main>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Marco />}>
        <Route path="/cuadernos" element={<Cuadernos />} />
      </Route>
      <Route path="*" element={<Navigate to="/cuadernos" replace />} />
    </Routes>
  );
}
