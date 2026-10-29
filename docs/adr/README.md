# Decisiones de arquitectura (ADR)

Un ADR registra una decisión importante: el contexto, las opciones que se miraron, lo que se eligió y lo que eso trae. Sirve para que dentro de un año alguien entienda por qué el sistema es así, y para que una decisión no se discuta de nuevo cada mes.

## Estados

- **Propuesta:** escrita y en revisión. Se puede cambiar.
- **Aceptada:** el equipo la aprobó. Se cambia solo con un ADR nuevo.
- **Reemplazada por ADR-XXXX:** quedó vieja. No se borra, para conservar la historia.

## Índice

| ADR | Decisión | Estado | Viene de floky |
|---|---|---|---|
| [0001](0001-producto-aparte-de-floky.md) | Los cuadernos son un producto aparte de floky | Propuesta | Nueva |
| [0002](0002-stack-django-react.md) | Django + DRF + React, solo en la nube | Propuesta | ADR-0002, sin el modo local |
| [0003](0003-tenant-por-local.md) | Cada local es un tenant y se entra por membresía | Propuesta | ADR-0004, con los cuadernos por local y sin segunda clave |
| [0004](0004-entornos-hosting-ci-cd.md) | Entornos, hosting de bajo costo y CI/CD | Propuesta | ADR-0008, sin servidor local ni ARCA |
| [0005](0005-analisis-estatico-seguridad.md) | Análisis estático de seguridad (SAST) en CI | Propuesta | ADR-0009 |

Todas pasan a aceptadas al mergear el PR que las agrega, si nadie pide cambios.

## Cómo escribir uno nuevo

Copiá la estructura de cualquiera de estos: estado, contexto, opciones, decisión y consecuencias. Que sea corto: si no entra en dos pantallas, probablemente son dos decisiones.
