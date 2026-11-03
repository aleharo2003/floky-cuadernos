# Pruebas en navegador

Recorren la app entera en Chromium, como lo haría una persona: entrar con cada permiso, cargar, corregir, anular, filtrar, exportar, la caja, el celular, el menú de la cuenta, el tema oscuro y el contraste de los textos. Corren en el CI en cada PR y antes de cada despliegue.

| Archivo | Qué prueba |
|---|---|
| `carga.spec.ts` | La solapa Cargar: carga en serie, otro día, corregir, anular, historial, consulta |
| `reportes.spec.ts` | Filtros, anulados, Excel, resumen del año, PDF, la solapa en la dirección |
| `caja.spec.ts` | Caja por turno, Mercado Pago, caja negativa, haber inicial |
| `cuenta.spec.ts` | Categorías nuevas, cambiar la contraseña, salir desde cualquier pantalla |
| `pantalla.spec.ts` | Celular y compu, menú con teclado, tema oscuro, contraste (axe) |

## Fecha fija

El seed se carga con `--today 2026-03-11` y el reloj del navegador queda fijo en ese mediodía (`ayuda.ts`). Así los números no cambian según el día del mes en que corran, y el turno sugerido siempre es "mañana". La hora del servidor no se toca: el historial muestra la hora real.

## Correrlas en tu PC

Necesitan una base de PostgreSQL **vacía y descartable**: cada archivo la borra (`flush`) y vuelve a cargar el seed. Nunca apuntes `DATABASE_URL` a una base con datos que quieras conservar.

```text
cd frontend
npm ci
npx playwright install chromium   # la primera vez
npm run build                     # Django sirve este build

export DATABASE_URL=postgres://usuario:clave@localhost:5432/cuadernos_e2e
export DJANGO_SECRET_KEY=solo-para-pruebas
export E2E_PYTHON=../backend/.venv/bin/python   # el Python del backend
(cd ../backend && $E2E_PYTHON manage.py migrate)

npm run e2e
```

Playwright levanta Django solo (`runserver` en el puerto 8000). Si ya tenés uno corriendo en ese puerto, usa ese: fijate que apunte a la misma base.

Algunas opciones útiles:

```text
npm run e2e -- carga               # un solo archivo
npm run e2e -- --headed            # ver el navegador mientras corre
npx playwright show-report         # el informe de la última corrida
```

Si una prueba falla, en `test-results/` queda la captura y el paso a paso (`npx playwright show-trace <archivo>.zip`). En el CI se suben como artefacto `e2e-report`.
