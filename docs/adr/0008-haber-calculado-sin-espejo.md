# ADR-0008. El haber se calcula desde el medio de pago, sin ventas espejo

- **Estado:** propuesta, 02/11/2026. Reemplaza la regla de la venta espejo (P-09 vieja, HU-025 vieja). En [ADR-0002](0002-stack-django-react.md) la app `notebooks` y la regla de dinero mencionan la venta espejo: esas menciones quedan reemplazadas por esta decisión.
- **Nota del 09/11/2026:** el haber inicial pasó a ser un solo monto, sin fecha ni turno, y todo lo cargado en efectivo lo mueve: [ADR-0016](0016-haber-inicial-sin-fecha-y-caja-en-vivo.md).
- **Nota del 03/11/2026:** el contexto sobre Mercado Pago resultó equivocado y "My" era "Pan" (P-12). La decisión sigue vigente. Cómo se cargan los renglones del cuaderno: [ADR-0009](0009-cuadernos-como-en-el-papel.md).

## Contexto

El cliente explicó sus cuadernos (P-01, P-02):

- El **haber** es el efectivo en la caja al cerrar un turno. Cierra dos veces por día, mañana y noche.
- En papel anota todas las ventas del turno, con cualquier medio de pago, y en el cuaderno de Costos resta lo cobrado por Mercado Pago, para que el haber dé el efectivo.
- Haber nuevo = haber anterior + ventas, menos costos. La caja nunca queda negativa.

Antes de esa explicación habíamos decidido una **venta espejo**: por cada gasto pagado sin efectivo, el sistema creaba un ingreso del mismo importe para compensarlo. Era copiar el truco del papel.

## Opciones

| Opción | A favor | En contra |
|---|---|---|
| A. Filas espejo, como el papel | Se parece al cuaderno | Duplica movimientos en reportes y exportaciones. El espejo hay que mantenerlo atado a su original al corregir o anular, en la misma transacción. Un error ahí y la caja deja de cerrar sin que nadie lo note |
| B. Calcular el haber desde el medio de pago | Cada movimiento se carga una sola vez. Corregir o anular corrige la caja solo. Nada que sincronizar | La pantalla tiene que mostrar el desglose para que el cliente reconozca su cuenta de papel |

## Decisión

Opción B.

- Cada movimiento lleva **turno** (mañana o noche) además de la fecha.
- Cada local tiene un **haber inicial**: el último haber anotado en papel, con su fecha y turno. Lo carga el dueño; cambiarlo pide motivo y queda en la auditoría.
- Para cada turno posterior: **haber = haber anterior + ventas en efectivo, menos gastos en efectivo.** Mercado Pago, tarjetas y transferencias suman en ventas o en gastos, pero no mueven la caja.
- El haber **no se guarda** en ninguna tabla. Se calcula al leerlo, agrupando por fecha y turno.
- Si un turno da negativo, se muestra en rojo con un aviso. No se bloquea la carga: los gastos de un turno se pueden cargar antes que sus ventas.
- La caja no sigue los filtros de la lista: es la caja entera del local.
- La pantalla muestra el desglose del papel: haber anterior, ventas, cobrado sin efectivo, gastos en efectivo y haber.

## Consecuencias

- Se borra el campo `mirror_of` y la regla que lo protegía. No había datos reales: solo había datos de prueba.
- El "Saldo del período" pasa a llamarse **Resultado** (ingresos menos gastos, con cualquier medio), para no confundirlo con el haber.
- Calcular cada vez cuesta una consulta agrupada desde el haber inicial. Son dos filas por día: unas 730 por año. Si con los años se vuelve lento, se agrega un cierre guardado por mes, sin cambiar la regla.
- Supuesto a confirmar (P-12): los renglones "My" del cuaderno de Costos son Mercado Pago. Si no lo fueran, son gastos comunes y el cálculo no cambia.
- Hay un test que reproduce la cuenta del papel y comprueba que da lo mismo.
