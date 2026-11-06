import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { servicios } from '../services';
import type { TipoMovimiento } from '../types';

/** Cuánto se espera después de la última tecla antes de pedir sugerencias. */
const ESPERA_MS = 150;

interface Props {
  tipo: TipoMovimiento;
  valor: string;
  onChange(valor: string): void;
}

/**
 * La descripción, con las que ya se usaron en el local como sugerencias (HU-030).
 *
 * Flechas para moverse, Enter para elegir y Esc para cerrar la lista. Enter solo elige si hay una
 * marcada con las flechas: si no, guarda como siempre. Las sugerencias aparecen recién cuando la
 * persona escribe, no al abrir una corrección con el texto ya puesto.
 */
export default function CampoDescripcion({ tipo, valor, onChange }: Props) {
  const id = useId();
  const [sugerencias, setSugerencias] = useState<string[]>([]);
  const [abierta, setAbierta] = useState(false);
  const [marcada, setMarcada] = useState(-1);
  const escribio = useRef(false);
  const ultimoPedido = useRef(0);

  useEffect(() => {
    const texto = valor.trim();
    if (!escribio.current || !texto) return;
    const pedido = ++ultimoPedido.current;
    const espera = setTimeout(() => {
      servicios.cuadernos
        .descripciones(tipo, texto)
        .then((lista) => {
          if (pedido !== ultimoPedido.current) return; // llegó tarde: ya se escribió otra cosa
          // Lo que ya está escrito tal cual no es una sugerencia.
          setSugerencias(lista.filter((s) => s.toLowerCase() !== texto.toLowerCase()));
          setMarcada(-1);
        })
        .catch(() => setSugerencias([])); // sin sugerencias se carga igual
    }, ESPERA_MS);
    return () => clearTimeout(espera);
  }, [valor, tipo]);

  const visible = abierta && valor.trim() !== '' && sugerencias.length > 0;

  const elegir = (texto: string) => {
    onChange(texto);
    setAbierta(false);
    setMarcada(-1);
  };

  const alTeclear = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!visible) {
      if (e.key === 'ArrowDown' && sugerencias.length > 0 && valor.trim()) {
        setAbierta(true);
        e.preventDefault();
      }
      return;
    }
    const total = sugerencias.length;
    if (e.key === 'ArrowDown') setMarcada((m) => (m + 1) % total);
    else if (e.key === 'ArrowUp') setMarcada((m) => (m <= 0 ? total - 1 : m - 1));
    else if (e.key === 'Enter' && marcada >= 0) elegir(sugerencias[marcada]);
    else if (e.key === 'Escape') setAbierta(false);
    else return;
    // La tecla fue de la lista: ni el formulario, ni el modal, ni los atajos la toman.
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="campo">
      <label htmlFor={`${id}-campo`}>Descripción</label>
      <div className="sugerir">
        <input
          id={`${id}-campo`}
          className="campo-texto"
          type="text"
          maxLength={120}
          autoComplete="off"
          value={valor}
          placeholder="Por ejemplo: verdura"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={visible}
          aria-controls={`${id}-lista`}
          aria-activedescendant={visible && marcada >= 0 ? `${id}-${marcada}` : undefined}
          onChange={(e) => {
            escribio.current = true;
            setAbierta(true);
            onChange(e.target.value);
          }}
          onKeyDown={alTeclear}
          onBlur={() => setAbierta(false)}
        />
        {visible && (
          <ul className="sugerir-lista" id={`${id}-lista`} role="listbox" aria-label="Descripciones ya usadas">
            {sugerencias.map((s, i) => (
              <li
                key={s}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === marcada}
                // mousedown y no click: así el campo no pierde el foco antes de elegir.
                onMouseDown={(e) => {
                  e.preventDefault();
                  elegir(s);
                }}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
