# Guías de uso

Para las personas de cada local, en español simple y con capturas de la demo (datos inventados). Una por permiso:

| Guía | Para quién |
|---|---|
| [Dueño](dueno.md) | El dueño del local. Incluye el haber inicial y cómo se lee la caja |
| [Carga](carga.md) | Quien anota ventas y gastos |
| [Consulta](consulta.md) | Quien solo mira y exporta, por ejemplo el contador |

Se actualizan en el mismo PR que cambia la pantalla (HU-029).

## Volver a sacar las capturas

Con el entorno local levantado y el seed de demo recién cargado (ver el README del repo), desde `herramientas/`:

```text
npm install
npx playwright install chromium
GUIAS_URL=http://127.0.0.1:8000 npm run capturas
```

Las guarda en `img/`. El script carga y anula movimientos de demo para tener algo que mostrar: correlo sobre un seed nuevo.

## Armar los PDF para el cliente

```text
npm run pdf
```

Deja `pdf/guia-dueno.pdf`, `pdf/guia-carga.pdf` y `pdf/guia-consulta.pdf`. Los PDF no se suben al repo: se generan cuando hace falta mandarlos.
