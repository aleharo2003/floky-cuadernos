# Backups

La nube es la única copia de los cuadernos ([ADR-0004](../adr/0004-entornos-hosting-ci-cd.md)). Esto es lo más importante del sistema.

## Cómo funciona

| Qué | Cómo |
|---|---|
| Cuándo | Todas las noches a las 03:17 (hora de Argentina), con el workflow `Backup` de GitHub Actions. También a mano con "Run workflow" |
| Qué guarda | Toda la base, con `pg_dump` en formato custom, leída con un usuario de solo lectura |
| Cifrado | Con `age`. GitHub tiene solo la clave pública. La privada está en el gestor de contraseñas del equipo |
| Dónde | Cloudflare R2, bucket `cuadernos-backups`, carpeta `daily/`. Otro proveedor que la base |
| Cuánto tiempo | 35 días, con una regla de ciclo de vida del bucket |
| Si falla | GitHub manda un email a quien modificó por última vez el workflow. Revisar la pestaña Actions una vez por semana |

Neon Free no restaura a un punto en el tiempo. Si alguien borra datos a las 15 h, se vuelve al backup de la noche anterior y se pierde lo cargado ese día.

## Restaurar

Sirve para la prueba mensual y para recuperarse de un desastre. Se hace en una base **vacía y aislada**, nunca sobre producción.

1. Bajá el backup desde R2 (`daily/cuadernos-AAAAMMDD-HHMMSS.dump.age`).
2. Tené a mano la clave privada `cuadernos-backup.key` del gestor de contraseñas.
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

> La versión de Postgres local tiene que ser igual o mayor que la de Neon. Si Neon está en 17 y el Compose en 16, cambiá la imagen de `db` a `postgres:17` para esta prueba.

## Registro de restauraciones

Un backup sin restauración probada no cuenta (HU-016). Una fila por prueba, al menos una por mes.

| Fecha | Backup restaurado | Quién | Resultado |
|---|---|---|---|
| 30/10/2026 | Base de prueba local con datos inventados | Equipo | OK: mismos movimientos y auditoría que el original; la regla de auditoría solo-agregar sigue activa después de restaurar |
