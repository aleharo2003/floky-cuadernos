import { Tecla, useAtajo } from '../atajos/Atajos';
import { periodosRapidos, type PeriodoRapido } from '../lib/fechas';
import type { RangoFechas } from '../types';
import Card from './Card';

interface Props {
  valor: RangoFechas;
  onChange(rango: RangoFechas): void;
  /** Los atajos de un toque. Si no se pasan: hoy, esta semana y este mes. */
  periodos?: PeriodoRapido[];
}

/** Filtro desde/hasta con atajos de un toque. RePág y AvPág pasan de un atajo al otro. */
export default function FiltroFechas({ valor, onChange, periodos = periodosRapidos() }: Props) {
  const elegido = periodos.findIndex((p) => p.rango.desde === valor.desde && p.rango.hasta === valor.hasta);
  const girar = (paso: number) =>
    onChange(periodos[((elegido < 0 ? 0 : elegido + paso) + periodos.length) % periodos.length].rango);

  useAtajo('opcionSiguiente', () => girar(1));
  useAtajo('opcionAnterior', () => girar(-1));

  return (
    <Card className="filtro-fechas">
      <div className="segmentado" role="group" aria-label="Período">
        {periodos.map((p, i) => (
          <button key={p.etiqueta} type="button" aria-pressed={i === elegido} onClick={() => onChange(p.rango)}>
            {p.etiqueta}
          </button>
        ))}
      </div>
      <span className="ayuda-teclas">
        <Tecla id="opcionAnterior" />
        <Tecla id="opcionSiguiente" /> cambia el período
      </span>
      <label className="campo">
        <span>Desde</span>
        <input
          className="campo-texto"
          type="date"
          value={valor.desde}
          max={valor.hasta}
          onChange={(e) => onChange({ ...valor, desde: e.target.value })}
        />
      </label>
      <label className="campo">
        <span>Hasta</span>
        <input
          className="campo-texto"
          type="date"
          value={valor.hasta}
          min={valor.desde}
          onChange={(e) => onChange({ ...valor, hasta: e.target.value })}
        />
      </label>
    </Card>
  );
}
