# Preguntas abiertas

Cada pregunta dice a quién hay que hacérsela y qué bloquea. Cuando se resuelve, la respuesta va al ADR o a la story que corresponda, y la pregunta pasa a la tabla de respondidas con un resumen.

## Con el dueño de cada local

| ID | Pregunta | Bloquea |
|---|---|---|
| P-01 | ¿Cómo son los cuadernos de papel? Ver un ejemplo de cada uno: campos, categorías, qué es el haber y cómo afecta el saldo, si el saldo se arrastra de un período a otro y si el local lleva uno o varios cuadernos. | HU-020, HU-022, HU-023, HU-025, HU-029 |
| P-02 | Con el espejo solo para gastos, una venta cobrada con débito, crédito, QR o transferencia suma al saldo aunque esa plata no esté en el cajón. En la primera charla se mencionó que esas ventas también se restan como gasto. ¿Cómo lo llevan en el papel? | HU-023, HU-025 |
| P-04 | ¿A nombre de quién se abren las cuentas de hosting y de dominio? El cliente las paga directo al proveedor, y Cloud Run pide una cuenta de facturación aunque el uso sea gratis. De eso depende quién recibe los avisos y quién puede borrar el proyecto. | HU-005, HU-006, HU-016, HU-029 |

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
| P-09 | ¿Cómo se anota un gasto que no sale del cajón (débito, crédito, QR, transferencia)? | El sistema crea una venta espejo del mismo importe. Los espejos suman en los totales | HU-025 |
| P-10 | ¿Un movimiento equivocado se borra o se anula? | Se anula con motivo, como todo lo que es plata | HU-026, EST-01 |
| P-11 | ¿Quién da de alta los usuarios? | El equipo, durante la puesta en marcha | HU-013, HU-029 |
