# Clases del dominio

**Estado: diseño objetivo.** Muestra responsabilidades, no código que exista.

<a id="cla-01"></a>

## CLA-01. Locales, personas y cuadernos

**Propósito:** decidir quién es responsable de cada regla. **Stories:** HU-013, HU-020, HU-022, HU-025. **Viene de floky:** CLA-02, solo Mis finanzas, más personas y membresías.

<!-- diagram: CLA-01 -->
```mermaid
classDiagram
    class Local {
        nombre
        zonaHoraria
    }
    class Persona {
        email
        activa
    }
    class Membresia {
        rol
        activa
        puede(permiso)
    }
    class Movimiento {
        fecha
        tipo
        categoria
        descripcion
        importe
        medio
        espejoDe
        anulado
        motivoAnulacion
        cargadoPor
        corregir(datos, motivo)
        anular(motivo)
    }
    class Categoria {
        nombre
        tipo
        activa
        delSistema
    }
    class EntradaAuditoria {
        actor
        accion
        antes
        despues
        motivo
        hora
    }
    Persona "1" --> "*" Membresia
    Local "1" --> "*" Membresia
    Local "1" --> "*" Movimiento
    Local "1" --> "*" Categoria
    Movimiento "*" --> "1" Categoria
    Movimiento "0..1" --> "1" Movimiento : espejo de
    Movimiento ..> EntradaAuditoria : genera
    note for Movimiento "Un gasto que no es en efectivo genera su venta espejo. Nada se borra: se anula."
    note for Membresia "El código pregunta puede(permiso), nunca el nombre del rol."
```

**Archivos CLA-01:** [SVG](svg/CLA-01.svg) · [PNG](png/CLA-01.png) · [Mermaid](fuentes/CLA-01.mmd).

**Lectura:** el movimiento sabe corregirse y anularse, y al hacerlo arrastra a su venta espejo (`espejoDe`). La membresía es la única puerta: responde si una persona puede algo en un local. La auditoría es de solo agregar.
