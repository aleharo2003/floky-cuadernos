# ADR-0013. Los gastos por transferencia también suman su venta, y el dueño elige los medios

- **Estado:** aceptada, 06/11/2026. Amplía [ADR-0010](0010-gasto-con-debito-suma-su-venta.md) y [ADR-0012](0012-venta-del-debito-al-corregir.md) de "débito" a "los medios que elija el dueño". El resto de los dos sigue igual.

## Contexto

El 06/11/2026 Emanuel pidió que los gastos pagados por transferencia funcionen como los de débito: en el papel los anota dos veces, el gasto y una venta por el mismo monto. Es la misma razón que con el débito (P-02): esa plata entró a sus cuentas sin pasar por la caja y la registra como venta cuando la gasta.

Hoy la regla está fija en el código para débito. Si mañana pide lo mismo para Mercado Pago o crédito, haría falta otro cambio y otro deploy.

## Opciones

1. **Fijo en el código para débito y transferencia.** Lo más simple. El próximo pedido de este tipo vuelve a necesitar un cambio de código.
2. **Un ajuste por local que elige el dueño.** Un poco más de trabajo ahora (una tabla, una pantalla y su auditoría), pero el próximo medio lo agrega Emanuel solo, y cada local puede tener su costumbre.

## Decisión

Opción 2.

- Cada local tiene sus **ajustes**. El primero es "gastos que también se suman a la venta": una lista de medios de pago. De entrada, **débito y transferencia**. Efectivo nunca está en la lista: un gasto y una venta en efectivo moverían los dos la caja.
- Los cambia **solo el dueño**, desde su menú: "Ajustes del local". Cada cambio queda en la auditoría con el antes y el después.
- Un gasto con uno de esos medios muestra el tilde "Sumarlo también a la venta", **marcado** de entrada, como con débito. La venta se crea con el **mismo medio** que el gasto: "Gasto por transferencia: Proveedores".
- Los ajustes valen para lo que se cargue o corrija **después**. Lo ya cargado no cambia.
- Al corregir un gasto que tiene su venta:
  - Si el medio **no cambia**, la venta lo sigue aunque el dueño haya sacado ese medio de la lista. Corregir el monto de un gasto viejo no tiene por qué borrar su venta.
  - Si pasa a **otro medio de la lista** (débito a transferencia), la venta lo sigue y cambia de medio.
  - Si pasa a un medio **fuera de la lista** o a efectivo, la venta se anula, como antes.

## Consecuencias

- Un pedido como este para Mercado Pago o crédito ya no necesita código: lo tilda el dueño.
- La caja no cambia: el gasto y su venta son sin efectivo, igual que con débito.
- Migración 0005: el enlace `from_debit_expense` pasa a llamarse `from_expense`, porque ya no es solo de débito. Es un renombre de columna: ningún dato se pierde. En la API, `debit_sale_id` y `from_debit_expense_id` pasan a `sale_id` y `from_expense_id`. Una pestaña abierta desde antes del deploy hay que recargarla.
- Nueva tabla `ShopSettings`, una fila por local. Un local sin fila usa los valores de entrada, así que no hace falta cargar nada al publicar.
- Permiso nuevo para el dueño: `notebooks.manage_settings`.
