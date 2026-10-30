# Cómo leer y usar el backlog

**Estado: borrador para revisar antes de cargar a Jira.**

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `00-como-leer-el-backlog.md` | Este archivo: convenciones, DoR, DoD, releases y cómo usamos Jira |
| `01-epicas-y-stories.md` | Las épicas y stories con sus criterios de aceptación |
| `02-preguntas-abiertas.md` | Lo que todavía no sabemos y qué stories bloquea |
| `jira-import.csv` | El mismo backlog, listo para importar en Jira. Se genera con `python docs/backlog/tools/build_jira_csv.py` |

La fuente de verdad del texto de cada story es `01-epicas-y-stories.md`. Si una story cambia en Jira durante el refinamiento, se actualiza también acá en un PR.

## Convenciones

- **IDs en los documentos:** `E01` a `E03` para épicas y `HU-001` en adelante para historias de usuario. Cada épica usa su decena (E01: HU-001 a HU-009; E02: HU-010 a HU-019; E03: HU-020 a HU-029), así una story nueva entra sin renumerar las demás.
- **Claves en Jira:** el proyecto se llama `FLC` y Jira numera solo (`FLC-1`, `FLC-2`…). El título de cada issue empieza con su `HU-`, así se la encuentra en los documentos: `FLC-5` · "HU-004. Integración continua en cada pull request".
- **Ramas y PRs** usan la clave de Jira, no la `HU-`: `FLC-5-ci-pipeline`. Así GitHub los muestra dentro de la issue.
- **Prioridad:** MoSCoW (Must, Should, Could). En Jira: Must = High, Should = Medium, Could = Low.
- **Estimación:** en story points, en la planning, entre los dos. El backlog no trae horas a propósito.
- **Diagramas:** los IDs (ARQ, CU, CLA, DAT, TEC, FUN, EST, OPS) apuntan a `../diagramas/`.
- **Criterios de aceptación:** en formato Dado / Cuando / Entonces. Cada uno se convierte en un test.

## Definition of Ready (cuándo una story puede entrar al sprint)

1. Los dos entienden igual los criterios de aceptación.
2. No tiene preguntas abiertas que cambien su alcance, o el riesgo está acotado por un spike con tiempo fijo.
3. Si toca más de un componente, tiene diagrama asociado.
4. Está estimada y entra en un sprint. Si no entra, se parte.

## Definition of Done (cuándo está terminada)

1. Entró a `main` por un pull request revisado por la otra persona, con CI en verde.
2. Cada criterio de aceptación tiene un test automático: unitario para reglas y dinero, de integración para API más base, end to end para los flujos críticos (ingresar, cargar, corregir, exportar).
3. Los límites de rol y de local tienen test (consulta recibe 403 al cargar; un local no ve datos de otro).
4. Toda operación de plata corre en `transaction.atomic()` junto con su auditoría y su venta espejo, si corresponde.
5. Si tiene pantalla, se probó en un celular de 390 px y en una PC.
6. Está desplegada en pruebas y pasó el smoke test.
7. Si cambió una responsabilidad, una regla o un flujo, se actualizó el diagrama o el ADR.

## Releases propuestos

R0 y R1 tienen que entrar en el plazo acordado con el primer cliente. Si en la planning no entran, se recorta R0 (por ejemplo, la promoción con aprobación puede ser manual al principio), nunca los permisos, la auditoría ni los backups de R1.

| Release | Contenido | Por qué en este orden |
|---|---|---|
| R0. Esqueleto | E01 menos HU-008 | Que el camino a pruebas y a producción funcione solo antes de escribir negocio |
| R1a. Primera versión | Versión corta de HU-001 a HU-005; HU-010, HU-012 a HU-014, HU-016, HU-020, HU-021, HU-023 a HU-028 | Mostrarle al cliente algo usable en una semana. Ver el detalle abajo |
| R1. Cuadernos | E02 y E03 | Lo que contrató el cliente. Primero locales, ingreso y permisos, porque todo lo demás se apoya en eso |
| Después | HU-008 y lo que pidan los clientes | Por ejemplo, que el dueño invite gente desde el portal |

### Qué trae y qué no trae R1a

Es una primera versión para mostrar, no la entrega final. La hace una sola persona en una semana.

| Trae | No trae todavía (va en R1) |
|---|---|
| Ingreso con usuario y contraseña, elegir local, roles dueño, carga y consulta | Recuperar la contraseña por email: la resetea el equipo (HU-012) |
| Cargar, corregir y anular con historial; venta espejo | Row Level Security: el aislamiento lo hace la app, con tests de fuga (HU-011) |
| Filtros, saldo, reporte por mes y por categoría | Entorno de pruebas y promoción con aprobación (HU-005, HU-006) |
| Exportar a Excel; PDF con la hoja de impresión del navegador | PDF generado en el servidor, si el de impresión no alcanza (HU-027) |
| Backup nocturno | Restauración mensual automática: la primera se hace a mano (HU-016) |
| CI con lint, tests y build | SAST, auditoría de dependencias y chequeo de migraciones (HU-004) |
| | Capacitación y guías (HU-029) |

Se publica en cuentas del equipo hasta que se acuerde a nombre de quién quedan las del cliente (P-04). Si P-01 no está resuelta, sale solo con ingreso y gasto; el haber se agrega al ver los cuadernos.

## Cómo usamos Jira

**Tablero:** To Do → In Progress → Blocked → In Review → Done.

| Columna | Significa |
|---|---|
| To Do | Entró al sprint y nadie la empezó |
| In Progress | Alguien la está haciendo. Una persona, una story a la vez |
| Blocked | No puede avanzar por algo externo. **Al moverla, se deja un comentario con el motivo y quién la puede destrabar.** Se repasa en cada daily |
| In Review | El PR está abierto y espera la revisión de la otra persona |
| Done | Cumple la Definition of Done |

**Ceremonias (sprints de 1 semana mientras dure R1, por el plazo corto):**
- **Refinamiento**, antes de cada planning: se revisan las próximas stories contra la Definition of Ready.
- **Planning:** se estima con planning poker y se arma el sprint con lo que entra.
- **Daily**, 10 minutos frente al tablero: qué se movió y qué está trabado.
- **Review y retro** al cerrar el sprint. De la retro sale al menos un cambio concreto, que se carga como issue del sprint siguiente.

## Trazabilidad con floky

Este backlog sale de `floky` (rama `main`). Si una story no figura, es nueva.

| Story | Viene de floky |
|---|---|
| HU-001 a HU-008 | HU-230 a HU-237, sin servidor local, instalador ni ARCA |
| HU-010 | HU-240, sin datos fiscales |
| HU-011 | HU-241 |
| HU-012 | HU-242, con entrada directa si hay un solo local |
| HU-013 | HU-243, con los roles carga y consulta en lugar de contador |
| HU-014 | HU-244 |
| HU-015 | HU-245, sin el estado de la sincronización |
| HU-016 | HU-246 |
| HU-020 | HU-210, con `tenant_id` obligatorio |
| HU-021 | HU-211 (la carga) |
| HU-022 | HU-212, sin la marca "del negocio" |
| HU-023 | HU-213, sin las salidas de caja |
| HU-024 | HU-214, sin candado ni segunda clave |
| HU-025 | Nueva |
| HU-026 | HU-211 (la corrección y la anulación), con historial visible |
| HU-027 | Nueva |
| HU-028 | HU-227, sin el panel del dueño |
| HU-029 | Nueva |

## Tips para usar este backlog

- **Estimen juntos.** Si uno dice 3 y el otro 13, lo valioso es la charla: alguno vio un riesgo que el otro no.
- **Cortar en vertical.** Una story atraviesa todas las capas aunque haga poco. "Crear la tabla de movimientos" no es una story; "cargar un gasto desde el celular y verlo en el saldo" sí.
- **Un spike tiene tiempo fijo.** Se decide antes cuánto se le da (por ejemplo, dos días) y al terminar se decide con lo aprendido.
- **Nadie mergea su propio PR.** El que revisa pregunta "¿por qué así?" y el que escribió tiene que poder explicarlo.
- **Si Blocked se llena seguido**, el problema no es el tablero: están entrando stories al sprint sin cumplir la Definition of Ready.
