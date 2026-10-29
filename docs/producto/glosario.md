# Glosario

Si una palabra significa una cosa en una reunión y otra en el código, tarde o temprano aparece un error. Este glosario fija el significado. Si falta un término, se agrega en el mismo PR que lo empieza a usar.

## Negocio

| Término | Significado | En el código |
|---|---|---|
| Local | Un comercio que usa el sistema. Tiene sus cuadernos, sus categorías y su gente | `Tenant` |
| Cuaderno | Lo que el local anotaba en papel: sus movimientos. Si un local lleva uno o varios cuadernos se define al verlos (P-01) | app `notebooks` |
| Movimiento | Cada anotación: fecha, tipo, categoría, descripción, importe y medio de pago | `Entry` |
| Ingreso | Movimiento que suma. Incluye las ventas que se anotan a mano | `kind = income` |
| Gasto | Movimiento que resta | `kind = expense` |
| Haber | Tipo de anotación de los cuadernos. Qué significa y cómo afecta el saldo se define al verlos (P-01) | |
| Categoría | Agrupa movimientos del mismo tipo para los reportes. Cada local tiene las suyas | `Category` |
| Medio de pago | Efectivo, débito, crédito, QR o transferencia | `payment_method` |
| Venta espejo | Ingreso que el sistema crea solo por cada gasto pagado con débito, crédito, QR o transferencia, del mismo importe, para que el saldo no baje por plata que no salió del cajón. Sigue siempre a su gasto | `Entry.mirror_of` |
| Saldo | Ingresos menos gastos del período, sin contar los anulados | |
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
