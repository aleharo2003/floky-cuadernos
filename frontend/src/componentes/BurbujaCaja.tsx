import { useState } from 'react';
import { fechaIso, pesos } from '../lib/formato';
import { REFRESCO_MS, useConsulta } from '../lib/useConsulta';
import { servicios } from '../services';

const CLAVE_OCULTA = 'cuadernos:caja-oculta';

/** Si quedó tapada la última vez en este dispositivo, como el saldo de Mercado Pago. */
function ocultaGuardada(): boolean {
  try {
    return localStorage.getItem(CLAVE_OCULTA) === '1';
  } catch {
    return false; // sin almacenamiento: arranca a la vista
  }
}

function guardarOculta(oculta: boolean) {
  try {
    if (oculta) localStorage.setItem(CLAVE_OCULTA, '1');
    else localStorage.removeItem(CLAVE_OCULTA);
  } catch {
    // sin almacenamiento: vale mientras la pestaña siga abierta
  }
}

/**
 * Arriba de Reportes, siempre a la vista: el efectivo que hay hoy en la caja (ADR-0008). No sigue el
 * período ni los filtros de la pantalla: cuenta todo hasta el final de hoy, y nada con fecha futura.
 * El ojito tapa el número por si alguien mira la pantalla.
 */
export default function BurbujaCaja({ vuelta }: { vuelta: number }) {
  const hoy = fechaIso(new Date());
  // Cada 15 segundos: así se ve lo que cargan otras personas, sin recargar la página (ADR-0017).
  const { datos: caja, error } = useConsulta(() => servicios.cuadernos.caja({ desde: hoy, hasta: hoy }), [hoy, vuelta], { cadaMs: REFRESCO_MS });
  const [oculta, setOculta] = useState(ocultaGuardada);

  const alternar = () => {
    guardarOculta(!oculta);
    setOculta(!oculta);
  };

  const haber = caja?.haberAlFinal ?? null;
  const negativo = haber !== null && haber < 0;
  let valor: string;
  if (error) valor = 'No se pudo calcular';
  else if (!caja) valor = '…';
  else if (!caja.inicial || haber === null) valor = 'Falta el haber inicial';
  else valor = pesos(haber);
  const conNumero = haber !== null && !error;

  return (
    <div className={`burbuja-caja no-imprimir${negativo ? ' burbuja-caja-negativa' : ''}`}>
      <div className="burbuja-caja-texto">
        <span className="burbuja-caja-rotulo">Caja hoy</span>
        {conNumero && oculta ? (
          <strong aria-label="Caja oculta">$ •••••</strong>
        ) : (
          <strong className={conNumero ? '' : 'burbuja-caja-sin'}>{valor}</strong>
        )}
      </div>
      {conNumero && (
        <button type="button" className="burbuja-caja-ojo" onClick={alternar} aria-pressed={oculta} aria-label={oculta ? 'Mostrar la caja' : 'Ocultar la caja'}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            {oculta && <path d="M4 4l16 16" />}
          </svg>
        </button>
      )}
    </div>
  );
}
