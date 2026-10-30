# Documentación

Toda la documentación del sistema vive acá, junto al código, y se revisa en los mismos pull requests.

## Por dónde empezar

1. [Visión del producto](producto/vision.md): qué es, para quién y qué entra en cada versión.
2. [Glosario](producto/glosario.md): las palabras del negocio y de la arquitectura, con el mismo significado para todos.
3. [Casos de uso](diagramas/02-casos-de-uso.md): qué puede hacer cada rol.
4. [Decisiones de arquitectura](adr/README.md): por qué el sistema es como es.
5. [Backlog](backlog/00-como-leer-el-backlog.md): épicas, stories y preguntas abiertas.

## Qué hay en cada carpeta

| Carpeta | Qué hay |
|---|---|
| `producto/` | Visión, alcance y glosario |
| `adr/` | Decisiones de arquitectura (ADR), numeradas y con estado |
| `backlog/` | Épicas, stories, preguntas abiertas y el CSV para Jira |
| `diagramas/` | Diagramas Mermaid con SVG, PNG y [galería](diagramas/galeria.html) |
| `operacion/` | [Puesta en marcha](operacion/puesta-en-marcha.md) (cuentas, publicar, volver atrás) y [backups](operacion/backups.md) |

## De dónde viene

Este producto nació dentro de `floky`, un sistema de punto de venta para restaurantes, como su módulo de cuadernos. Se separó porque el primer cliente contrató solo los cuadernos y no está claro que el punto de venta se haga ([ADR-0001](adr/0001-producto-aparte-de-floky.md)). Cada story y cada diagrama dice de qué parte de `floky` viene.

## Reglas para escribir documentación

- En español. Los nombres de código que aparecen (tablas, variables, apps) van en inglés, como en el código.
- Sin datos reales de clientes ni secretos: el repo es público.
- Si una decisión cambia, no se edita el ADR viejo para que diga otra cosa: se escribe uno nuevo que lo reemplaza y se marca el viejo como "reemplazada por ADR-XXXX".
