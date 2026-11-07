import { cajaDelTurno } from '../lib/caja';
import { pesos } from '../lib/formato';
import { useConsulta } from '../lib/useConsulta';
import { servicios } from '../services';
import { NOMBRE_TURNO, type Turno } from '../types';

/**
 * En Cargar: el efectivo que debería haber al cerrar el turno que se está cargando, para contar la
 * plata y compararla. Se vuelve a pedir cada vez que se guarda, corrige o anula algo (`vuelta`).
 */
export default function CajaDelTurno({ dia, turno, vuelta }: { dia: string; turno: Turno; vuelta: number }) {
  const { datos: caja, error } = useConsulta(() => servicios.cuadernos.caja({ desde: dia, hasta: dia }), [dia, vuelta]);
  if (error || !caja) return null; // la carga sigue andando aunque la caja no llegue

  const estado = cajaDelTurno(caja, dia, turno);
  const rotulo = `Caja al cerrar la ${NOMBRE_TURNO[turno].toLowerCase()}`;
  if (estado.estado === 'sinInicial') {
    return <p className="caja-turno caja-turno-sin">Todavía no hay haber inicial: el dueño lo carga en Reportes.</p>;
  }
  if (estado.estado === 'antesDelInicial') {
    return <p className="caja-turno caja-turno-sin">Esta fecha es anterior al haber inicial: no hay caja para mostrar.</p>;
  }
  return (
    <p className={`caja-turno${estado.negativo ? ' caja-turno-negativa' : ''}`} role="status" aria-live="polite">
      <span>{rotulo}</span>
      <strong>{pesos(estado.haber)}</strong>
      {estado.negativo && <small>No puede quedar en negativo: revisá lo cargado.</small>}
    </p>
  );
}
