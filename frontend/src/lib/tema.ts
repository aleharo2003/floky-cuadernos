import { useEffect, useState } from 'react';

/** Lo que elige la persona. "auto" sigue al dispositivo (modo oscuro del sistema). */
export type PreferenciaTema = 'claro' | 'oscuro' | 'auto';

const CLAVE = 'cuadernos.tema';
const OSCURO = '(prefers-color-scheme: dark)';

export function preferenciaGuardada(): PreferenciaTema {
  try {
    const v = localStorage.getItem(CLAVE);
    if (v === 'claro' || v === 'oscuro') return v;
  } catch {
    // Sin almacenamiento: se sigue al dispositivo.
  }
  return 'auto';
}

/** Pone data-tema en <html>; los colores oscuros de tokens.css cuelgan de ese atributo. */
function aplicar(p: PreferenciaTema) {
  const oscuro = p === 'oscuro' || (p === 'auto' && window.matchMedia(OSCURO).matches);
  document.documentElement.dataset.tema = oscuro ? 'oscuro' : 'claro';
}

/** Se llama una vez antes de dibujar la app, para que no aparezca un instante con el otro tema. */
export function aplicarTemaGuardado() {
  aplicar(preferenciaGuardada());
}

/** La preferencia de este dispositivo. Con "auto", acompaña al sistema si cambia mientras la app está abierta. */
export function useTema(): [PreferenciaTema, (p: PreferenciaTema) => void] {
  const [preferencia, setPreferencia] = useState(preferenciaGuardada);
  useEffect(() => {
    aplicar(preferencia);
    if (preferencia !== 'auto') return;
    const mq = window.matchMedia(OSCURO);
    const cambio = () => aplicar('auto');
    mq.addEventListener('change', cambio);
    return () => mq.removeEventListener('change', cambio);
  }, [preferencia]);
  const elegir = (p: PreferenciaTema) => {
    try {
      if (p === 'auto') localStorage.removeItem(CLAVE);
      else localStorage.setItem(CLAVE, p);
    } catch {
      // Sin almacenamiento: vale solo mientras la pestaña siga abierta.
    }
    setPreferencia(p);
  };
  return [preferencia, elegir];
}
