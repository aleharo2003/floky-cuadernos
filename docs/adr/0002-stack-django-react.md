# ADR-0002. Django + DRF + React, solo en la nube

- **Estado:** aceptada el 29/10/2026 (PR #1). Viene de ADR-0002 de floky, sin el modo local. La autenticación la define [ADR-0006](0006-react-servido-por-django.md).

## Contexto

Somos dos desarrolladores y Django y React son el stack que el equipo ya domina. En `floky` el mismo código corría en dos modos (en el local y en la nube). Los cuadernos viven solo en la nube: el segundo modo no hace falta.

## Decisión

- **Backend:** Django + Django REST Framework, con PostgreSQL. Todo cambio de esquema va por migraciones.
- **Frontend:** React + TypeScript + Vite. Las pantallas hablan con la API a través de una capa de servicios con contratos tipados, así se pueden probar con datos falsos.
- **Un solo proyecto Django, en un solo modo**, con tres apps:

| App | Qué hace | Depende de |
|---|---|---|
| `core` | Locales, auditoría, utilidades de dinero | nada |
| `accounts` | Personas, membresías, roles y permisos | `core` |
| `notebooks` | Movimientos, categorías, venta espejo, reportes y exportación | `core`, `accounts` |

- **Autenticación:** con el `User` de Django y la autenticación de DRF. Sesión con cookie ([ADR-0006](0006-react-servido-por-django.md)). Sin proveedores externos de identidad.
- **Tareas en segundo plano:** ninguna en R1. Las exportaciones son sincrónicas mientras tarden menos de 10 segundos (HU-027). El backup nocturno corre en GitHub Actions ([ADR-0004](0004-entornos-hosting-ci-cd.md)).

## Consecuencias

- Menos piezas que en `floky`: no hay worker, ni instalador, ni empaquetado para Windows.
- Las dependencias van en un solo sentido: `core` y `accounts` no importan nada de `notebooks`. Un test de arquitectura lo controla. Así se pueden reutilizar en otro producto ([ADR-0001](0001-producto-aparte-de-floky.md)).
- Toda operación de dinero corre dentro de `transaction.atomic()`, junto con su auditoría y su venta espejo.
- Si un día una exportación tarda más de 10 segundos, se agrega una cola. No antes.
