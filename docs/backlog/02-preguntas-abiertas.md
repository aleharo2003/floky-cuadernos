# Preguntas abiertas

Cada pregunta dice a quién hay que hacérsela y qué bloquea. Cuando se resuelve, la respuesta va al ADR o a la story que corresponda, y la pregunta pasa a la tabla de respondidas con un resumen.

## Con el dueño de cada local

| ID | Pregunta | Bloquea |
|---|---|---|
| P-04 | ¿A nombre de quién se abren las cuentas de hosting y de dominio? El cliente las paga directo al proveedor, y Cloud Run pide una cuenta de facturación aunque el uso sea gratis. De eso depende quién recibe los avisos y quién puede borrar el proyecto. Mientras tanto, R1a se publica en cuentas del equipo. | HU-005, HU-006, HU-016, HU-029 |

## Del equipo

| ID | Pregunta | Bloquea |
|---|---|---|
| P-03 | ¿Se ingresa con email o con nombre de usuario? El email permite que cada persona recupere su contraseña sola; con nombre de usuario la recuperación la hace el equipo. | HU-012 |
| P-05 | Cuando el repo pase a privado: ¿pagamos GitHub Pro o Team para no perder los environments, y Code Security para no perder CodeQL? Se decide ese día, según los ingresos. | HU-005, HU-006, ADR-0004, ADR-0005 |

## Respondidas

| ID | Pregunta | Respuesta | Dónde quedó |
|---|---|---|---|
| P-06 | ¿Los cuadernos van dentro de floky o aparte? | Aparte: repo y proyecto de Jira propios, porque puede que el punto de venta no se haga | ADR-0001 |
| P-07 | ¿Quién entra a los cuadernos? | El dueño y el personal autorizado, por local, con rol dueño, carga o consulta. Sin segunda clave | ADR-0003, HU-013, HU-024 |
| P-08 | ¿Qué ve una persona con acceso a varios locales? | Elige el local al entrar y puede cambiar sin salir. Con un solo local entra directo, sin pantalla de selección | HU-012, FUN-01 |
| P-09 | ¿Cómo se anota un gasto que no sale del cajón (débito, crédito, QR, transferencia)? | Se carga una vez, con su medio de pago. La caja no se mueve porque no es efectivo. Reemplaza la venta espejo que se había decidido antes (02/11/2026). En Comedor TJ, cada gasto con D suma también una venta con débito, que crea el sistema (ADR-0010) | ADR-0008, ADR-0010, HU-025 |
| P-10 | ¿Un movimiento equivocado se borra o se anula? | Se anula con motivo, como todo lo que es plata | HU-026, EST-01 |
| P-11 | ¿Quién da de alta los usuarios? | El equipo, durante la puesta en marcha | HU-013, HU-029 |
| P-01 | ¿Cómo son los cuadernos de papel y qué es el haber? | Hay dos cuadernos: "Costos" (cada gasto) y el anual (ventas y haber). El haber es el **efectivo en la caja** al cerrar cada turno: haber anterior + ventas, menos costos. Se cierra dos veces por día, mañana y noche; varias fechas juntas son varios turnos. La caja nunca queda negativa. Lo que parecían paréntesis al final de algunos gastos es una "D" de débito: un gasto pagado con tarjeta de débito, que el dueño anota también como venta, en un renglón aparte (corregido el 03/11/2026, ADR-0010). El sistema arranca del último haber anotado (02/11/2026, audio del cliente y respuestas del equipo) | ADR-0008, HU-020, HU-023, HU-025 |
| P-02 | ¿Cómo se llevan en papel las ventas cobradas con Mercado Pago, tarjeta o transferencia? | No se anotan cuando entran: esa plata queda en las cuentas del dueño. Cuando la gasta, anota el gasto con D y, en un renglón aparte, una venta por el mismo monto. En el sistema, el gasto con Débito y el tilde "Sumarlo también a la venta" (03/11/2026; la respuesta del 02/11 suponía una resta de Mercado Pago que no existe) | ADR-0010, ADR-0009, ADR-0008, HU-025 |
| P-12 | ¿Qué son los renglones "My" del cuaderno de Costos? | Dicen "Pan": un gasto común en efectivo. No era Mercado Pago (03/11/2026) | ADR-0009 |
| P-13 | ¿Se limitan las fechas que se pueden cargar? La revisión del 05/11/2026 marcó que se guardan fechas como 1999 o 2028 sin aviso. | No, a propósito: se puede cargar cualquier fecha, hacia atrás para subir el historial de los cuadernos y hacia adelante para anotar algo que ya se sabe que va a pasar. El aviso "No es hoy" y la lista del día ayudan a ver un error de tipeo (05/11/2026, decisión del equipo) | HU-021 |
| P-14 | ¿Los gastos por transferencia también suman su venta, como los de débito? | Sí: Emanuel los anota igual en el papel (06/11/2026). Además, el dueño elige por local qué medios suman venta, así el próximo pedido de este tipo no necesita código | ADR-0013, HU-025 |
| P-15 | ¿El tilde para sumar la venta va solo con débito y transferencia? | No: en todo gasto que no sea en efectivo, marcado de entrada para débito y transferencia (06/11/2026) | ADR-0014 |
| P-16 | ¿El haber inicial tiene fecha y turno? | No: es un solo monto. Desde que se carga, cada movimiento en efectivo lo actualiza, sea de la fecha que sea (09/11/2026). Si un día se carga historial viejo, también mueve la caja | ADR-0016 |
