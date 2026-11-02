# Glosario

Si una palabra significa una cosa en una reunión y otra en el código, tarde o temprano aparece un error. Este glosario fija el significado. Si falta un término, se agrega en el mismo PR que lo empieza a usar.

## Negocio

| Término | Significado | En el código |
|---|---|---|
| Local | Un comercio que usa el sistema. Tiene sus cuadernos, sus categorías y su gente | `Tenant` |
| Cuaderno | Lo que el local anotaba en papel. Comedor TJ lleva dos: "Costos" (cada gasto) y el anual (ventas y haber por turno) | app `notebooks` |
| Movimiento | Cada anotación: fecha, turno, tipo, categoría, descripción, importe y medio de pago | `Entry` |
| Turno | Mañana o noche. La caja se cierra al final de cada uno. El turno noche que termina después de medianoche conserva la fecha en que empezó | `shift` |
| Ingreso | Movimiento que suma. Incluye las ventas que se anotan a mano | `kind = income` |
| Gasto | Movimiento que resta | `kind = expense` |
| Haber | El efectivo que hay en la caja al cerrar un turno: haber anterior más ventas en efectivo, menos gastos en efectivo. No se guarda: se calcula (ADR-0008) | `notebooks.cash` |
| Haber inicial | El último haber anotado en papel, con su fecha y turno. La caja del sistema arranca de ahí. Lo carga el dueño | `CashOpening` |
| Cobrado sin efectivo | Ventas cobradas con Mercado Pago, tarjeta o transferencia. Son venta, pero esa plata no está en la caja. En papel se restaba como costo ("MP") | `sales_not_cash` |
| D (debe) | Marca al final de algunos montos del cuaderno de Costos. Es un gasto común que resta | |
| Categoría | Agrupa movimientos del mismo tipo para los reportes. Cada local tiene las suyas | `Category` |
| Medio de pago | Efectivo, débito, crédito, QR o transferencia | `payment_method` |
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
