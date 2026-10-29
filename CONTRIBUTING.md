# Cómo trabajamos

## Idiomas

- **Código, nombres, commits y ramas:** en inglés.
- **Documentación (README, ADRs, diagramas, backlog):** en español.

## Regla número uno: el repo es público

Todo lo que entra a git queda visible y se puede copiar, aunque después se borre o el repo pase a privado. Por eso nunca se suben:

- Secretos: contraseñas, tokens, claves de API, archivos `.env`.
- Certificados o claves privadas.
- Datos reales de clientes: nombres, importes, fotos o escaneos de cuadernos, exportaciones, copias de bases.

Los secretos van en los secretos de cada environment de GitHub o en el servicio donde corre la app. Los datos de prueba se inventan.

Si algo se subió por error, avisá enseguida. Un secreto expuesto se rota, no alcanza con borrar el commit.

## Principios del proyecto

Tres principios mandan en cada decisión técnica. Cuando propongas una solución en un PR o un ADR, explicá cómo cumple con los tres.

### 1. Buenas prácticas y patrones

- Código por capas, sin mezclar responsabilidades: vistas y serializers, servicios con las reglas de negocio, modelos y acceso a datos.
- Configuración por variables de entorno, nunca escrita en el código: claves, URLs, credenciales.
- Todo cambio de esquema va por una migración. Nadie toca tablas a mano.
- Tests obligatorios para la lógica de plata: saldos, totales, ventas espejo, filtros y exportaciones.
- Linters y formato automático en todo el código.

### 2. Escalable desde el día uno

- Diseñado para muchos locales y muchas personas, aunque hoy haya pocos.
- Todo dato de negocio lleva su local (`tenant_id`).
- API sin estado, consultas paginadas e índices en las tablas grandes.

### 3. Se despliega solo

- La API y el portal se despliegan solos al mergear a `main`, y a producción con un tag y una aprobación.
- Volver a la versión anterior es un paso documentado, no una improvisación.
- Un backup que nunca se restauró no cuenta como backup.

## Reglas de dinero

- Toda operación de plata corre dentro de `transaction.atomic()`, junto con su registro de auditoría (y su venta espejo, si corresponde).
- Los importes son `Decimal`, nunca `float`.
- Nada se borra: se anula con motivo, y queda quién y cuándo.

## Flujo de trabajo

1. Cada cambio sale de una issue de Jira (proyecto `FLC`). La rama empieza con su clave, así el PR aparece dentro de la issue: `FLC-12-walking-skeleton`.
2. Commits chicos con [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`.
3. Pull request contra `main`, con la plantilla completa. El título sigue Conventional Commits y termina con la clave de Jira entre paréntesis: `ci: add CI pipeline (FLC-5)`. Se mergea con squash, así que ese título es el mensaje que queda en `main`: revisalo antes de mergear.
4. **Nadie mergea su propio PR.** La otra persona revisa y aprueba.
5. CI tiene que estar en verde para mergear.

## Entornos

| Entorno | Se despliega |
|---|---|
| Desarrollo | En la PC de cada uno |
| Pruebas | Solo, al mergear a `main` |
| Producción | Desde un tag `vX.Y.Z`, con aprobación manual |
