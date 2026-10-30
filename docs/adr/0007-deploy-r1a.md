# ADR-0007. Cómo se publica R1a: San Pablo, un solo entorno, tag con aprobación

- **Estado:** propuesta, 30/10/2026. Baja a detalle [ADR-0004](0004-entornos-hosting-ci-cd.md) para la primera versión. No la reemplaza: el entorno de pruebas sigue siendo el objetivo para R1.

## Contexto

R1a se muestra al cliente la semana que viene y la hace una sola persona. ADR-0004 pide un entorno de pruebas y otro de producción, pero el backlog dejó el de pruebas para R1 (HU-005, HU-006). Entonces en R1a hay **un solo entorno en la nube, y ahí van a estar los datos reales**.

Las cuentas son del equipo hasta que se resuelva P-04 (a nombre de quién quedan las del cliente).

## Decisiones

| Tema | Decisión | Por qué |
|---|---|---|
| Región | Cloud Run en `southamerica-east1` y Neon en `aws-sa-east-1`, las dos en San Pablo | Cada pantalla hace varias consultas a la base: app y base tienen que estar juntas, y lo más cerca posible de Salta |
| Cuándo se publica | Al empujar un tag `vX.Y.Z`. Primero corren los mismos chequeos del CI y después GitHub pide aprobación en el environment `production` | Mergear a `main` no toca los datos reales. Publicar es una decisión explícita, con registro de quién aprobó |
| Login de GitHub en Google Cloud | Workload Identity Federation, limitado a este repo y a tags `v*` | Sin archivos de clave que se puedan filtrar ni vencer |
| Secretos de la app | En Secret Manager (`database-url`, `django-secret-key`). Solo la cuenta de servicio de la app los puede leer | GitHub nunca ve esos valores. La clave de Django la genera el script, nadie la conoce |
| Migraciones | Un job de Cloud Run (`cuadernos-migrate`) que corre antes de cada despliegue, con la misma imagen | Una sola vez por versión y antes de recibir tráfico, nunca al arrancar cada contenedor |
| Tamaño | De 0 a 2 instancias, 1 vCPU y 512 MiB | Cuesta cero sin uso. El tope de 2 evita que un error o un ataque genere una factura |
| Dirección | La fija de Cloud Run: `cuadernos-NÚMERO.southamerica-east1.run.app` | San Pablo no permite conectar un dominio propio directo. Para R1a alcanza |
| Backup | Nocturno con `pg_dump`, cifrado con `age` (solo la clave pública en GitHub), a Cloudflare R2. Retención: 35 días con una regla del bucket | Otro proveedor que la base. Si alguien entra a GitHub, no puede leer los backups |
| Restauración | Manual, con `tools/restore_backup.sh`, una vez por mes y antes de la entrega | El backlog dejó la automática para R1 (HU-016) |

## Opciones que se miraron

- **Estados Unidos (Virginia):** cupo gratis de Cloud Run completo (tier 1) y dominio propio directo, pero más lejos de Salta. Se descartó porque la velocidad es lo que más nota el cliente.
- **Publicar en cada merge a `main`:** más rápido, pero con un solo entorno cualquier error llega directo a los datos reales.
- **Clave JSON de una cuenta de servicio en los secretos de GitHub:** más simple de configurar, pero es una credencial permanente que hay que rotar y que se puede filtrar.

## Consecuencias

- San Pablo es tier 2 en Cloud Run: el cupo gratis rinde menos que en tier 1. Con el uso de un comedor sigue sobrando, pero conviene mirar la facturación el primer mes. La alerta de presupuesto en USD 1 es obligatoria.
- Neon Free tiene **0,5 GB por proyecto** (verificado el 30/10/2026; ADR-0004 decía 1 GB). Los cuadernos de un local ocupan muy poco, pero hay que revisarlo cuando haya varios locales.
- Sin entorno de pruebas, cada versión se prueba en local y en CI antes del tag. Una migración que borra o transforma datos necesita un plan de vuelta atrás escrito en el PR, porque volver a la versión anterior **no** deshace migraciones.
- Para tener un dominio propio (por ejemplo `cuadernos.comedortj.com.ar`) hace falta otra pieza delante de Cloud Run, como Firebase Hosting o un balanceador. Se decide cuando el cliente lo pida.
- GitHub desactiva los workflows programados de un repo público después de 60 días sin actividad. Si el repo queda quieto, el backup deja de correr: GitHub avisa por email y hay que reactivarlo.

## Fuentes

- [Cloud Run, regiones y tiers de precio](https://docs.cloud.google.com/run/docs/locations)
- [Cloud Run, precios y cupo gratis](https://cloud.google.com/run/pricing)
- [Cloud Run, dirección determinística del servicio](https://cloud.google.com/run/docs/triggering/https-request)
- [Neon, regiones](https://neon.com/docs/introduction/regions)
- [Neon, límites del plan Free](https://neon.com/faqs/free-plan-limits-and-quotas)
- [Cloudflare R2, precios y cupo gratis](https://developers.cloudflare.com/r2/pricing/)
