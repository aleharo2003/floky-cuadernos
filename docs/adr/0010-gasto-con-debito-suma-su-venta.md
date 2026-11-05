# ADR-0010. Un gasto con débito suma también su venta con débito, y el sistema la crea

- **Estado:** aceptada, 03/11/2026. El punto "el tilde aparece solo al cargar" lo cambió [ADR-0012](0012-venta-del-debito-al-corregir.md) el 05/11/2026. Reemplaza a [ADR-0009](0009-cuadernos-como-en-el-papel.md) en cómo se cargan los renglones con D. Sigue valiendo de ADR-0009 que los cuadernos son las cuentas personales del dueño y que el sistema refleja su método.

## Contexto

ADR-0009 decidió cargar los renglones con D con Efectivo, suponiendo que la plata de los D estaba sumada dentro de la venta del turno. El mismo día se aclaró cómo lo anota el dueño:

- Cada gasto pagado con débito se registra **dos veces**: un gasto con débito y una **venta con débito** por el mismo monto, en un **renglón aparte**.
- Por eso dice que las ventas con tarjeta las anota "recién cuando las gasta": esa venta aparece en el cuaderno el día del gasto.
- La venta del turno (lo cobrado en efectivo) es otro renglón.

Con eso, cargar los dos renglones con Débito es copiar el papel tal cual. Ninguno de los dos mueve el haber, igual que en el cuaderno, donde se compensan.

## Opciones

| Opción | A favor | En contra |
|---|---|---|
| A. Quien carga pone los dos renglones a mano | Nada de código nuevo | Es fácil olvidarse la venta o ponerle otro medio. Con la venta en Efectivo, el haber queda alto por ese monto |
| B. Al cargar el gasto con débito, un tilde crea la venta en la misma operación | Nadie se olvida la venta ni le pone otro medio. Corregir o anular el gasto arrastra la venta | Son dos movimientos atados: hay que mantenerlos juntos al corregir o anular (lo que ADR-0008 quiso evitar con la venta espejo) |

## Decisión

Opción B.

- Al cargar un **gasto con Débito** aparece el tilde **"Sumarlo también a la venta, con débito"**, marcado de entrada. Se puede destildar.
- La venta se crea en la **misma transacción**: mismo monto, fecha y turno, medio Débito, categoría de ingreso "Ventas" (o la primera de ingreso si no hay "Ventas"), y la descripción "Gasto con débito: categoría (descripción)". Queda en la auditoría.
- La venta guarda a qué gasto pertenece (`from_debit_expense`). **No se corrige ni se anula sola**: se hace desde el gasto.
- Corregir el gasto **actualiza** su venta (monto, fecha, turno, descripción). Si el gasto deja de ser con débito, la venta **se anula** con motivo.
- Anular el gasto **anula** su venta.
- El tilde aparece solo al **cargar**. Si un gasto se corrige y pasa a ser con débito, no crea venta: se carga a mano si hace falta.

## Por qué no contradice a ADR-0008

ADR-0008 sacó la venta espejo porque se usaba para que **la caja cerrara**: era un truco del sistema. Acá la venta no compensa nada en el haber (los dos son con débito y ninguno lo mueve): es un renglón que **el dueño escribe en su cuaderno**, y el sistema solo evita que se olvide o se cargue mal. El haber sigue calculándose desde el medio de pago, como dice ADR-0008.

## Consecuencias

- Ventas, gastos, resultado y haber dan lo mismo que en el papel.
- En la caja, los D aparecen en "Ventas" y en "Cobrado sin efectivo", y no en "Gastos en efectivo". La cuenta da igual que el papel aunque las columnas no sean las mismas: la guía del dueño lo explica.
- Quien pasa el cuaderno **no carga** los renglones de venta de los D: ya los cargó el sistema con el gasto. La guía de carga lo dice con un ejemplo.
- Hay tests de backend y de navegador para crear, corregir, anular, el tilde destildado y la venta que no se toca sola.
