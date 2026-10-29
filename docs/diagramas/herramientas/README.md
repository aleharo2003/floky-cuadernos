# Volver a exportar los diagramas

Las imágenes y `galeria.html` se abren sin instalar nada. Estas herramientas solo hacen falta cuando se modifica un diagrama. Busca las stories `HU-nnn` de cada sección y acepta un Chromium ya instalado.

## Fuente editable

Editar el bloque Mermaid del documento numerado (`01-arquitectura.md`, etc.). Conservar el comentario `<!-- diagram: ID -->` y el ancla: con un ID estable, los enlaces de las stories siguen funcionando. Los `.mmd` de `fuentes/` son copias generadas.

Para un cambio puntual se puede probar el bloque en [Mermaid Live](https://mermaid.live/).

## Preparación, una vez

Con Node.js y npm, desde esta carpeta:

```text
npm install
npx playwright install chromium
```

## Exportar

```text
npm run exportar
```

Genera `fuentes/*.mmd`, `svg/*.svg`, `png/*.png`, `manifest.json` y `galeria.html` en la carpeta de arriba. Si un bloque falla, muestra el ID; se corrige y se vuelve a correr. La galería se actualiza solo si todos pasan.

Variables opcionales (útiles en CI o si ya hay un Chromium instalado):

| Variable | Para qué |
|---|---|
| `DIAGRAMAS_CHROMIUM_PATH` | Usar un Chromium ya instalado |
| `DIAGRAMAS_PLAYWRIGHT_MODULE` | Usar `playwright-core` en lugar de `playwright` |
| `DIAGRAMAS_NODE_MODULES` | Carpeta `node_modules` alternativa |
| `DIAGRAMAS_MERMAID_JS` | Ruta a `mermaid.min.js` |

Después de agregar o quitar diagramas, actualizar el README de `diagramas/` (índice y mapa de stories). El exportador no borra derivados de un ID retirado.
