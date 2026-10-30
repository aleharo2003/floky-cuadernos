# ADR-0001. Los cuadernos son un producto aparte de floky

- **Estado:** aceptada el 29/10/2026 (PR #1).

## Contexto

`floky` se diseñó como un punto de venta para restaurantes: servidor en cada local, facturación electrónica, impresión, sincronización con la nube y, como un módulo más, los cuadernos del dueño.

El primer cliente contrató solo los cuadernos, como un sistema independiente de su caja. Puede que el punto de venta no se haga nunca. Si los cuadernos siguen dentro de `floky`, el backlog, los diagramas y las decisiones hablan de 30 épicas que quizás no existan, y es fácil terminar construyendo piezas del punto de venta "por las dudas".

## Opciones

| Opción | A favor | En contra |
|---|---|---|
| A. Seguir dentro de floky, como su primer release | No hay que mover nada. Si se hace el punto de venta, todo está junto | El repo y los docs hablan de algo que quizás no exista. Se construyen cosas que solo sirven al punto de venta |
| B. Mismo repo, con el punto de venta en una carpeta de futuro | Poco trabajo. Se reutiliza todo si vuelve el punto de venta | El nombre y la historia del repo siguen siendo de punto de venta |
| C. Repo nuevo solo para cuadernos | Claro para quien llega: todo lo que hay se va a construir. CI, docs y Jira propios | Más trabajo inicial. Si vuelve el punto de venta, hay que mover o copiar identidad y permisos |

## Decisión

Opción C: repo `floky-cuadernos` y proyecto de Jira `FLC`.

- `floky` queda congelado como referencia, igual que el repo de análisis anterior. No se borra.
- Lo que se trae de `floky` se adapta, no se copia: sin servidor local, sin sincronización, sin facturación.
- Cada story, diagrama y ADR dice de qué parte de `floky` viene.

## Consecuencias

- Se puede construir y vender sin cargar con decisiones del punto de venta.
- Para no cerrar la puerta: las apps `core` (locales, auditoría) y `accounts` (personas, membresías) no dependen de `notebooks`. Si el punto de venta vuelve, se pueden mover a otro proyecto sin arrastrar los cuadernos ([ADR-0002](0002-stack-django-react.md)).
- Hay que armar de nuevo reglas del repo, CI y environments. Es trabajo de R0.

> Tip: separar algo "por si acaso" casi nunca vale la pena; separar porque lo otro quizás no existe, sí. La pregunta útil no es "¿lo vamos a necesitar?" sino "¿qué nos cuesta hoy tenerlo mezclado?".
