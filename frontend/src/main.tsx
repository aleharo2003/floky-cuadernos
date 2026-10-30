import '@fontsource-variable/archivo/wght.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ProveedorAtajos } from './atajos/Atajos';
import { ProveedorSesion } from './estado/Sesion';
import './tokens.css';
import './estilos.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorSesion>
        <ProveedorAtajos>
          <App />
        </ProveedorAtajos>
      </ProveedorSesion>
    </BrowserRouter>
  </StrictMode>,
);
