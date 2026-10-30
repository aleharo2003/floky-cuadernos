import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tecla } from '../atajos/Atajos';
import Button from '../componentes/Button';
import { useSesion } from '../estado/Sesion';

/** Usuario y contraseña. Con un solo local se entra directo; con varios, se elige (FUN-01). */
export default function Ingreso() {
  const { ingresar } = useSesion();
  const navegar = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const sesion = await ingresar(usuario.trim(), clave);
      navegar(sesion.active_tenant ? '/cuadernos' : '/elegir-local', { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setClave('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <header className="login-cabeza">
        <h1>Cuadernos</h1>
        <p>Ingresos y gastos del local, desde el celular o la PC</p>
      </header>
      <div className="login-cuerpo login-cuerpo-simple">
        <form className="tarjeta" onSubmit={enviar}>
          <h2>Ingresar</h2>
          <label className="campo">
            <span>Usuario</span>
            <input
              className="campo-texto"
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              required
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
            />
          </label>
          <label className="campo">
            <span>Contraseña</span>
            <input
              className="campo-texto"
              type="password"
              autoComplete="current-password"
              required
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
          </label>
          <p className="login-error" role="alert">
            {error}
          </p>
          <Button type="submit" variante="primario" tamano="grande" bloque disabled={enviando || !usuario || !clave}>
            {enviando ? 'Ingresando…' : 'Ingresar'} <Tecla id="confirmar" />
          </Button>
          <p className="nota">¿Te olvidaste la contraseña? Pedile al administrador que te la cambie.</p>
        </form>
      </div>
    </div>
  );
}
