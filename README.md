# floky-cuadernos

Repositorio en construcción.

- Qué es y por dónde empezar: [docs/README.md](docs/README.md)
- Cómo trabajamos: [CONTRIBUTING.md](CONTRIBUTING.md)
- Cómo reportar un problema de seguridad: [SECURITY.md](SECURITY.md)

## Estructura

| Carpeta | Qué hay |
|---|---|
| `backend/` | Proyecto Django: apps `core`, `accounts` y `notebooks` (ADR-0002) |
| `frontend/` | Portal React + Vite. En producción lo sirve Django (ADR-0006) |
| `docs/` | Visión, ADRs, diagramas y backlog |

## Levantarlo en tu PC

Con Docker:

```text
docker compose up
```

Portal en http://localhost:5173, API y admin en http://localhost:8000. La primera vez tarda porque instala las dependencias.

Para tener datos de prueba (dos locales inventados y una persona de cada rol):

```text
docker compose exec api python manage.py seed_demo
```

Usuarios `lucia` (dueña de los dos locales), `tomas` (carga en uno), `ana` (consulta en uno) y `admin` (para el admin de Django), todos con la clave `clave-de-prueba-123`. Solo corre con la base vacía.

Sin Docker (con PostgreSQL instalado):

```text
cp .env.example .env            # y ajustar DATABASE_URL
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
set -a; . ../.env; set +a
python manage.py migrate
python manage.py runserver

cd ../frontend                  # en otra terminal
npm ci
npm run dev
```

## Antes de abrir un PR

```text
cd backend && ruff check . && ruff format --check . && pytest
cd frontend && npm run lint && npm run build
```

Es lo mismo que corre el CI.

## Desplegar

Se publica con un tag: `git tag v0.1.0 && git push origin v0.1.0`. GitHub corre los mismos chequeos del CI, pide aprobación, construye la imagen, corre las migraciones, publica en Cloud Run y hace una prueba de humo. Mergear a `main` no publica nada.

- Primera vez (cuentas, secretos, primer usuario): [docs/operacion/puesta-en-marcha.md](docs/operacion/puesta-en-marcha.md).
- Backups y cómo restaurar: [docs/operacion/backups.md](docs/operacion/backups.md).
- Por qué es así: [ADR-0007](docs/adr/0007-deploy-r1a.md).

Las migraciones corren en un paso aparte, antes de cada despliegue, nunca al arrancar el contenedor.

Todos los derechos reservados. Este repositorio es público, pero no otorga licencia de uso, copia ni distribución del código.
