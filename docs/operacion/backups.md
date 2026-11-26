# Backups

La nube es la única copia de los cuadernos ([ADR-0004](../adr/0004-entornos-hosting-ci-cd.md)). Esto es lo más importante del sistema.

## Cómo funciona

| Qué | Cómo |
|---|---|
| Cuándo | Todas las noches a las 03:17 (hora de Argentina), con el workflow `Backup` de GitHub Actions. También a mano con "Run workflow" |
| Qué guarda | Toda la base, con `pg_dump` en formato custom, leída con un usuario de solo lectura |
| Cifrado | Con `age`, para dos claves: la del equipo y la del dueño. Cualquiera de las dos abre el backup. GitHub tiene solo las claves públicas |
| Dónde | Cloud Storage, bucket `cuadernos-prod-backups` en el proyecto de Google Cloud del dueño, carpeta `daily/`. La base está en Neon, así que la copia queda en otro proveedor |
| Cuánto tiempo | 30 días, con una regla de ciclo de vida del bucket |
| Quién sube | La cuenta de servicio de deploy, que en ese bucket solo puede crear archivos: no puede leer, pisar ni borrar backups |
| Si falla | GitHub manda un email a quien modificó por última vez el workflow. Revisar la pestaña Actions una vez por semana |

Neon Free permite volver la base a cualquier momento de las **últimas 6 horas** (Backup & Restore en la consola de Neon). Sirve para un error del día. Para algo más viejo, o si se pierde el proyecto de Neon, se vuelve al backup de la noche anterior y se pierde lo cargado ese día.

## Restaurar

Sirve para la prueba mensual y para recuperarse de un desastre. Se hace en una base **vacía y aislada**, nunca sobre producción.

1. Bajá el backup desde la consola de Google Cloud: **Cloud Storage > Buckets > `cuadernos-prod-backups` > `daily/`** (`cuadernos-AAAAMMDD-HHMMSS.dump.age`). Hace falta una cuenta con permiso de lectura en el proyecto (Owner o Viewer).
2. Tené a mano una de las dos claves privadas: la del equipo (`cuadernos-backup.key`, en el gestor de contraseñas) o la del dueño (impresa, en el sobre).
3. Levantá Postgres local y creá una base vacía. Con el Docker Compose del repo:

```bash
docker compose up -d db
docker compose exec db createdb -U cuadernos restore_test
```

4. Restaurá:

```bash
bash tools/restore_backup.sh cuadernos-AAAAMMDD-HHMMSS.dump.age cuadernos-backup.key
```

El script se niega a escribir en una base que no esté vacía o que parezca la de producción. Al final muestra cuántos locales, personas, movimientos y cambios volvieron, y la fecha del último movimiento.

5. Compará esos números con producción (por ejemplo, desde el admin). Si coinciden, anotalo abajo.
6. Borrá la base de prueba y el archivo bajado: tienen datos reales.

> La versión de Postgres local tiene que ser igual o mayor que la de Neon. Neon está en 18 y el Compose en 16: para esta prueba cambiá la imagen de `db` a `postgres:18` (en un volumen nuevo, porque los datos de una versión mayor no los lee otra).

## Registro de restauraciones

Un backup sin restauración probada no cuenta (HU-016). Una fila por prueba, al menos una por mes.

| Fecha | Backup restaurado | Quién | Resultado |
|---|---|---|---|
| 30/10/2026 | Base de prueba local con datos inventados | Equipo | OK: mismos movimientos y auditoría que el original; la regla de auditoría solo-agregar sigue activa después de restaurar |
