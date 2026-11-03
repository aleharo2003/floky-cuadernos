# Flujos funcionales: lo que hace la persona

**Estado: diseño objetivo.** Cada flujo muestra decisiones y qué pasa ante errores.

<a id="fun-01"></a>

## FUN-01. Ingresar y elegir local

**Propósito:** definir qué pantalla ve cada persona al entrar. **Stories:** HU-011, HU-012, HU-013. **Viene de floky:** nueva, a partir del ingreso de FUN-07.

<!-- diagram: FUN-01 -->
```mermaid
flowchart TD
    A["Usuario y contraseña"] --> B{"¿Válidos?"}
    B -->|"no"| C["Rechazo sin decir cuál falló<br/>auditado"]
    B -->|"sí"| D{"¿Cuántas membresías activas?"}
    D -->|"ninguna"| E["Mensaje: sin acceso a ningún local<br/>auditado"]
    D -->|"una"| F["Entra directo a ese local<br/>sin pantalla de selección"]
    D -->|"más de una"| G["Elegir local"]
    G --> H["Entra al local elegido"]
    F --> I["Pantalla inicial según su rol<br/>en ese local"]
    H --> I
    I --> J{"¿Tiene más de un local?"}
    J -->|"sí"| K["Selector de local en la barra"] --> G
    J -->|"no"| L["Sin selector"]
```

**Archivos FUN-01:** [SVG](svg/FUN-01.svg) · [PNG](png/FUN-01.png) · [Mermaid](fuentes/FUN-01.mmd).

**Lectura:** la cantidad de membresías activas decide la pantalla, no el rol. Una dueña con dos locales elige al entrar y puede cambiar sin volver a ingresar; una persona con un solo local nunca ve la selección ni se entera de que hay otros. Los permisos cambian con el local: se puede ser dueño en uno y consulta en otro. Si alguien fuerza el id de un local ajeno en la URL o en la API, recibe 404 (HU-011). Si se entra con email o con nombre de usuario está abierto (P-03).

<a id="fun-02"></a>

## FUN-02. Cargar un movimiento

**Propósito:** seguir la carga desde el permiso hasta que aparece en los totales y en la caja. **Stories:** HU-021, HU-024, HU-025. **Viene de floky:** FUN-06, sin segunda clave.

<!-- diagram: FUN-02 -->
```mermaid
flowchart TD
    A["Persona dentro de un local<br/>(FUN-01)"] --> B{"¿Rol carga o dueño?"}
    B -->|"no, consulta"| C["Ve movimientos y reportes<br/>no ve el botón de cargar<br/>la API responde 403"]
    B -->|"sí"| D["Fecha, turno, tipo, categoría,<br/>descripción, importe y medio"]
    D --> E{"¿Datos válidos?"}
    E -->|"no"| F["Error claro, no se guarda"] --> D
    E -->|"sí"| H["Movimiento y auditoría<br/>en una transacción"]
    H --> J["Aparece en la lista<br/>y en los totales del período"]
    H --> G{"¿Es en efectivo?"}
    G -->|"sí"| K["Mueve el haber de su turno:<br/>la venta suma, el gasto resta"]
    G -->|"no: Mercado Pago,<br/>tarjeta o transferencia"| L["Cuenta como venta o gasto,<br/>pero la caja no se mueve"]
```

**Archivos FUN-02:** [SVG](svg/FUN-02.svg) · [PNG](png/FUN-02.png) · [Mermaid](fuentes/FUN-02.mmd).

**Lectura:** la persona carga cada movimiento una sola vez, con su medio de pago, y el sistema decide si toca la caja (ADR-0008, HU-025). En Comedor TJ, un gasto con D (pagado con débito) se carga con Débito y el sistema suma su venta con débito por el mismo monto, como el renglón aparte que el dueño escribe en el cuaderno (ADR-0010).

<a id="fun-03"></a>

## FUN-03. Corregir o anular un movimiento

**Propósito:** definir qué pasa al corregir o anular, y con la caja. **Stories:** HU-024, HU-025, HU-026. **Viene de floky:** nueva.

<!-- diagram: FUN-03 -->
```mermaid
flowchart TD
    A["Movimiento en la lista"] --> B{"¿Rol carga o dueño?"}
    B -->|"no"| C["Ve el movimiento y su historial"]
    B -->|"sí"| D{"¿Está anulado?"}
    D -->|"sí"| E["No se toca más:<br/>se ve con su motivo"]
    D -->|"no"| F{"¿Qué hace?"}
    F -->|"corregir"| G["Cambia datos y escribe el motivo"]
    F -->|"anular"| H["Escribe el motivo"]
    G --> M["Auditoría con antes, después y motivo<br/>en la misma transacción"]
    H --> M
    M --> N["El cambio aparece en el historial<br/>del movimiento"]
    M --> O["La caja se recalcula sola<br/>desde el turno del movimiento"]
```

**Archivos FUN-03:** [SVG](svg/FUN-03.svg) · [PNG](png/FUN-03.png) · [Mermaid](fuentes/FUN-03.mmd).

**Lectura:** nada se borra: se corrige o se anula, siempre con motivo. Como el haber se calcula y no se guarda, no hay nada más que mantener en orden: si un gasto en efectivo pasa a ser por transferencia, la caja de ese turno y de los siguientes cambia sola. El historial que ve la persona se arma con la auditoría (HU-014): no hace falta otra tabla.
