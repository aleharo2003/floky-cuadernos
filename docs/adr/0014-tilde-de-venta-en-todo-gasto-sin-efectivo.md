# ADR-0014. Todo gasto que no sea en efectivo puede sumar su venta; los ajustes eligen cuáles vienen marcados

- **Estado:** aceptada, 06/11/2026. Cambia un punto de [ADR-0013](0013-medios-que-suman-venta.md): la lista del dueño ya no decide **si** un medio suma venta, sino **si viene marcado**.

## Contexto

Con ADR-0013, el tilde "Sumarlo también a la venta" aparecía solo con los medios de la lista del dueño (débito y transferencia de entrada). Para un gasto con crédito o con Mercado Pago no había forma de sumar la venta sin que el dueño cambiara primero los ajustes.

El 06/11/2026 se pidió que el tilde esté en **todos los gastos que no sean en efectivo**, marcado de entrada para débito y transferencia. Quien carga decide renglón por renglón, como en el cuaderno.

## Decisión

- El tilde aparece en cualquier gasto que no sea en efectivo. Efectivo sigue sin tilde: un gasto y una venta en efectivo moverían los dos la caja.
- La lista de "Ajustes del local" pasa a decir con qué medios el tilde viene **marcado**. De entrada, débito y transferencia. Con los demás aparece sin marcar.
- Después de guardar, el tilde del próximo renglón vuelve a lo que diga la lista para ese medio. Si alguien lo tildó a mano para un crédito, el siguiente crédito viene sin marcar otra vez.
- Al corregir un gasto que tiene su venta, la venta se anula solo si el gasto pasa a efectivo. Entre otros medios (débito a Mercado Pago) la venta lo sigue y cambia de medio.
- El backend acepta sumar la venta con cualquier medio que no sea efectivo. La lista ya no se usa para rechazar.

## Consecuencias

- Ninguna venta ya cargada cambia.
- La columna `sale_methods` sigue igual; cambia su significado y su nombre en el admin (migración 0006, sin SQL).
- Un error posible es tildar un crédito sin querer. Lo mitiga que con los medios fuera de la lista el tilde viene sin marcar.
