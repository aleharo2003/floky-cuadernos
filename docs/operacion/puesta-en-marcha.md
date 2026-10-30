# Puesta en marcha

Paso a paso para publicar los cuadernos por primera vez, y cómo se publica cada versión después. Las decisiones detrás están en [ADR-0007](../adr/0007-deploy-r1a.md).

**Regla de oro:** ningún secreto pasa por el chat, por un issue, por un PR ni por el código. Cada secreto va directo de donde se genera a donde se usa (Secret Manager o los secretos de GitHub) y una copia queda en el gestor de contraseñas del equipo.

## Qué vas a necesitar

| Cuenta | Para qué | Costo esperado |
|---|---|---|
| Google Cloud | Correr la app (Cloud Run) y guardar los secretos | USD 0 dentro del cupo gratis. Pide tarjeta |
| Neon | La base de datos | USD 0 en el plan Free |
| Cloudflare | Guardar los backups (R2) | USD 0 hasta 10 GB. Pide tarjeta para activar R2 |
| GitHub | Ya está: corre los chequeos, publica y hace el backup | USD 0 |

Tiempo estimado la primera vez: una hora y media.

## 1. Google Cloud: proyecto, facturación y alerta

1. En la consola de Google Cloud, creá un proyecto. Sugerencia de nombre: `cuadernos-prod`. Anotá el **ID del proyecto** (puede ser distinto del nombre).
2. Vinculalo a una cuenta de facturación.
3. En **Facturación > Presupuestos y alertas**, creá un presupuesto de **USD 1** para ese proyecto, con avisos al 50 %, 90 % y 100 %.

> La alerta avisa, no corta el servicio. Por eso además la app tiene un tope de 2 instancias.

## 2. Neon: la base

1. Creá un proyecto en Neon con región **AWS South America (São Paulo)**.
2. Anotá la **versión de Postgres** que eligió (por ejemplo 17). La vas a cargar en GitHub como `PG_MAJOR`.
3. Creá una base llamada `cuadernos` (o usá la que viene, `neondb`, da igual: lo que importa es que la cadena de conexión apunte a ella).
4. En **Connect**, copiá la cadena de conexión **directa** (con "Connection pooling" apagado). Termina en `?sslmode=require`. No la pegues en ningún lado todavía: la pide el script del paso 3.
5. Creá el usuario de solo lectura para los backups. En el **SQL Editor** de Neon, con un password largo generado por el gestor de contraseñas:

```sql
CREATE ROLE cuadernos_backup WITH LOGIN PASSWORD 'PEGÁ-ACÁ-EL-PASSWORD-GENERADO';
GRANT CONNECT ON DATABASE cuadernos TO cuadernos_backup;
GRANT USAGE ON SCHEMA public TO cuadernos_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO cuadernos_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO cuadernos_backup;
-- Las tablas que creen migraciones futuras también se van a poder leer:
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public GRANT SELECT ON TABLES TO cuadernos_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public GRANT SELECT ON SEQUENCES TO cuadernos_backup;
```

> Si la base no se llama `cuadernos`, cambiá el nombre en la segunda línea. Si el dueño de la base no es `neondb_owner`, cambialo en las dos últimas. Corré estas líneas **después** de la primera publicación (paso 7), cuando ya existan las tablas.

Armá la cadena de conexión del backup igual que la directa, pero con `cuadernos_backup` y su password. Guardala en el gestor de contraseñas: va a GitHub en el paso 6.

## 3. Google Cloud: preparar el proyecto (script)

Abrí **Cloud Shell** (el ícono de terminal arriba a la derecha en la consola) y corré:

```bash
git clone https://github.com/aleharo2003/floky-cuadernos.git
cd floky-cuadernos
bash tools/gcp_bootstrap.sh ID-DEL-PROYECTO
```

El script:

- Prende las APIs que hacen falta.
- Crea el registro de imágenes, que guarda solo las últimas 5 para no pasarse del almacenamiento gratis.
- Crea dos cuentas de servicio: una para que GitHub publique y otra para que la app corra, cada una con lo mínimo.
- Te pide la cadena de conexión de Neon **sin mostrarla** y la guarda en Secret Manager. La clave secreta de Django la genera solo: nadie la ve.
- Configura que GitHub pueda entrar sin archivos de clave, solo desde este repo y solo al publicar un tag.

Al final imprime seis valores (`GCP_PROJECT_ID`, `GCP_PROJECT_NUMBER`, etc.). **No son secretos.** Copialos para el paso 6. También imprime la dirección donde va a quedar la app.

Si lo corrés de nuevo, no rompe nada: saltea lo que ya existe.

## 4. Cloudflare R2: dónde viven los backups

1. En Cloudflare, activá **R2** y creá un bucket llamado `cuadernos-backups`.
2. En el bucket, agregá una regla de ciclo de vida: **borrar los objetos con prefijo `daily/` a los 35 días**. Esa es la retención documentada.
3. Creá un token de API de R2 con permiso **Object Read & Write**, limitado a ese bucket. Te da un **Access Key ID** y un **Secret Access Key**: van al gestor de contraseñas y después a GitHub.
4. Anotá el **Account ID** de Cloudflare (aparece en la página de R2).

## 5. La clave para cifrar los backups

Los backups se cifran con [age](https://github.com/FiloSottile/age). GitHub tiene solo la clave **pública**: puede cifrar, pero no leer. La privada queda con el equipo.

En tu PC:

```bash
# Windows: winget install FiloSottile.age   macOS: brew install age   Linux: apt install age
age-keygen -o cuadernos-backup.key
```

- Muestra la clave pública, empieza con `age1...`. Va a GitHub como `BACKUP_AGE_RECIPIENT`.
- El archivo `cuadernos-backup.key` es la clave privada. **Guardalo en el gestor de contraseñas.** Sin ese archivo, los backups no se pueden abrir: perderlo es como no tener backups.
- Nunca lo subas al repo.

## 6. GitHub: environments, variables y secretos

En el repo, **Settings**:

**Environments**

| Environment | Configuración |
|---|---|
| `production` | Required reviewers: vos. Deployment branches and tags: solo tags con el patrón `v*.*.*` |
| `backup` | Deployment branches: solo `main` |

**Variables** (Settings > Secrets and variables > Actions > pestaña Variables). No son secretas:

| Variable | Valor |
|---|---|
| `GCP_PROJECT_ID`, `GCP_PROJECT_NUMBER`, `GCP_REGION`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`, `GCP_RUNTIME_SA` | Los que imprimió el script del paso 3 |
| `R2_ACCOUNT_ID` | El Account ID de Cloudflare |
| `R2_BUCKET` | `cuadernos-backups` |
| `BACKUP_AGE_RECIPIENT` | La clave pública `age1...` |
| `PG_MAJOR` | La versión de Postgres de Neon, por ejemplo `17` |

**Secretos del environment `backup`** (dentro del environment, no a nivel repo):

| Secreto | Valor |
|---|---|
| `BACKUP_DATABASE_URL` | La cadena de conexión con `cuadernos_backup` |
| `R2_ACCESS_KEY_ID` | Del token de R2 |
| `R2_SECRET_ACCESS_KEY` | Del token de R2 |

## 7. Primera publicación

Con `main` al día en tu PC:

```bash
git checkout main && git pull
git tag v0.1.0
git push origin v0.1.0
```

En la pestaña **Actions** aparece "Deploy". Corre los chequeos y después se frena esperando tu aprobación: **Review deployments > Approve**. Después construye la imagen, corre las migraciones, publica y hace la prueba de humo (la app responde, ve la base y la versión es la nueva). Al terminar, el resumen del workflow muestra la dirección.

Ahora sí, corré las líneas del usuario de backup del paso 2.

## 8. Primer usuario y datos del local

El primer usuario administrador se crea desde tu PC, contra la base de Neon. Así el password no queda en ningún log de la nube:

```bash
cd backend
source .venv/bin/activate        # o el entorno que uses
read -rs DATABASE_URL && export DATABASE_URL    # pegá la cadena directa de Neon; no se muestra
export DJANGO_SECRET_KEY=solo-para-este-comando
python manage.py createsuperuser
unset DATABASE_URL
```

Después, en `https://LA-DIRECCIÓN/admin/`, cargá los locales, las personas, sus membresías con el rol, y las categorías de cada local.

> Los datos reales (nombres, locales, montos) viven solo en producción. Nunca en el repo, en issues ni en capturas de los PR.

## 9. Primer backup y primera restauración

1. En **Actions > Backup > Run workflow**, correlo a mano. Tiene que terminar en verde y mostrar el tamaño del archivo.
2. Bajá ese archivo desde el bucket de R2.
3. Restauralo en una base vacía de tu PC, siguiendo [backups](backups.md#restaurar).
4. Si los números coinciden con producción, anotalo en la tabla de [backups](backups.md#registro-de-restauraciones).

Hasta que esto no esté hecho, el sistema no está listo para el cliente (HU-016, HU-029).

## 10. Chequeo final

- [ ] La dirección abre por HTTPS y muestra la pantalla de ingreso.
- [ ] Una persona con dos locales elige local; una con uno solo entra directo.
- [ ] Se carga, corrige y anula un movimiento, y aparece en el historial.
- [ ] El Excel baja y el PDF se imprime.
- [ ] El backup de la noche siguiente corrió solo.

## Publicar una versión nueva

1. Mergeá los PR a `main` como siempre. Eso **no** publica.
2. Cuando quieras publicar: `git tag vX.Y.Z` sobre `main` y `git push origin vX.Y.Z`.
3. Aprobá en Actions.

Para elegir el número: cambio que rompe algo para el usuario, el primero; algo nuevo, el del medio; arreglos, el último.

## Volver a la versión anterior

Si la versión nueva anda mal, en Cloud Shell:

```bash
gcloud run revisions list --service cuadernos --region southamerica-east1
gcloud run services update-traffic cuadernos --region southamerica-east1 --to-revisions NOMBRE-DE-LA-REVISIÓN-ANTERIOR=100
```

Es inmediato, y no hace falta pasar por GitHub.

> **Ojo:** volver atrás cambia el código, **no** deshace las migraciones. Por eso un PR con una migración que borra o transforma datos tiene que explicar cómo se vuelve atrás antes de mergearse.

## Si algo falla

| Qué pasa | Dónde mirar |
|---|---|
| El deploy falla en "Log in to Google Cloud" | Que las variables `GCP_*` estén bien copiadas y que se haya publicado con un tag, no desde una rama |
| Falla "Run migrations" | En Cloud Run > Jobs > `cuadernos-migrate`, los logs de la última ejecución. La versión anterior sigue andando |
| Falla la prueba de humo | En Cloud Run > `cuadernos` > Logs. Lo más común: la cadena de conexión de Neon mal cargada |
| La primera pantalla tarda unos segundos | Es normal después de un rato sin uso: Cloud Run y Neon se apagan solos (ADR-0004) |
| Llega un email de GitHub de que el backup falló | Actions > Backup, el paso en rojo. Se puede reintentar con "Run workflow" |
