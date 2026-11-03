import { useState } from 'react';
import { Tecla } from '../atajos/Atajos';
import { servicios } from '../services';
import type { Categoria, TipoMovimiento } from '../types';
import Button from './Button';
import Modal from './Modal';

interface Props {
  tipo: TipoMovimiento;
  onCerrar(): void;
  onCreada(categoria: Categoria): void;
}

/** El dueño agrega una categoría sin salir del formulario de carga (HU-022). */
export default function NuevaCategoria({ tipo, onCerrar, onCreada }: Props) {
  const [nombre, setNombre] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const deQue = tipo === 'ingreso' ? 'de ingreso' : 'de gasto';

  const guardar = async () => {
    if (guardando) return;
    if (!nombre.trim()) return setAviso('Escribí el nombre de la categoría.');
    setGuardando(true);
    try {
      onCreada(await servicios.cuadernos.crearCategoria(nombre, tipo));
    } catch (err) {
      setAviso((err as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      titulo={`Nueva categoría ${deQue}`}
      onCerrar={onCerrar}
      onConfirmar={() => void guardar()}
      acciones={
        <>
          <Button onClick={onCerrar}>
            Cancelar <Tecla id="volver" />
          </Button>
          <Button variante="primario" disabled={guardando} onClick={() => void guardar()}>
            Agregar <Tecla id="confirmar" />
          </Button>
        </>
      }
    >
      <label className="campo">
        <span>Nombre</span>
        <input
          className="campo-texto"
          autoFocus
          maxLength={60}
          value={nombre}
          placeholder={tipo === 'ingreso' ? 'Por ejemplo: Delivery' : 'Por ejemplo: Carnicería'}
          onChange={(e) => {
            setNombre(e.target.value);
            setAviso('');
          }}
        />
      </label>
      <p className="nota">Queda solo en este local. Después la vas a ver en el formulario, los filtros y los reportes.</p>
      <p className="login-error" role="alert">
        {aviso}
      </p>
    </Modal>
  );
}
