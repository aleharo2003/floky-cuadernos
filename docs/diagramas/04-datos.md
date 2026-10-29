# Datos

**Estado: diseño objetivo.** Nombres de tablas y columnas en inglés, como en el código.

<a id="dat-01"></a>

## DAT-01. Base de datos

**Propósito:** mostrar qué se guarda, cómo se relaciona y cómo se aísla cada local. **Stories:** HU-010, HU-011, HU-013, HU-014, HU-020, HU-025. **Viene de floky:** DAT-02, solo Mis finanzas y membresías, más la auditoría de DAT-01.

<!-- diagram: DAT-01 -->
```mermaid
erDiagram
    USER ||--o{ MEMBERSHIP : has
    TENANT ||--o{ MEMBERSHIP : grants
    TENANT ||--o{ NOTEBOOK_ENTRY : owns
    TENANT ||--o{ NOTEBOOK_CATEGORY : owns
    TENANT ||--o{ AUDIT_ENTRY : records
    USER ||--o{ NOTEBOOK_ENTRY : creates
    USER ||--o{ AUDIT_ENTRY : acts
    NOTEBOOK_CATEGORY ||--o{ NOTEBOOK_ENTRY : classifies
    NOTEBOOK_ENTRY |o--o| NOTEBOOK_ENTRY : mirrors
    USER {
        uuid id PK
        string email UK
        bool is_active
    }
    TENANT {
        uuid id PK
        string name
        string timezone
    }
    MEMBERSHIP {
        uuid user_id FK
        uuid tenant_id FK
        string role "owner, editor o viewer"
        bool is_active
    }
    NOTEBOOK_ENTRY {
        uuid id PK
        uuid tenant_id FK "obligatorio, con RLS"
        uuid category_id FK
        uuid created_by FK
        uuid mirror_of FK "solo en la venta espejo"
        uuid idempotency_key UK
        date date
        string kind "income o expense, haber en P-01"
        string payment_method
        string description
        numeric amount "numeric 14,2"
        bool is_voided
        string void_reason
    }
    NOTEBOOK_CATEGORY {
        uuid id PK
        uuid tenant_id FK "con RLS"
        string name
        string kind
        bool is_active
        bool is_system
    }
    AUDIT_ENTRY {
        uuid id PK
        uuid tenant_id FK "con RLS"
        uuid actor_id FK
        string action
        string entity
        uuid entity_id
        json before
        json after
        string reason
        timestamp created_at
    }
```

**Archivos DAT-01:** [SVG](svg/DAT-01.svg) · [PNG](png/DAT-01.png) · [Mermaid](fuentes/DAT-01.mmd).

**Lectura:** `MEMBERSHIP` es la única puerta a un local. Todas las tablas de negocio tienen `tenant_id` y Row Level Security (ADR-0003). `mirror_of` une la venta espejo con su gasto para corregirlas y anularlas juntas; `is_system` marca la categoría de los espejos, que nadie edita. `AUDIT_ENTRY` es de solo agregar: la app no tiene permiso para modificarla ni borrarla, y de ahí sale el historial que ve la persona. `idempotency_key` evita que un doble toque cree dos movimientos.
