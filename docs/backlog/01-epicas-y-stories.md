# Épicas y user stories

**Estado: borrador para revisar.** Convenciones, DoR, DoD y releases en [00-como-leer-el-backlog.md](00-como-leer-el-backlog.md). Preguntas sin resolver en [02-preguntas-abiertas.md](02-preguntas-abiertas.md) (se citan como P-nn). Decisiones en [../adr/](../adr/README.md). Los diagramas que se citan (ARQ, CU, CLA, DAT, TEC, FUN, EST, OPS) están en `../diagramas/`.

## Mapa de épicas

| Épica | Objetivo | Release |
|---|---|---|
| E01. Cimientos y entrega continua | Repo, entornos, CI/CD y documentación | R0 |
| E02. Locales, identidad y seguridad | Tenants, aislamiento, ingreso, permisos, auditoría y backups | R1 |
| E03. Cuadernos | Cargar, corregir, caja por turno, reportes, filtros, exportación y puesta en marcha | R1 |

```mermaid
graph LR
  E01[E01 Cimientos] --> E02[E02 Locales e identidad]
  E02 --> E03[E03 Cuadernos]
```

---

## E01. Cimientos y entrega continua

Repositorio, entornos, CI/CD y documentación. Tres entornos: desarrollo, pruebas y producción (ADR-0004). El objetivo es que desplegar sea aburrido.

### HU-001. Repositorio y convenciones
**Prioridad:** Must · **Etiquetas:** `devops`, `docs` · **Diagramas:** ARQ-03, TEC-02

Como desarrollador, quiero un repositorio con estructura y reglas claras, para que los dos trabajemos igual y nadie rompa `main`.

- Dado el repositorio, cuando lo clono, entonces encuentro `backend/` (Django, con las apps `core`, `accounts` y `notebooks`), `frontend/` (React), `docs/` y un README que explica cada carpeta.
- Dado un cambio, cuando intento pushear directo a `main`, entonces GitHub lo rechaza: solo entra por PR con una aprobación y CI en verde.
- Dado un PR, cuando lo abro, entonces aparece una plantilla con qué cambia, cómo se probó, la story y el checklist de la DoD.
- Dado un commit, cuando no sigue Conventional Commits, entonces el hook local o CI avisa.

### HU-002. Entorno de desarrollo reproducible
**Prioridad:** Must · **Etiquetas:** `devops` · **Diagramas:** ARQ-05

Como desarrollador, quiero levantar todo en mi PC con pocos comandos, para empezar a trabajar sin pedir ayuda.

- Dado una PC con Docker, cuando sigo el README, entonces en menos de 15 minutos tengo corriendo la API, el portal y la base.
- Dado el entorno levantado, cuando corro el seed, entonces tengo dos locales ficticios, una persona con dos locales, una con uno solo, una de cada rol, categorías, movimientos de ejemplo en los dos turnos y un haber inicial.
- Dado el seed, cuando lo reviso, entonces no tiene datos reales de clientes.

### HU-003. Esqueleto que camina: un saludo de punta a punta
**Prioridad:** Must · **Etiquetas:** `devops`, `arquitectura` · **Diagramas:** ARQ-02, ARQ-03

Como equipo, queremos un recorrido mínimo que atraviese todas las piezas, para encontrar los problemas de integración antes de escribir negocio.

- Dado el portal, cuando una persona de prueba ingresa y escribe un saludo, entonces la API lo guarda en la base bajo su local y lo muestra con su hora.
- Dado una persona de otro local, cuando entra, entonces no ve ese saludo.
- Dado este recorrido, cuando se mergea a `main`, entonces queda en pruebas sin pasos manuales.
- Dado el esqueleto, cuando una persona ingresa, entonces la sesión es por cookie y toda escritura lleva el token CSRF (ADR-0006).

> Tip: esta story es la que más enseña. Obliga a resolver despliegue, configuración, autenticación, aislamiento entre locales y CI antes de que haya presión por funcionalidades.

### HU-004. Integración continua en cada pull request
**Prioridad:** Must · **Etiquetas:** `devops`, `tests`, `seguridad` · **Diagramas:** TEC-02

Como revisor, quiero que CI valide cada PR, para revisar diseño y lógica en lugar de buscar errores que una máquina encuentra sola.

- Dado un PR, cuando se abre o actualiza, entonces CI corre formato y lint (ruff, oxlint), chequeo de tipos (mypy o pyright, `tsc`), tests (pytest con PostgreSQL en contenedor, vitest) y build.
- Dado una dependencia con vulnerabilidad alta o crítica, o un secreto en el código, cuando corre CI, entonces falla y dice cuál (pip-audit, npm audit, gitleaks).
- Dado código nuevo con un patrón inseguro de severidad alta o crítica, cuando corre CI, entonces el análisis estático lo marca en el PR y bloquea el merge; lo de severidad menor aparece como aviso sin bloquear (Semgrep CE, CodeQL mientras el repo sea público, Ruff `S`; ver ADR-0005).
- Dado migraciones nuevas, cuando corre CI, entonces se aplican sobre una base vacía y sobre una con el seed, y `makemigrations --check` confirma que no falta ninguna.
- Dado una app que importa algo de otra que no debería (por ejemplo, `core` importando de `notebooks`), cuando corre CI, entonces falla (ADR-0002).
- Dado el tiempo de CI, cuando pasa de 10 minutos, entonces se registra como deuda.

### HU-005. Despliegue continuo a pruebas
**Prioridad:** Must · **Etiquetas:** `devops` · **Diagramas:** ARQ-02, ARQ-05, TEC-02

Como equipo, queremos que cada merge a `main` quede en pruebas, para que el cliente pueda probar siempre la última versión.

- Dado un merge a `main`, cuando CI pasa, entonces se despliegan la API con el portal compilado y las migraciones al entorno de pruebas.
- Dado el despliegue, cuando termina, entonces corre un smoke test (salud, ingreso de prueba, lectura de un dato) y avisa si falla.
- Dado pruebas, cuando se usa, entonces tiene su propia base, con datos inventados.

> Pendiente P-04: a nombre de quién se abren las cuentas de hosting.

### HU-006. Promoción a producción con aprobación
**Prioridad:** Must · **Etiquetas:** `devops` · **Diagramas:** ARQ-05, TEC-02

Como responsable, quiero llevar a producción solo una versión probada y aprobada, para que un error de pruebas no llegue al cliente.

- Dado una versión probada, cuando creo el tag `vX.Y.Z`, entonces el pipeline espera aprobación manual en el environment "production" de GitHub.
- Dado la aprobación, cuando se despliega, entonces se promueve el mismo artefacto probado, sin recompilar.
- Dado un problema, cuando sigo el runbook de vuelta atrás, entonces vuelvo a la versión anterior en menos de 15 minutos.
- Dado una migración no compatible hacia atrás, cuando se planifica, entonces se parte en dos despliegues (expandir y después contraer).

### HU-007. Secretos por entorno
**Prioridad:** Must · **Etiquetas:** `seguridad`, `devops` · **Diagramas:** ARQ-05

Como responsable, quiero los secretos de cada entorno fuera del código, para que una filtración del repo no exponga nada.

- Dado cualquier secreto (base, claves, credenciales), cuando se usa, entonces viene de variables de entorno o del almacén de secretos de cada entorno, nunca del repo.
- Dado los tres entornos, cuando comparo sus secretos, entonces son distintos.
- Dado un secreto comprometido, cuando sigo el runbook, entonces lo roto sin redeployar código.

### HU-008. Documentación viva
**Prioridad:** Should · **Etiquetas:** `docs`

Como desarrollador, quiero la documentación en el repo y generada donde se pueda, para que no quede vieja.

- Dado la API, cuando corre CI, entonces se genera el contrato OpenAPI (drf-spectacular) y se publica como artefacto.
- Dado un diagrama Mermaid editado, cuando corro `npm run exportar` en `docs/diagramas/herramientas`, entonces se regeneran SVG, PNG y galería.
- Dado una decisión de arquitectura, cuando se toma, entonces queda un ADR y se actualiza el índice de `docs/adr/README.md`.

---

## E02. Locales, identidad y seguridad

Cada local es un tenant y se entra por membresía (ADR-0003). Ingreso con usuario y contraseña, permisos por rol, auditoría y backups.

### HU-010. Alta de un local
**Prioridad:** Must · **Etiquetas:** `tenants`, `backend` · **Diagramas:** ARQ-04, DAT-01, CU-01

Como equipo, quiero dar de alta un local, para que pueda empezar a usar los cuadernos.

- Dado nombre y zona horaria, cuando creo el local, entonces queda un tenant con identificador único.
- Dado el alta, cuando ocurre, entonces queda auditada.
- Dado un local nuevo, cuando se crea, entonces arranca sin categorías: se cargan las acordadas en la puesta en marcha (HU-029).

> En R1 el alta la hace el equipo desde el admin de Django.

### HU-011. Aislamiento entre locales
**Prioridad:** Must · **Etiquetas:** `tenants`, `seguridad`, `tests` · **Diagramas:** ARQ-04, DAT-01, TEC-01, FUN-01

Como dueño, quiero que ningún otro local vea mis datos, para confiar en el sistema.

- Dado cualquier tabla de negocio, cuando la reviso, entonces tiene `tenant_id` obligatorio y una política de Row Level Security.
- Dado una persona del local A, cuando pide un recurso del local B por su id, entonces recibe 404.
- Dado una consulta cruda que olvida filtrar por local, cuando se ejecuta con el usuario de la app, entonces la base igual la restringe.
- Dado la suite, cuando corre, entonces tiene tests de fuga entre dos locales para cada endpoint de lectura y escritura.

### HU-012. Ingresar al portal y elegir local
**Prioridad:** Must · **Etiquetas:** `auth`, `frontend`, `backend`, `tenants` · **Diagramas:** FUN-01, ARQ-04, CU-01, CU-02

Como persona con acceso al portal, quiero entrar con mi usuario y contraseña y llegar al local que me toca, para trabajar desde cualquier lugar.

- Dado credenciales válidas y una sola membresía activa, cuando ingreso, entonces entro directo a ese local, sin pantalla de selección.
- Dado credenciales válidas y más de una membresía activa, cuando ingreso, entonces elijo el local en una pantalla y entro a ese.
- Dado que estoy dentro de un local y tengo más de uno, cuando uso el selector de la barra, entonces cambio de local sin volver a ingresar. Si tengo uno solo, el selector no aparece.
- Dado credenciales válidas sin membresías activas, cuando ingreso, entonces veo que no tengo acceso a ningún local y queda auditado.
- Dado credenciales inválidas, cuando ingreso, entonces el mensaje no dice si falló el usuario o la contraseña, y queda auditado.
- Dado 10 intentos fallidos con el mismo usuario, cuando pruebo otra vez, entonces queda bloqueado 15 minutos, aunque cambie de IP o el pedido llegue a otra copia del servidor. El admin de Django tiene el mismo límite (ADR-0011).
- Dado que olvidé la contraseña, cuando pido recuperarla, entonces recibo un enlace de un solo uso que vence, y al usarlo se cierran las otras sesiones.
- Dado un celular, cuando ingreso, entonces la pantalla de ingreso y la de elegir local se usan sin desplazarse hacia el costado.

> Pendiente P-03: si se ingresa con email o con nombre de usuario. Afecta la recuperación de contraseña.

### HU-013. Membresías y roles
**Prioridad:** Must · **Etiquetas:** `seguridad`, `auth`, `tenants` · **Diagramas:** ARQ-04, CLA-01, DAT-01, FUN-01, CU-01

Como equipo, quiero dar a cada persona acceso a uno o varios locales con un rol, para que cada una vea y haga solo lo suyo.

- Dado una persona y un local, cuando creo una membresía, entonces elijo el rol: dueño, carga o consulta.
- Dado una persona con membresías en dos locales, cuando ingresa, entonces elige entre los dos (HU-012); con una sola, entra directo.
- Dado una persona con roles distintos en dos locales, cuando cambia de local, entonces sus permisos cambian con el local.
- Dado una membresía desactivada, cuando la persona intenta entrar a ese local, entonces no puede; si era la única, no entra a ninguno.
- Dado un cambio de membresía o de rol, cuando ocurre, entonces queda auditado con antes y después.
- Dado los roles, cuando se leen, entonces vienen de la base, nunca de un dato que el usuario pueda editar.
- Dado el código, cuando valida un acceso, entonces pregunta por un permiso ("puede cargar"), no por el nombre del rol.

> En R1 las membresías las crea el equipo desde el admin de Django durante la puesta en marcha (HU-029).

### HU-014. Auditoría de solo agregar
**Prioridad:** Must · **Etiquetas:** `seguridad`, `auditoria` · **Diagramas:** DAT-01, TEC-01, CU-02

Como dueño, quiero un registro que nadie pueda modificar de las acciones importantes, para saber quién hizo qué y cuándo.

- Dado un evento auditable, cuando ocurre, entonces se escribe con actor, acción, entidad, antes, después, motivo, local y hora, en la misma transacción.
- Dado una entrada, cuando alguien intenta editarla o borrarla, entonces la base lo impide (permiso revocado y trigger).
- Dado la auditoría, cuando se consulta, entonces está paginada y filtra por local, actor, acción y fecha.

### HU-015. Endurecimiento base de la API
**Prioridad:** Must · **Etiquetas:** `seguridad`, `backend`, `observabilidad`

Como sistema, quiero las protecciones básicas activas desde el primer despliegue, para no depender de acordarse después.

- Dado cualquier solicitud, cuando no es HTTPS, entonces se redirige o rechaza; las cabeceras de seguridad y CORS están configuradas solo para los orígenes propios.
- Dado cualquier entrada, cuando llega a una vista, entonces la validó un serializer.
- Dado solicitudes repetidas desde un origen, cuando pasan el umbral, entonces se limitan (throttling de DRF).
- Dado una solicitud, cuando se procesa, entonces los logs son estructurados, con id de correlación y sin datos sensibles.
- Dado el endpoint de salud, cuando se consulta, entonces informa si la base responde y qué versión está corriendo.

### HU-016. Backup con restauración probada
**Prioridad:** Must · **Etiquetas:** `ops`, `datos` · **Diagramas:** ARQ-02, OPS-01

Como dueño, quiero que los cuadernos no se pierdan nunca, porque solo viven en la nube.

- Dado la base de producción, cuando es de noche, entonces un job hace `pg_dump`, lo cifra y lo guarda fuera del proveedor de la base, con retención documentada.
- Dado un backup, cuando se restaura en un entorno aislado al menos una vez por mes, entonces se marca verificado. Un backup sin restauración probada no cuenta.
- Dado un backup o una restauración que falla, cuando pasa, entonces el equipo recibe un aviso.

---

## E03. Cuadernos

Reemplazan a los cuadernos de papel del local: ingresos, gastos y haber cargados a mano. Viven **solo en la nube** y son **de cada local** (ADR-0003). No leen ni escriben nada del sistema de caja. Todas sus pantallas se usan desde un celular de 390 px y desde la PC.

> Los cuadernos de Comedor TJ se vieron el 30/10/2026 y el cliente explicó el haber el 02/11/2026 (P-01, P-02, ADR-0008).

### HU-020. Modelo de movimientos y categorías
**Prioridad:** Must · **Etiquetas:** `backend`, `db`, `cuadernos` · **Diagramas:** ARQ-03, CLA-01, DAT-01

Como desarrollador, quiero las tablas de los cuadernos de cada local, para representar bien ingresos, gastos, haber y saldo.

- Dado un movimiento, cuando se crea, entonces tiene local, fecha, turno (mañana o noche), tipo, categoría, descripción, importe, medio de pago y quién lo cargó.
- Dado un movimiento o una categoría, cuando se guarda, entonces tiene `tenant_id` obligatorio y la base aplica Row Level Security (HU-011).
- Dado un importe, cuando se guarda, entonces es `numeric(14,2)`, nunca punto flotante.
- Dado un local, cuando arranca a usar el sistema, entonces tiene un haber inicial (fecha, turno e importe), uno solo por local.
- Dado movimientos en el tiempo, cuando se consultan, entonces se puede calcular el resultado de cualquier período y el haber de cualquier turno.

> El haber no es un tipo de movimiento: se calcula (ADR-0008). Por eso el tipo sigue siendo ingreso o gasto.

### HU-021. Cargar un movimiento
**Prioridad:** Must · **Etiquetas:** `backend`, `frontend`, `cuadernos` · **Diagramas:** ARQ-01, FUN-02, TEC-01, CU-01

Como persona con rol carga o dueño, quiero anotar un movimiento desde el celular o la PC, para dejar de usar el cuaderno de papel.

- Dado datos válidos, cuando guardo, entonces el movimiento queda en el local activo y aparece en la lista de su día y en el saldo.
- Dado datos inválidos (importe cero o negativo, sin categoría, sin fecha, una categoría de otro tipo o de otro local), cuando guardo, entonces veo un error claro y no se escribe nada.
- Dado un doble toque o un reintento de la red, cuando llega dos veces el mismo pedido, entonces se guarda un solo movimiento (clave de idempotencia).
- Dado un celular de 390 px, cuando cargo un movimiento, entonces el formulario entra sin desplazarse hacia el costado y en el importe aparece el teclado numérico.
- Dado una PC, cuando cargo un movimiento, entonces lo puedo hacer sin el mouse.
- Dado el alta, cuando ocurre, entonces se escribe la auditoría en la misma transacción (HU-014).
- Dado Cargar, cuando entro, entonces la fecha (hoy) y el turno están a la vista, y el turno se elige con dos botones como Gasto e Ingreso, sin abrir nada. Si la fecha no es hoy, aparece "No es hoy" (10/11/2026).
- Dado un turno que toqué, cuando vuelvo a Cargar ese mismo día en el mismo dispositivo, entonces sigue elegido aunque no haya guardado. Al día siguiente se propone por la hora: Mañana antes de las 16 y Noche después (10/11/2026).
- Dado un celular de 390 px, cuando entro a Cargar, entonces la caja de hoy, la fecha, el turno y el botón "Guardar movimiento" se ven sin bajar (10/11/2026).

### HU-022. Administrar categorías
**Prioridad:** Should · **Etiquetas:** `backend`, `frontend`, `cuadernos` · **Diagramas:** CLA-01, CU-01

Como dueño, quiero administrar las categorías de los cuadernos de mi local, para que los movimientos se ordenen como pienso el negocio.

- Dado categorías de ingreso y de gasto, cuando creo, edito o desactivo una, entonces se refleja en el formulario y en los reportes, y los movimientos pasados conservan la suya.
- Dado una categoría con movimientos, cuando intento borrarla, entonces no se puede: se desactiva.
- Dado dos locales del mismo dueño, cuando creo una categoría en uno, entonces no aparece en el otro.
- Dado los roles carga y consulta, cuando buscan cómo administrar categorías, entonces no lo ven y la API responde 403.

### HU-023. Saldo y reporte del período
**Prioridad:** Must · **Etiquetas:** `backend`, `frontend`, `cuadernos`, `reportes` · **Diagramas:** CU-01

Como dueño, quiero el resultado del período, el efectivo en la caja y los totales por mes y por categoría, para ver cómo va el local.

- Dado un período, cuando lo abro, entonces veo total de ingresos, total de gastos, resultado, la comparación de ingresos contra gastos y la caja al cierre del período.
- Dado un mes, cuando miro el reporte, entonces veo el total y la cantidad de movimientos de cada categoría.
- Dado un año, cuando miro el reporte, entonces veo los totales de ingresos y gastos de cada mes uno al lado del otro.
- Dado movimientos anulados, cuando se calculan los totales y la caja, entonces no suman.
- Dado un celular, cuando abro el reporte, entonces se lee sin desplazarse hacia el costado.

### HU-024. Permisos por rol
**Prioridad:** Must · **Etiquetas:** `seguridad`, `auditoria`, `cuadernos` · **Diagramas:** FUN-02, FUN-03, CU-01

Como dueño, quiero que cada persona haga solo lo que su rol permite y solo en los locales donde tiene membresía, para que los cuadernos sean confiables.

- Dado el rol consulta, cuando usa los cuadernos, entonces ve movimientos, historial y reportes, y exporta; no ve botones para cargar, corregir, anular ni administrar categorías.
- Dado el rol carga, cuando usa los cuadernos, entonces además carga, corrige y anula; no administra categorías.
- Dado el rol dueño, cuando usa los cuadernos, entonces puede todo lo anterior y administrar categorías.
- Dado cualquier rol, cuando llama directo a la API una acción que su rol no permite, entonces recibe 403 y queda auditado.
- Dado una persona sin membresía en un local, cuando pide un movimiento de ese local por su id, entonces recibe 404 (HU-011).
- Dado un alta, una corrección o una anulación, cuando ocurre, entonces se escribe una entrada de auditoría en la misma transacción con actor, acción, motivo, antes y después.

### HU-025. Caja en efectivo (haber) por turno
**Prioridad:** Must · **Etiquetas:** `backend`, `frontend`, `cuadernos`, `dinero` · **Diagramas:** CLA-01, DAT-01, TEC-01, FUN-02, FUN-03, EST-01, CU-02

Como dueño, quiero ver cuánto efectivo hay en la caja al cerrar cada turno, como en el cuaderno, para saber si la plata cierra.

- Dado el haber inicial y los movimientos posteriores, cuando miro la caja, entonces cada turno muestra haber anterior, ventas, cobrado sin efectivo, gastos en efectivo y haber, del más nuevo al más viejo.
- Dado una venta cobrada con Mercado Pago, tarjeta o transferencia, cuando se guarda, entonces suma en las ventas y en el resultado, pero no en el haber.
- Dado un gasto pagado por transferencia o tarjeta, cuando se guarda, entonces suma en los gastos, pero no baja el haber.
- Dado un movimiento corregido o anulado, cuando miro la caja, entonces el haber de su turno y de los siguientes ya está recalculado.
- Dado un haber que queda negativo, cuando miro la caja, entonces el turno aparece en rojo con un aviso para revisar la carga. No se bloquea, porque los gastos se pueden cargar antes que las ventas.
- Dado el haber inicial, cuando lo carga el dueño, entonces queda con fecha, turno, importe y quién lo cargó. Cambiarlo pide motivo y queda en la auditoría. Carga y consulta no pueden.
- Dado los filtros de la lista, cuando filtro, entonces la caja no cambia: es la caja entera del local.
- Dado la pantalla Cargar, cuando elijo fecha y turno, entonces veo el efectivo que debería haber al cerrar ese turno, y se actualiza al guardar, corregir o anular. Si queda en negativo, aparece en rojo con el aviso (06/11/2026).
- Dado Reportes, cuando entro, entonces arriba de todo veo una burbuja con la caja de hoy (todo hasta hoy, nada futuro), que no cambia con el período ni los filtros y queda fija al bajar. Un ojito la tapa y el dispositivo se acuerda (09/11/2026).
- Dado Cargar, cuando entro, entonces arriba de todo veo la misma burbuja de la caja de hoy, que baja al guardar un gasto en efectivo. Si la tapé en Reportes, también está tapada en Cargar (10/11/2026).
- Dado el Excel, cuando exporto con haber inicial, entonces hay una hoja "Caja" con los cierres del período.
- Dado un gasto con débito, cuando lo cargo con el tilde "Sumarlo también a la venta", entonces se crea una venta con débito por el mismo monto, en la misma operación. Corregir el gasto la actualiza, anularlo la anula, y la venta no se puede corregir ni anular sola (ADR-0010).
- Dado un gasto que pasa de débito a efectivo y otra vez a débito, cuando lo corrijo, entonces se ofrece el tilde y la venta vuelve, como una venta nueva (ADR-0012).
- Dado un gasto por transferencia, cuando lo cargo con el tilde, entonces se crea su venta por transferencia, igual que con débito. Cualquier gasto que no sea en efectivo muestra el tilde; con los medios que elige el dueño en "Ajustes del local" viene marcado (de entrada, débito y transferencia), y el cambio queda en la auditoría (ADR-0013, ADR-0014).
- Dado el cálculo, cuando corren los tests, entonces hay un caso que reproduce la cuenta del cuaderno en papel (venta del turno, más la venta de los D, menos los costos con los D incluidos) y da lo mismo.

> Reemplaza a la venta espejo (ADR-0008). La venta de un gasto con débito no es un truco para la caja: es el renglón que el dueño escribe en su cuaderno (ADR-0010).

### HU-026. Corregir y anular con historial
**Prioridad:** Must · **Etiquetas:** `backend`, `frontend`, `cuadernos`, `auditoria` · **Diagramas:** FUN-03, EST-01, CU-01

Como persona con rol carga o dueño, quiero corregir o anular un movimiento con motivo y que se vea qué cambió, para arreglar errores sin esconderlos.

- Dado un movimiento, cuando lo corrijo con motivo, entonces se aplica y la auditoría guarda quién, cuándo, motivo, antes y después, en la misma transacción.
- Dado un movimiento cargado por error, cuando lo anulo con motivo, entonces deja de sumar en saldos y totales y sigue visible como anulado. No hay borrado.
- Dado una corrección o anulación sin motivo, cuando la guardo, entonces se rechaza.
- Dado un movimiento corregido o anulado, cuando cambia, entonces la caja se recalcula sola, sin tocar otras filas (HU-025).
- Dado un movimiento anulado, cuando intento corregirlo o reactivarlo, entonces no se permite: si fue un error, se carga de nuevo (EST-01).
- Dado cualquier movimiento y cualquier rol, cuando abro "Historial", entonces veo cada cambio con fecha, persona, motivo y los valores anteriores y nuevos.

### HU-027. Exportar el reporte a PDF y Excel
**Prioridad:** Must · **Etiquetas:** `backend`, `frontend`, `cuadernos`, `reportes` · **Diagramas:** ARQ-01, CU-02

Como persona con acceso a un local, quiero exportar el reporte del período, para mandarlo o guardarlo.

- Dado un período y los filtros aplicados, cuando exporto a PDF, entonces el archivo tiene el nombre del local, el período, los filtros, los totales por tipo y por categoría, la comparación de ingresos y gastos, el saldo, el detalle de movimientos y la fecha y hora de emisión.
- Dado lo mismo, cuando exporto a Excel, entonces cada movimiento es una fila, las fechas son fechas y los importes son números (no texto), y hay una hoja aparte con los totales.
- Dado movimientos anulados, cuando exporto, entonces no suman en los totales y aparecen marcados como anulados.
- Dado un haber inicial cargado, cuando exporto a Excel, entonces hay una hoja "Caja" con el haber de cada turno (HU-025).
- Dado un texto que empieza con "=" (descripción o categoría), cuando exporto a Excel, entonces queda como texto y no como fórmula, para que nada se ejecute al abrir el archivo.
- Dado cualquier rol, cuando exporta, entonces puede, y solo del local activo.
- Dado un año de movimientos, cuando exporto, entonces el archivo sale en menos de 10 segundos.

### HU-028. Búsqueda y filtros
**Prioridad:** Must · **Etiquetas:** `backend`, `frontend`, `cuadernos`, `reportes` · **Diagramas:** CU-01

Como persona con acceso a un local, quiero filtrar por fechas, categoría y tipo, para encontrar movimientos y mirar cualquier período.

- Dado la lista o el reporte, cuando elijo hoy, esta semana (desde el lunes) o este mes, entonces la lista, los totales y el resumen siguen la elección.
- Dado dos fechas escritas a mano, cuando el rango es válido, entonces pasa lo mismo. Cuando no lo es, entonces queda en pantalla el último período válido.
- Dado los filtros, cuando filtro por categoría, tipo (ingreso o gasto), medio de pago o texto de la descripción, entonces la lista, los totales y la exportación (HU-027) siguen los filtros.
- Dado los filtros, cuando pido ver los anulados, entonces aparecen marcados; por defecto no se muestran.
- Dado un movimiento guardado fuera del período en pantalla, cuando se guarda, entonces el período se estira para incluirlo.
- Dado un celular, cuando abro los filtros, entonces se despliegan en un panel que no tapa los totales.

### HU-029. Puesta en marcha
**Prioridad:** Must · **Etiquetas:** `ops`, `docs` · **Diagramas:** OPS-01, CU-01

Como dueño, quiero el sistema publicado, con mis usuarios y categorías listos y una capacitación, para empezar a usarlo sin depender del equipo.

- Dado producción, cuando se publica, entonces el portal responde por HTTPS en la dirección acordada y pasó el smoke test.
- Dado los locales y las personas que indica el dueño, cuando se configuran, entonces cada persona tiene sus membresías con su rol, y la que tiene un solo local entra directo.
- Dado los cuadernos de ejemplo revisados (P-01), cuando se configuran las categorías, entonces cada local tiene las suyas.
- Dado el backup, cuando se pone en marcha, entonces ya se hizo uno y se restauró en un entorno aislado (HU-016).
- Dado la capacitación, cuando termina, entonces cada rol tiene una guía de una página para celular y PC.

### HU-030. Sugerir la descripción al cargar
**Prioridad:** Should · **Etiquetas:** `backend`, `frontend`, `cuadernos` · **Diagramas:** FUN-01

Como quien carga, quiero que al escribir la descripción aparezcan las que ya usé, para cargar más rápido y que los nombres queden parejos en los filtros y el Excel.

- Dado un texto escrito en la descripción, cuando hay descripciones del mismo tipo (gasto o ingreso) en el local con alguna palabra que empieza así, entonces aparecen hasta 8, sin importar tildes ni mayúsculas ("carni" encuentra "Carnicería" y "Pago carnicería").
- Dado la lista, cuando se ordena, entonces van primero las que empiezan con lo escrito, después las más usadas y después las más recientes. El mismo texto con otras mayúsculas o tildes cuenta una vez, con la forma más usada.
- Dado una sugerencia, cuando la elijo con flechas y Enter o con el mouse, entonces se completa solo la descripción. El monto, la categoría y el medio de pago no cambian.
- Dado la lista abierta sin nada marcado, cuando aprieto Enter, entonces se guarda lo escrito, como siempre. Esc cierra la lista sin cerrar la ventana de corrección.
- Dado los movimientos anulados y las ventas que salen de un gasto, cuando se buscan sugerencias, entonces no aparecen.
- Dado quien solo consulta, cuando pide sugerencias, entonces no puede: no carga.

> Las decisiones (todo el tipo, solo la descripción, cualquier palabra) son del 06/11/2026. Con 65.700 movimientos responde en 0,025 s; si un local llegara a tener decenas de miles de textos distintos, la búsqueda pasa a la base con un índice.
