import { useState } from 'react';
import { Tecla } from '../atajos/Atajos';
import { useConsulta } from '../lib/useConsulta';
import { servicios } from '../services';
import { MEDIOS_QUE_PUEDEN_SUMAR_VENTA, NOMBRE_MEDIO, type MedioPago } from '../types';
import Button from './Button';
import Modal from './Modal';

/** Avisa que los ajustes cambiaron, para que la carga los vuelva a pedir sin recargar la página. */
export const EVENTO_AJUSTES = 'cuadernos:ajustes';

/** Solo el dueño: con qué medios de pago el gasto viene con "sumar también la venta" marcado (ADR-0014). */
export default function AjustesDelLocal({ local, onCerrar }: { local: string; onCerrar(): void }) {
  const { datos, error } = useConsulta(() => servicios.cuadernos.ajustes(), []);
  const [elegidos, setElegidos] = useState<MedioPago[] | null>(null);
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const medios = elegidos ?? datos?.mediosQueSumanVenta ?? [];

  const alternar = (medio: MedioPago, marcado: boolean) => {
    setElegidos(marcado ? [...medios, medio] : medios.filter((m) => m !== medio));
    setAviso('');
  };

  const guardar = async () => {
    if (guardando || !datos) return;
    setGuardando(true);
    try {
      await servicios.cuadernos.guardarAjustes({ mediosQueSumanVenta: medios });
    } catch (err) {
      setAviso((err as Error).message);
      return;
    } finally {
      setGuardando(false);
    }
    window.dispatchEvent(new Event(EVENTO_AJUSTES));
    onCerrar();
  };

  return (
    <Modal
      titulo={`Ajustes de ${local}`}
      onCerrar={onCerrar}
      onConfirmar={() => void guardar()}
      acciones={
        <>
          <Button onClick={onCerrar}>
            Cancelar <Tecla id="volver" />
          </Button>
          <Button variante="primario" disabled={guardando || !datos} onClick={() => void guardar()}>
            Guardar <Tecla id="confirmar" />
          </Button>
        </>
      }
    >
      <fieldset className="ajustes-grupo">
        <legend>Gastos que vienen marcados para sumarse a la venta</legend>
        <p className="nota">
          En cualquier gasto que no sea en efectivo aparece el tilde para sumar también su venta, como en el cuaderno. Con estos medios viene marcado de
          entrada; con los demás, sin marcar. Lo ya cargado queda como está.
        </p>
        {error && <p className="login-error">{error}</p>}
        {!datos && !error && <p className="cargando">Cargando…</p>}
        {datos &&
          MEDIOS_QUE_PUEDEN_SUMAR_VENTA.map((m) => (
            <label key={m} className="ajustes-opcion">
              <input type="checkbox" checked={medios.includes(m)} onChange={(e) => alternar(m, e.target.checked)} />
              {NOMBRE_MEDIO[m]}
            </label>
          ))}
      </fieldset>
      <p className="login-error" role="alert">
        {aviso}
      </p>
    </Modal>
  );
}
