# Portal

React + TypeScript + Vite. En producción el build lo sirve Django bajo `/static/` (ADR-0006).

## De dónde viene

Las pantallas, los componentes y los estilos salen de la demo navegable del sistema. Por eso:

- **Los nombres del código están en español** (`pantallas`, `componentes`, `servicios`), aunque CONTRIBUTING pide inglés. Es deuda conocida, aceptada para llegar a la primera versión (R1a): traducir todo al mover el código costaba casi un día. Hasta ese PR, lo nuevo del front sigue el mismo estilo, para no mezclar dos idiomas en las mismas carpetas. Se traduce todo junto en un PR propio después de R1a.
- `estilos.css` todavía trae estilos de pantallas que acá no existen. Se limpian en ese mismo PR.

## Cómo hablan las pantallas con los datos

Las pantallas no llaman a la API directo: piden todo a `servicios` (`src/services/index.ts`), que cumple los contratos de `src/services/contratos.ts`. La sesión ya habla con la API (`src/services/api/`). Los cuadernos siguen en memoria (`src/services/mock/`) hasta que exista su API; se cambian en `index.ts` sin tocar las pantallas.

## Comandos

```text
npm ci          # instalar
npm run dev     # desarrollo, con /api y /admin hacia Django en el puerto 8000
npm run lint
npm run build   # tipos y build en dist/
```
