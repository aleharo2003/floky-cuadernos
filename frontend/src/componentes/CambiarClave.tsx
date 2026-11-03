import { useState } from 'react';
import { Tecla } from '../atajos/Atajos';
import { servicios } from '../services';
import Button from './Button';
import Modal from './Modal';

/** La persona cambia su propia contraseña. Al terminar, los otros dispositivos quedan afuera. */
export default function CambiarClave({ onCerrar }: { onCerrar(): void }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);

  const guardar = async () => {
    if (guardando || listo) return;
    if (!actual || !nueva) return setAviso('Completá la contraseña actual y la nueva.');
    if (nueva !== repetida) return setAviso('La contraseña nueva y la repetida no coinciden.');
    if (nueva === actual) return setAviso('La contraseña nueva tiene que ser distinta de la actual.');
    setGuardando(true);
    try {
      await servicios.sesion.cambiarClave(actual, nueva);
      setListo(true);
      setAviso('');
    } catch (err) {
      setAviso((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  if (listo) {
    return (
      <Modal
        titulo="Contraseña cambiada"
        onCerrar={onCerrar}
        onConfirmar={onCerrar}
        acciones={
          <Button variante="primario" onClick={onCerrar}>
            Listo <Tecla id="confirmar" />
          </Button>
        }
      >
        <p>Desde ahora entrás con la contraseña nueva. Si tenías los cuadernos abiertos en otro celular o en otra compu, ahí se cerró la sesión.</p>
      </Modal>
    );
  }

  return (
    <Modal
      titulo="Cambiar tu contraseña"
      onCerrar={onCerrar}
      onConfirmar={() => void guardar()}
      acciones={
        <>
          <Button onClick={onCerrar}>
            Cancelar <Tecla id="volver" />
          </Button>
          <Button variante="primario" disabled={guardando} onClick={() => void guardar()}>
            Cambiar contraseña <Tecla id="confirmar" />
          </Button>
        </>
      }
    >
      <form className="formulario" onSubmit={(e) => e.preventDefault()}>
        <label className="campo">
          <span>Contraseña actual</span>
          <input className="campo-texto" type="password" autoComplete="current-password" autoFocus value={actual} onChange={(e) => setActual(e.target.value)} />
        </label>
        <label className="campo">
          <span>Contraseña nueva</span>
          <input className="campo-texto" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        </label>
        <label className="campo">
          <span>Repetí la contraseña nueva</span>
          <input className="campo-texto" type="password" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} />
        </label>
        <p className="nota">Usá por lo menos 8 caracteres, que no sean solo números ni una contraseña muy común.</p>
        <p className="login-error" role="alert">
          {aviso}
        </p>
      </form>
    </Modal>
  );
}
