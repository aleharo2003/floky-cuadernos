# Secuencias técnicas

**Estado: diseño objetivo.** Muestran el orden en que colaboran las piezas y dónde empieza y termina cada transacción.

<a id="tec-01"></a>

## TEC-01. Guardar un gasto y ver la caja

**Propósito:** mostrar que el movimiento y su auditoría se guardan juntos o no se guarda nada, y que el haber se calcula al leerlo, sin filas extra. **Stories:** HU-011, HU-014, HU-021, HU-025. **Viene de floky:** Nueva, con la idea de TEC-01.

<!-- diagram: TEC-01 -->
```mermaid
sequenceDiagram
    participant P as Persona con rol carga
    participant UI as Portal
    participant V as Vista DRF
    participant S as Servicio de cuadernos
    participant DB as PostgreSQL
    P->>UI: guarda un gasto de $ 20.000 por transferencia, turno noche
    UI->>V: POST de movimiento con clave de idempotencia
    V->>V: valida datos y permiso de cargar en el local activo
    V->>S: registrar gasto
    Note over S,DB: una sola transacción
    S->>DB: BEGIN y SET LOCAL app.tenant_ids
    S->>DB: INSERT del gasto
    S->>DB: INSERT de la auditoría
    S->>DB: COMMIT
    V-->>UI: 201 creado
    UI->>V: GET de la caja del período
    V->>S: cierres por turno desde el haber inicial
    S->>DB: suma por fecha y turno, separando efectivo del resto
    S-->>UI: haber de cada turno
    UI-->>P: el gasto aparece en la lista, y la caja no baja porque no salió efectivo
    Note over UI,V: si el mismo POST llega dos veces, la clave de idempotencia devuelve el primero
```

**Archivos TEC-01:** [SVG](svg/TEC-01.svg) · [PNG](png/TEC-01.png) · [Mermaid](fuentes/TEC-01.mmd).

**Lectura:** la persona ve "guardado" recién después del COMMIT. El haber no se guarda en ninguna tabla: se calcula cada vez desde el haber inicial y los movimientos en efectivo (ADR-0008). Así no hay filas que mantener sincronizadas, y corregir o anular un movimiento corrige la caja sola. El `SET LOCAL` hace que la base solo deje tocar filas del local activo, aunque el código se equivoque.

<a id="tec-02"></a>

## TEC-02. CI/CD de punta a punta

**Propósito:** mostrar qué valida cada paso antes de llegar a producción. **Stories:** HU-004, HU-005, HU-006. **Viene de floky:** TEC-05, sin instalador.

<!-- diagram: TEC-02 -->
```mermaid
sequenceDiagram
    participant Dev as Desarrollador
    participant GH as GitHub
    participant CI as GitHub Actions
    participant Rev as Revisor
    participant Pru as Pruebas
    participant Prod as Producción
    Dev->>GH: abre pull request
    GH->>CI: formato, lint, tipos, tests, build, SAST, dependencias, secretos
    CI-->>GH: verde o rojo
    Rev->>GH: revisa y aprueba
    Dev->>GH: merge a main
    GH->>CI: imagen con la API y el portal compilado
    CI->>Pru: migraciones y despliegue
    CI->>Pru: smoke test
    Dev->>GH: tag vX.Y.Z
    GH->>CI: pipeline de producción
    CI-->>Rev: pide aprobación del environment production
    Rev->>CI: aprueba
    CI->>Prod: mismo artefacto probado
```

**Archivos TEC-02:** [SVG](svg/TEC-02.svg) · [PNG](png/TEC-02.png) · [Mermaid](fuentes/TEC-02.mmd).

**Lectura:** nadie mergea su propio PR y nadie aprueba su propio despliegue. A producción llega exactamente lo que pasó por pruebas, sin recompilar.
