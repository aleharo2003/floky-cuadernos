# ADR-0018. Los backups van a Cloud Storage, en el proyecto del dueño, cifrados para dos claves

- **Estado:** propuesta, 26/11/2026. Reemplaza la fila "Backup" de [ADR-0007](0007-deploy-r1a.md).

## Contexto

ADR-0007 mandaba los backups a Cloudflare R2, en una cuenta del equipo. Ahora las cuentas con costo pasan a nombre del dueño (P-04): el proyecto de Google Cloud y la organización de Neon quedan a su nombre y los paga él. Los backups seguían en una cuenta del equipo, con la tarjeta del equipo, y se cifraban con una sola clave que tenía solo el equipo. Si el equipo no está, el dueño no tiene cómo recuperar sus datos.

Además, el workflow de backup nunca llegó a correr: se salteaba todas las noches porque faltaba configurar R2.

## Opciones

1. **Seguir con R2 en la cuenta del equipo.** Gratis a este tamaño, pero queda fuera de las cuentas del dueño y suma un secreto más en GitHub (el token de R2).
2. **Google Drive del dueño.** Con una cuenta de Gmail común, una cuenta de servicio no puede guardar archivos en Mi unidad. Haría falta OAuth en nombre del dueño: el token vence cada 7 días mientras la app está en modo de prueba, y dejaría en GitHub una credencial con acceso a su Drive.
3. **Un hosting web.** No está pensado para guardar backups, cuesta todos los meses y suma otro secreto con más permisos de los necesarios.
4. **Un bucket de Cloud Storage en el proyecto del dueño.** Lo paga él (centavos a este tamaño), GitHub ya entra a ese proyecto sin archivos de clave y no hace falta ningún secreto nuevo.

## Decisión

Opción 4.

- Bucket privado `cuadernos-prod-backups` en `southamerica-east1`, con una regla que borra lo de `daily/` a los 30 días (ADR-0007 decía 35). Lo crea `tools/gcp_backup_setup.sh`.
- Sube la cuenta de servicio de deploy, que en ese bucket tiene solo `roles/storage.objectCreator`: puede crear archivos, pero no leerlos, pisarlos ni borrarlos. La subida usa `ifGenerationMatch=0`, así nunca reemplaza un backup existente.
- Para que el backup nocturno pueda entrar desde `main`, la condición de Workload Identity Federation acepta, además de los tags `v*`, **solo** el workflow `backup.yml` en `main` (claim `workflow_ref`). Cualquier otro workflow en `main` sigue sin poder entrar.
- El backup se cifra con `age` para **dos claves**: la del equipo (en el gestor de contraseñas) y la del dueño (impresa, en un sobre). Cualquiera de las dos lo abre.

Se eligió no crear una cuenta de servicio aparte para el backup.

## Consecuencias

- Los backups quedan en las cuentas del dueño y a su costo, y él puede recuperar sus datos sin depender del equipo.
- Backup y base siguen en proveedores distintos (Google y Neon).
- La cuenta de deploy ahora también se usa desde `main`, aunque solo desde `backup.yml`. Quien pueda cambiar ese archivo en `main` podría usar los permisos de deploy (Cloud Run Admin). Hoy solo el equipo puede mergear a `main`. Si eso cambia, conviene separar el backup en una cuenta de servicio propia, que solo pueda crear archivos en el bucket.
- El backup y la app quedan en el mismo proyecto de Google Cloud. Si se borra el proyecto entero, se van los dos. La base no, porque está en Neon.
