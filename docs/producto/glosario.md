# Glosario

Si una palabra significa una cosa en una reunión y otra en el código, tarde o temprano aparece un error. Este glosario fija el significado. Si falta un término, se agrega en el mismo PR que lo empieza a usar.

## Negocio

| Término | Significado | En el código |
|---|---|---|
| Local | Un comercio que usa el sistema. Tiene sus cuadernos, sus categorías y su gente | `Tenant` |
| Local de pruebas | Un local del equipo, no de un cliente. Se le puede copiar el local de un cliente para ver un problema con sus mismos datos (ADR-0017) | `Tenant.is_test` |
| Cuaderno | Lo que el local anotaba en papel. Comedor TJ lleva dos: "Costos" (cada gasto) y el anual (ventas y haber por turno) | app `notebooks` |
| Movimiento | Cada anotación: fecha, turno, tipo, categoría, descripción, importe y medio de pago | `Entry` |
| Turno | Mañana o noche. La caja se cierra al final de cada uno. El turno noche que termina después de medianoche conserva la fecha en que empezó | `shift` |
| Ingreso | Movimiento que suma. Incluye las ventas que se anotan a mano | `kind = income` |
| Gasto | Movimiento que resta | `kind = expense` |
| Haber | El efectivo que hay en la caja al cerrar un turno: haber anterior más ventas en efectivo, menos gastos en efectivo. No se guarda: se calcula (ADR-0008) | `notebooks.cash` |
| Haber inicial | La plata en efectivo con la que arranca la caja del sistema. Un solo monto, sin fecha ni turno: cada movimiento en efectivo que se carga, de la fecha que sea, lo suma o lo resta (ADR-0016). Lo carga el dueño | `CashOpening` |
| Cobrado sin efectivo | Ventas cobradas con débito, tarjeta, Mercado Pago o transferencia. Son venta, pero esa plata no está en la caja. En Comedor TJ son las ventas de los gastos con D (ADR-0010) | `sales_not_cash` |
| D (débito) | Marca al final de algunos gastos del cuaderno de Costos: se pagaron con tarjeta de débito. El dueño anota cada uno dos veces: el gasto y una venta por el mismo monto, en un renglón aparte. En el sistema se carga el gasto con Débito y el tilde "Sumarlo también a la venta" crea la venta (ADR-0010). Los gastos por transferencia funcionan igual (ADR-0013) | `from_expense` |
| Cuentas personales | Los cuadernos son las cuentas del dueño, no la contabilidad del local. Las ventas del local están en iCOM y no se cruzan con los cuadernos (ADR-0009, ADR-0010) | |
| Categoría | Agrupa movimientos del mismo tipo para los reportes. Cada local tiene las suyas | `Category` |
| Medio de pago | Efectivo, débito, crédito, QR o transferencia | `payment_method` |
| Medios que vienen marcados | Ajuste del local que elige el dueño: con estos medios, el tilde para sumar también la venta viene marcado. Cualquier gasto que no sea en efectivo lo muestra. De entrada, débito y transferencia (ADR-0013, ADR-0014) | `ShopSettings.sale_methods` |
| Venta espejo | Idea descartada (ADR-0008): crear una fila extra para compensar lo que no es efectivo. Hoy el medio de pago dice si un movimiento toca la caja | |
| Resultado | Ingresos menos gastos del período, con cualquier medio de pago, sin contar los anulados. No es lo mismo que el haber | |
| Corregir | Cambiar datos de un movimiento, con motivo. Queda en el historial | |
| Anular | Dejar un movimiento sin efecto, con motivo. Sigue visible y no suma | `is_voided` |
| Historial | Lista de cambios de un movimiento: quién, cuándo, motivo, antes y después. Se arma con la auditoría | |

## Personas y permisos

| Término | Significado | En el código |
|---|---|---|
| Membresía | Relación entre una persona, un local y un rol. Una persona puede tener varias, con roles distintos en cada local | `Membership` |
| Dueño | Rol que puede todo en un local, incluidas las categorías | `owner` |
| Carga | Rol que carga, corrige y anula movimientos | `editor` |
| Consulta | Rol que ve movimientos, historial y reportes, y exporta | `viewer` |
| Equipo | Quienes desarrollan y operan el sistema. Dan de alta locales y personas | administrador de Django |

## Arquitectura

| Término | Significado |
|---|---|
| Tenant | Cliente aislado dentro del sistema. Acá, un local |
| RLS | Row Level Security de PostgreSQL: la base filtra las filas por local aunque el código se olvide |
| Auditoría | Registro de solo agregar de cada cambio importante, escrito en la misma transacción que el cambio |
| Idempotente | Que repetir una operación da el mismo resultado que hacerla una vez. Evita movimientos duplicados por un doble toque |
| ADR | Architecture Decision Record: documento corto que registra una decisión, sus opciones y sus consecuencias |
