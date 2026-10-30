/**
 * Atajos de teclado. ÚNICO lugar donde se definen las teclas.
 *
 * Para cambiar una tecla alcanza con editar `teclas` (lo que escucha el sistema) y `etiqueta`
 * (lo que se muestra en los botones). Los valores de `teclas` son los de `KeyboardEvent.key`.
 * Qué hace cada atajo lo decide la pantalla que está abierta (ver `useAtajo`).
 */

export interface Atajo {
  teclas: string[];
  etiqueta: string;
  nombre: string;
  grupo: 'General' | 'Listas y opciones';
}

const atajo = (grupo: Atajo['grupo'], etiqueta: string, nombre: string, ...teclas: string[]): Atajo => ({
  grupo,
  etiqueta,
  nombre,
  teclas,
});

export const ATAJOS = {
  confirmar: atajo('General', 'Enter', 'Confirmar', 'Enter'),
  volver: atajo('General', 'Esc', 'Volver o cancelar', 'Escape'),
  arriba: atajo('Listas y opciones', '↑', 'Subir en una lista', 'ArrowUp'),
  abajo: atajo('Listas y opciones', '↓', 'Bajar en una lista', 'ArrowDown'),
  opcionAnterior: atajo('Listas y opciones', 'RePág', 'Opción anterior, por ejemplo el período', 'PageUp'),
  opcionSiguiente: atajo('Listas y opciones', 'AvPág', 'Opción siguiente, por ejemplo el período', 'PageDown'),
} satisfies Record<string, Atajo>;

export type IdAtajo = keyof typeof ATAJOS;

/** Teclas a las que se les saca lo que hace el navegador por su cuenta. Ninguna por ahora. */
export const TECLAS_BLOQUEADAS: string[] = [];
