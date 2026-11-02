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
        turno
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
    class Caja {
        haberInicial
        cierres(desde, hasta)
        haberAl(fecha, turno)
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
    Local "1" --> "1" Caja
    Caja ..> Movimiento : suma lo que es en efectivo
    Movimiento ..> EntradaAuditoria : genera
    note for Movimiento "Nada se borra: se anula. El medio de pago dice si toca la caja."
    note for Membresia "El código pregunta puede(permiso), nunca el nombre del rol."
```

**Archivos CLA-01:** [SVG](svg/CLA-01.svg) · [PNG](png/CLA-01.png) · [Mermaid](fuentes/CLA-01.mmd).

**Lectura:** el movimiento sabe corregirse y anularse. La caja no guarda nada propio salvo el haber inicial: calcula el haber de cada turno con los movimientos en efectivo, así que corregir o anular un movimiento la corrige sola (ADR-0008). La membresía es la única puerta: responde si una persona puede algo en un local. La auditoría es de solo agregar.
