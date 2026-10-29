# Secuencias técnicas

**Estado: diseño objetivo.** Muestran el orden en que colaboran las piezas y dónde empieza y termina cada transacción.

<a id="tec-01"></a>

## TEC-01. Guardar un gasto con venta espejo

**Propósito:** mostrar que el gasto, su espejo y la auditoría se guardan juntos o no se guarda nada. **Stories:** HU-011, HU-014, HU-021, HU-025. **Viene de floky:** Nueva, con la idea de TEC-01.

<!-- diagram: TEC-01 -->
```mermaid
sequenceDiagram
    participant P as Persona con rol carga
    participant UI as Portal
    participant V as Vista DRF
    participant S as Servicio de cuadernos
    participant DB as PostgreSQL
    P->>UI: guarda un gasto de $ 20.000 por transferencia
    UI->>V: POST de movimiento con clave de idempotencia
    V->>V: valida datos y permiso de cargar en el local activo
    V->>S: registrar gasto
    Note over S,DB: una sola transacción
    S->>DB: BEGIN y SET LOCAL app.tenant_ids
    S->>DB: INSERT del gasto
    S->>DB: INSERT de la venta espejo apuntando al gasto
    S->>DB: INSERT de la auditoría
    S->>DB: COMMIT
    S-->>V: gasto y espejo
    V-->>UI: 201 creado
    UI-->>P: aparece en su día, en el saldo y en los totales
    Note over UI,V: si el mismo POST llega dos veces, la clave de idempotencia devuelve el primero
```

**Archivos TEC-01:** [SVG](svg/TEC-01.svg) · [PNG](png/TEC-01.png) · [Mermaid](fuentes/TEC-01.mmd).

**Lectura:** la persona ve "guardado" recién después del COMMIT. Si algo falla en el medio, no queda un gasto sin espejo ni un espejo suelto. El `SET LOCAL` hace que la base solo deje tocar filas del local activo, aunque el código se equivoque.

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
    GH->>CI: imagen de la API y portal
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
