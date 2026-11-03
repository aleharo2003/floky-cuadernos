# ADR-0009. Los cuadernos son las cuentas personales del dueño y se cargan como están en el papel

- **Estado:** aceptada, 03/11/2026. Corrige una premisa del contexto de [ADR-0008](0008-haber-calculado-sin-espejo.md) (la resta de Mercado Pago). La decisión de ADR-0008, calcular el haber desde el medio de pago, sigue vigente.

## Contexto

El dueño de Comedor TJ respondió las dudas sobre el cuaderno de Costos (03/11/2026):

- La **D** al final de un gasto quiere decir que se pagó con **tarjeta de débito**. Esos gastos los resta con los demás y después los **suma a la venta del turno**. En el haber se compensan: no lo mueven.
- Lo que leíamos "My" o "MP" dice **"Pan"**. Es un gasto común (P-12).
- Las ventas cobradas con débito o tarjeta **no las anota cuando entran**. Esa plata queda en sus cuentas y la anota recién cuando la gasta, con los renglones con D.
- Los cuadernos son **sus cuentas personales**, no la contabilidad del local. Las ventas del local están en iCOM, que es otro sistema.

ADR-0008 suponía que en el papel se restaba lo cobrado por Mercado Pago. No es así: la única compensación del papel son los renglones con D.

El problema: la venta del turno anotada en el cuaderno **ya incluye los D**. Si se carga esa venta como efectivo y cada D como gasto con débito, el haber del sistema queda más alto que el del papel por la suma de los D.

## Opciones

| Opción | A favor | En contra |
|---|---|---|
| 1. Copiar el papel tal cual: la venta del turno y cada D, con Efectivo | Quien carga no hace cuentas. Ventas, gastos, resultado y haber dan igual que el cuaderno | El sistema no distingue lo pagado con débito |
| 2. Como el papel, marcando el débito: la venta del turno menos los D, con Efectivo; cada D, un gasto y una venta con Débito | Los números dan igual que el cuaderno y además queda registrado el débito | Hay que restar a mano y cargar dos renglones por cada D. Fácil de equivocarse |
| 3. Lo real: las ventas con tarjeta cuando entran y los D solo como gasto con Débito | Ventas y resultado reales | El dueño no lo lleva así y dijo que esa parte es suya. Los números no coinciden con el cuaderno |

## Decisión

Opción 1. El sistema refleja la forma en que el dueño lleva sus cuentas, no la corrige.

- Los renglones con D se cargan **como están en el cuaderno, con Efectivo**.
- La venta del turno se carga con el **total que figura en el cuaderno**, que ya incluye los D.
- El cálculo del haber no cambia (ADR-0008).

## Consecuencias

- Ventas, gastos, resultado y haber dan lo mismo que en el papel, que es lo que el dueño compara.
- En Comedor TJ casi todo va a quedar con Efectivo. La columna "Cobrado sin efectivo" de la caja va a estar en cero. El medio de pago queda para otro local que lo lleve distinto.
- **Fuente de verdad:** las ventas del local salen de iCOM; los cuadernos son las cuentas del dueño. No se cruzan ni se corrigen entre sí.
- Si más adelante el dueño quiere ver aparte lo pagado con débito, se pasa a la opción 2 con ayuda del sistema: un tilde en el gasto con débito que también lo sume a la venta, en la misma transacción. Sería una story nueva.
- La guía de carga dice qué hacer con los renglones con D.
