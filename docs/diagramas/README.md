# Diagramas

**16 diagramas editables, con SVG y PNG para adjuntar a las stories.** El Markdown numerado es la fuente; `fuentes/`, `svg/`, `png/`, `manifest.json` y `galeria.html` se generan.

Abrir [la galería](galeria.html) para recorrerlos. La [guía didáctica](guia-para-aprender-y-ensenar.md) propone cómo usarlos para aprender y enseñar.

## Empezar por estos cuatro

1. [CU-01: qué puede hacer cada rol](02-casos-de-uso.md#cu-01).
2. [ARQ-04: quién ve qué cuando hay varios locales](01-arquitectura.md#arq-04).
3. [FUN-02: cargar un movimiento](06-flujos-funcionales.md#fun-02), con la regla de la venta espejo.
4. [TEC-01: guardar un gasto con su espejo](05-secuencias-tecnicas.md#tec-01). Dónde empieza y dónde termina la transacción.

## Qué explica cada documento

| Documento | Pregunta que responde | Diagramas |
|---|---|---|
| [01-arquitectura.md](01-arquitectura.md) | ¿Quién lo usa, qué corre dónde y cómo se organiza el código? | ARQ-01, ARQ-02, ARQ-03, ARQ-04, ARQ-05 |
| [02-casos-de-uso.md](02-casos-de-uso.md) | ¿Qué puede hacer cada rol? | CU-01, CU-02 |
| [03-clases.md](03-clases.md) | ¿Quién es responsable de cada regla? | CLA-01 |
| [04-datos.md](04-datos.md) | ¿Qué se guarda y cómo se aísla cada local? | DAT-01 |
| [05-secuencias-tecnicas.md](05-secuencias-tecnicas.md) | ¿En qué orden colaboran las piezas y dónde está la transacción? | TEC-01, TEC-02 |
| [06-flujos-funcionales.md](06-flujos-funcionales.md) | ¿Qué hace cada persona y qué pasa ante un error? | FUN-01, FUN-02, FUN-03 |
| [07-estados.md](07-estados.md) | ¿Qué cambios de estado son válidos? | EST-01 |
| [08-operacion.md](08-operacion.md) | ¿Cómo se cuida que los datos no se pierdan? | OPS-01 |

## Mapa de stories

Una asociación no significa que la story esté diseñada por completo: algunas tienen un flujo específico y otras solo un modelo de apoyo.

| Story | Diagramas |
|---|---|
| HU-001 | [ARQ-03](01-arquitectura.md#arq-03) |
| HU-002 | [ARQ-05](01-arquitectura.md#arq-05) |
| HU-003 | [ARQ-02](01-arquitectura.md#arq-02), [ARQ-03](01-arquitectura.md#arq-03) |
| HU-004 | [TEC-02](05-secuencias-tecnicas.md#tec-02) |
| HU-005 | [ARQ-02](01-arquitectura.md#arq-02), [ARQ-05](01-arquitectura.md#arq-05), [TEC-02](05-secuencias-tecnicas.md#tec-02) |
| HU-006 | [ARQ-05](01-arquitectura.md#arq-05), [TEC-02](05-secuencias-tecnicas.md#tec-02) |
| HU-007 | [ARQ-05](01-arquitectura.md#arq-05) |
| HU-010 | [ARQ-04](01-arquitectura.md#arq-04), [CU-01](02-casos-de-uso.md#cu-01), [DAT-01](04-datos.md#dat-01) |
| HU-011 | [ARQ-04](01-arquitectura.md#arq-04), [DAT-01](04-datos.md#dat-01), [TEC-01](05-secuencias-tecnicas.md#tec-01), [FUN-01](06-flujos-funcionales.md#fun-01) |
| HU-012 | [ARQ-01](01-arquitectura.md#arq-01), [ARQ-04](01-arquitectura.md#arq-04), [CU-01](02-casos-de-uso.md#cu-01), [CU-02](02-casos-de-uso.md#cu-02), [FUN-01](06-flujos-funcionales.md#fun-01) |
| HU-013 | [ARQ-01](01-arquitectura.md#arq-01), [ARQ-04](01-arquitectura.md#arq-04), [CU-01](02-casos-de-uso.md#cu-01), [CLA-01](03-clases.md#cla-01), [DAT-01](04-datos.md#dat-01), [FUN-01](06-flujos-funcionales.md#fun-01) |
| HU-014 | [CU-02](02-casos-de-uso.md#cu-02), [DAT-01](04-datos.md#dat-01), [TEC-01](05-secuencias-tecnicas.md#tec-01), [FUN-03](06-flujos-funcionales.md#fun-03) |
| HU-016 | [ARQ-02](01-arquitectura.md#arq-02), [OPS-01](08-operacion.md#ops-01) |
| HU-020 | [ARQ-03](01-arquitectura.md#arq-03), [CLA-01](03-clases.md#cla-01), [DAT-01](04-datos.md#dat-01) |
| HU-021 | [ARQ-01](01-arquitectura.md#arq-01), [CU-01](02-casos-de-uso.md#cu-01), [TEC-01](05-secuencias-tecnicas.md#tec-01), [FUN-02](06-flujos-funcionales.md#fun-02) |
| HU-022 | [CU-01](02-casos-de-uso.md#cu-01), [CLA-01](03-clases.md#cla-01) |
| HU-023 | [CU-01](02-casos-de-uso.md#cu-01) |
| HU-024 | [CU-01](02-casos-de-uso.md#cu-01), [FUN-02](06-flujos-funcionales.md#fun-02), [FUN-03](06-flujos-funcionales.md#fun-03) |
| HU-025 | [CU-02](02-casos-de-uso.md#cu-02), [CLA-01](03-clases.md#cla-01), [DAT-01](04-datos.md#dat-01), [TEC-01](05-secuencias-tecnicas.md#tec-01), [FUN-02](06-flujos-funcionales.md#fun-02), [FUN-03](06-flujos-funcionales.md#fun-03), [EST-01](07-estados.md#est-01) |
| HU-026 | [CU-01](02-casos-de-uso.md#cu-01), [FUN-03](06-flujos-funcionales.md#fun-03), [EST-01](07-estados.md#est-01) |
| HU-027 | [ARQ-01](01-arquitectura.md#arq-01), [CU-02](02-casos-de-uso.md#cu-02) |
| HU-028 | [CU-01](02-casos-de-uso.md#cu-01) |
| HU-029 | [CU-01](02-casos-de-uso.md#cu-01), [OPS-01](08-operacion.md#ops-01) |

## De dónde viene cada diagrama

| Diagrama | Viene de floky |
|---|---|
| ARQ-01 | ARQ-01, sin punto de venta |
| ARQ-02 | ARQ-02, sin servidor local |
| ARQ-03 | ARQ-03, sin apps del punto de venta |
| ARQ-04 | ARQ-04, con los cuadernos por local y sin contador ni datos de venta |
| ARQ-05 | ARQ-05, sin servidor local ni ARCA |
| CU-01 | Nueva |
| CU-02 | Nueva |
| CLA-01 | CLA-02, solo Mis finanzas, más personas y membresías |
| DAT-01 | DAT-02, solo Mis finanzas y membresías, más la auditoría de DAT-01 |
| TEC-01 | Nueva, con la idea de TEC-01 |
| TEC-02 | TEC-05, sin instalador |
| FUN-01 | Nueva, a partir del ingreso de FUN-07 |
| FUN-02 | FUN-06, sin segunda clave y con venta espejo |
| FUN-03 | Nueva |
| EST-01 | Nueva |
| OPS-01 | OPS-02, sin la parte del local |

## Qué es vigente y qué es propuesta

- Todos los ADR están en propuesta. Ver el [índice](../adr/README.md).
- Los diagramas muestran diseño objetivo. Ninguno representa código implementado todavía.

## Regenerar

Editar el bloque Mermaid del documento numerado, conservando el comentario `<!-- diagram: ID -->`. Después, desde `herramientas/`:

```text
npm install
npx playwright install chromium
npm run exportar
```

Ver [herramientas/README.md](herramientas/README.md). Antes de commitear, revisar la imagen: el exportador valida sintaxis, no si una flecha está bien puesta.
