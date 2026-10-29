# Usar los diagramas para aprender y enseñar

El proyecto también es una escuela: se construye un sistema real para un cliente y, en el camino, se practican las buenas prácticas. Esta guía propone cómo usar los diagramas para eso.

## Una pregunta por tipo de diagrama

| Tipo | Pregunta | Error típico |
|---|---|---|
| Contexto (ARQ-01) | ¿Para quién existe? | Empezar por frameworks |
| Contenedores (ARQ-02) | ¿Qué se ejecuta por separado y dónde? | Confundir "una app" con "un proceso" |
| Casos de uso (CU) | ¿Qué puede hacer cada rol? | Usar "incluye" para algo que pasa solo a veces |
| Clases (CLA) | ¿Quién es responsable de cada regla? | Creer que ya existen esas clases |
| Datos (DAT) | ¿Qué se guarda y cómo se relaciona? | Diseñar tablas antes de entender el negocio |
| Secuencia (TEC) | ¿En qué orden y dónde está la transacción? | Responder al usuario antes del COMMIT |
| Flujo (FUN) | ¿Qué decide la persona y qué pasa si falla? | Dibujar solo el camino feliz |
| Estados (EST) | ¿Qué cambios son válidos? | Dejar que cualquier código cambie un estado |

## Cuatro recorridos con ejercicio

| Recorrido | Diagramas | Ejercicio |
|---|---|---|
| Seguir un gasto con espejo | FUN-02, TEC-01, CLA-01 | Señalar en qué momento exacto la persona ve "guardado" y qué filas ya existen. Cortar la conexión justo antes del COMMIT: ¿qué queda en la base? |
| Corregir sin romper el saldo | FUN-03, EST-01 | Pasar un gasto de transferencia a efectivo y después anularlo. Escribir qué filas cambian en cada paso y verificar que el saldo da igual que antes de cargarlo |
| Aislar locales | ARQ-04, DAT-01, FUN-01 | Dos locales y una persona con membresía en uno. Escribir el test que pide un movimiento del otro local y espera 404 |
| Llegar a producción | ARQ-05, TEC-02 | Hacer un cambio chico y llevarlo hasta pruebas sin tocar nada a mano. Anotar cada paso que no fue automático |

## Una clase de 30 minutos con el mismo caso

Caso ficticio: Local Norte. Tomás (rol carga) paga $ 20.000 a un proveedor por transferencia y anota una venta de $ 50.000 en efectivo.

1. Mostrar CU-01 y FUN-02. ¿Puede Tomás cargar? ¿Puede crear una categoría nueva?
2. Seguir TEC-01: ¿qué filas se escriben en la transacción del gasto? (gasto, venta espejo, auditoría).
3. Calcular el saldo y los totales del día con las reglas de HU-023 y HU-025. ¿Cuánto suman las ventas?
4. Tomás se equivocó: era en efectivo. Recorrer FUN-03: ¿qué pasa con el espejo? ¿Qué ve Ana (rol consulta) en el historial?
5. Convertir lo visto en tres criterios Dado / Cuando / Entonces y compararlos con HU-025 y HU-026.

## Adjuntar un diagrama a una story

Texto para pegar en Jira:

```text
Diagrama: [ID y título]
Fuente: docs/diagramas/[documento]#[id]
Imagen adjunta: [ID].png
Escenarios que revisamos: camino feliz, error y reintento.
Pendientes que afectan esta story: [P-nn o ninguno].
Evidencia al terminar: [test o recorrido que lo demuestra].
```

## Mantenerlos vivos

Al cerrar una story, comparar el dibujo con el código y los tests. Si cambió una responsabilidad, una regla o un camino observable, se corrige el diagrama en el mismo PR. Un diagrama desactualizado enseña mal, que es peor que no tener diagrama.
