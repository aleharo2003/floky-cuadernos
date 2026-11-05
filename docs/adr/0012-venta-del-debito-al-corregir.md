# ADR-0012. Al corregir un gasto con débito sin venta, se ofrece sumarla

- **Estado:** aceptada, 05/11/2026. Cambia un punto de [ADR-0010](0010-gasto-con-debito-suma-su-venta.md): "el tilde aparece solo al cargar". El resto de ADR-0010 sigue igual.

## Contexto

La revisión del 05/11/2026 encontró que la venta de un gasto con débito se perdía en una ida y vuelta: si el gasto se corregía a efectivo, su venta se anulaba (bien), pero si después se corregía otra vez a débito, la venta no volvía y la pantalla no ofrecía el tilde. El total del turno quedaba corto sin aviso.

Además, el vínculo entre el gasto y su venta era uno a uno: aunque la venta estuviera anulada, ocupaba el lugar y no se podía crear otra.

## Decisión

- El vínculo pasa a ser de **uno a varios**: un gasto puede tener a lo largo del tiempo una venta anulada y otra nueva. Nunca dos vigentes a la vez: lo controlan los servicios, en la misma transacción.
- Al **corregir** un gasto que queda con débito y **no tiene venta vigente**, la ventana muestra el tilde "Sumarlo también a la venta, con débito".
  - Marcado de entrada si el gasto **pasa** a ser con débito en esa corrección (la ida y vuelta).
  - Sin marcar si ya era con débito y se había cargado sin venta: lo destildaron a propósito.
- La venta anulada **no vuelve**: queda en el historial tal como estaba, y se crea una nueva. Anular sigue siendo definitivo.
- La API solo informa la venta **vigente** de cada gasto. Antes devolvía también la anulada, y la pantalla creía que el gasto todavía tenía venta.

## Consecuencias

- El total del turno ya no queda corto en la ida y vuelta.
- Un gasto con débito cargado sin venta puede sumarla después, desde la corrección.
- Migración 0004: el campo `from_debit_expense` pasa de uno a uno a uno a varios. No cambia ningún dato.
