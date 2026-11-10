# ADR-0015. Vaciar los cuadernos de un local desde el admin

- **Estado:** aceptada, 09/11/2026.

## Contexto

Emanuel estuvo probando los cuadernos en producción. Antes de empezar a cargar sus números de verdad hay que borrar lo de prueba: movimientos y haber inicial. Las categorías, las personas, sus permisos y los ajustes del local tienen que quedar.

Hasta ahora no había forma de hacerlo sin entrar a la base a mano, y eso es justo lo que no se hace (ni en la base de producción ni con SQL suelto).

## Opciones

1. **Un comando de Django.** Simple, pero en producción no hay una terminal a mano: habría que armar un job de Cloud Run solo para esto.
2. **Una acción en el admin.** La usa quien ya administra locales y personas, con confirmación y auditoría.
3. **Un botón en la app para el dueño.** Demasiado fácil de tocar sin querer, para algo que no se deshace.

## Decisión

Opción 2.

- En el admin, sección **Cuadernos → Cuadernos por local**, se ve cada local con cuántos movimientos, anulados y si tiene haber inicial. La acción **"Vaciar los cuadernos (movimientos y caja)"** borra los movimientos (también los anulados y las ventas que salen de un gasto) y el haber inicial.
- Solo la ven los **superusuarios**. Un local por vez.
- Antes de borrar muestra qué se va a perder y pide **escribir el nombre del local tal cual** y un **motivo**. Con el nombre mal escrito no borra nada.
- Todo en una transacción. La auditoría **no se borra** (la base no lo permite, ADR de auditoría): se agrega un registro `notebooks.empty` con quién, cuándo, el motivo, cuántos movimientos había y el haber inicial que tenía.
- "Cambios recientes" muestra solo lo posterior al último vaciado, para no listar movimientos que ya no existen. Desde [ADR-0017](0017-copiar-un-local-a-uno-de-pruebas.md), también lo posterior a la última copia a un local de pruebas.

## Consecuencias

- **No se puede deshacer.** La única vuelta atrás es restaurar un backup. Por eso la guía pide bajar el Excel antes, y vaciar recién cuando los backups estén andando.
- Si alguien carga mientras se vacía, lo que entre después del borrado queda. Conviene hacerlo cuando nadie esté usando la app.
- Migración 0007: un modelo proxy de los locales para la pantalla del admin. Sin tabla nueva, sin SQL.
