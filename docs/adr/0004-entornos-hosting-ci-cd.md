# ADR-0004. Entornos, hosting de bajo costo y CI/CD

- **Estado:** aceptada el 29/10/2026 (PR #1). Viene de ADR-0008 de floky, sin servidor local ni ARCA. Los precios y límites de los planes gratuitos cambian seguido: se verifican el día que se contrata. La fila del portal la reemplaza [ADR-0006](0006-react-servido-por-django.md): el portal lo sirve Django.

## Contexto

Queremos un entorno de **desarrollo** para cada uno, uno de **pruebas** y uno de **producción**, con despliegue automático y el menor costo posible.

Hay una diferencia importante con `floky`. Allá la venta pasaba en el local y la nube tenía una copia: si la nube fallaba, el local seguía. Acá **la nube es la única copia de los cuadernos**. Si la base se pierde, se pierde todo lo que no esté en un backup.

## Entornos

| Entorno | Dónde | Datos |
|---|---|---|
| Desarrollo | Docker Compose en la PC de cada uno: Django, PostgreSQL y Vite | Seed inventado |
| Pruebas | Proyecto propio en la nube, se despliega solo al mergear a `main` | Inventados |
| Producción | Proyecto propio en la nube, se promueve con aprobación | Reales |

Ni desarrollo ni pruebas apuntan a datos reales.

## Hosting propuesto (verificado para floky en septiembre y octubre de 2026)

| Pieza | Opción gratuita | Límites a tener en cuenta | Plan B pago |
|---|---|---|---|
| API Django (contenedor) | Google Cloud Run | 2 millones de requests y 180.000 vCPU-segundos por mes gratis; escala a cero; **pide cuenta de facturación** (poner alerta de presupuesto en USD 1) | Render o Railway, plan chico |
| PostgreSQL | Neon Free | 1 GB por proyecto, 100 CU-hora por mes, se suspende a los 5 minutos sin uso, **sin restauración a un punto en el tiempo** | Neon Launch o Supabase Pro |
| Portal | Cloudflare Pages | Uso comercial permitido; 500 builds por mes | No hace falta |
| Backups | GitHub Actions nocturno con `pg_dump` cifrado a Cloudflare R2 | Verificar el límite gratis de R2 el día que se configure | |

Descartados para producción: **Vercel Hobby** (solo uso personal y no comercial) y **Render Free** (se duerme a los 15 minutos, la base vence a los 30 días y su propia documentación dice que no es para producción).

> Ojo con Supabase Free: pausa el proyecto tras una semana sin actividad. Un local que no carga nada en una semana (vacaciones) lo pausaría.

## Quién paga el hosting

El hosting y el dominio los contrata y los paga cada cliente, directamente al proveedor, después de acordarlos con él. A nombre de quién quedan las cuentas es una pregunta abierta (P-04): cambia quién recibe los avisos de facturación y quién puede borrar el proyecto.

## Repositorio público

En el plan Free de GitHub, los environments con aprobación manual solo funcionan en repositorios públicos. Por eso este repo arranca público, con estas reglas: sin secretos y sin datos reales de clientes (ver `CONTRIBUTING.md`). Cuando pase a privado hay que decidir si se paga GitHub Pro o Team, o si la aprobación a producción se hace con otro mecanismo.

## CI/CD (GitHub Actions)

```text
PR abierto        → formato, lint, tipos, tests (pytest con PostgreSQL, vitest), build,
                    SAST, auditoría de dependencias, búsqueda de secretos
merge a main      → imagen de la API + migraciones + portal → pruebas
                    smoke test
tag vX.Y.Z        → aprobación manual (environment "production")
                    mismo artefacto → producción
nocturno          → backup de producción
mensual           → restauración del último backup en un entorno aislado
```

## Consecuencias

- Costo de la nube con pocos locales: **cero** dentro de los planes gratuitos. Riesgo: un pico o un error de configuración en Cloud Run se cobra; por eso la alerta de presupuesto.
- **Arranque en frío:** Cloud Run escala a cero y Neon se suspende sin uso. La primera pantalla después de un rato sin uso puede tardar unos segundos. Para cuadernos se acepta; si molesta, se paga una instancia mínima.
- **El backup es lo más importante del sistema.** Neon Free no restaura a un punto en el tiempo: si alguien borra datos a las 15 h, se vuelve al backup de la noche anterior y se pierde lo cargado ese día. Hasta pasar a un plan con restauración a un punto en el tiempo, el backup nocturno y la restauración mensual probada son obligatorios (HU-016).
- Con varios locales o más uso, se pasa la base a un plan pago. Es un cambio de configuración, no de código.

## Fuentes

- [SnapDeploy, estado de los planes gratuitos (septiembre 2026)](https://snapdeploy.dev/state-of-free-hosting)
- [AgentDeals, plan Free de Neon (verificado en octubre 2026)](https://agentdeals.dev/vendor/neon)
- [Flavio Copes, planes gratuitos lado a lado (septiembre 2026)](https://flaviocopes.com/hosting-free-tiers/)
- [Automation Atlas, límites de Supabase Free 2026](https://automationatlas.io/answers/supabase-free-tier-limits-2026/)
- [GitHub Docs, environments y planes](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
