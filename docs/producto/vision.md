# Visión del producto

## Qué es

Un sistema para reemplazar los cuadernos de papel donde un comercio anota ingresos, gastos y haber. Se usa desde el navegador del celular o de la PC, con usuario y contraseña, y cada persona ve solo los locales donde tiene acceso.

No está conectado con el sistema de caja del local. Cada movimiento se carga a mano.

## Para quién

| Persona | Qué necesita |
|---|---|
| Dueño | Ver cómo van sus locales desde cualquier lugar, ordenar los movimientos con sus categorías y darle acceso a su gente |
| Personal con rol carga | Anotar y corregir movimientos desde el celular, sin el cuaderno |
| Personal con rol consulta | Mirar movimientos y reportes, y exportarlos, sin poder cambiar nada |
| Equipo | Dar de alta locales y personas, publicar versiones y cuidar los backups |

Una persona puede tener acceso a varios locales, con un rol distinto en cada uno. Si tiene uno solo, entra directo.

## Lo que no se negocia

1. **No perder datos.** Los cuadernos viven solo en la nube: es la única copia. Backup todas las noches y una restauración probada por mes.
2. **Nada se borra.** Un movimiento se corrige o se anula con motivo, y queda a la vista qué cambió, quién y cuándo.
3. **Cada local ve solo lo suyo.** Lo garantiza la aplicación y también la base de datos.
4. **Se usa desde el celular.** Toda pantalla funciona en 390 px de ancho.

## Qué no hace

- No se conecta con el sistema de caja, ni lee, ni sincroniza, ni modifica sus datos.
- No factura, no lleva stock y no liquida sueldos.
- No maneja cuentas corrientes por persona ni pagos parciales: el haber es un registro simple.
- No funciona sin internet y no tiene app nativa para Android o iPhone.
- No incluye la carga de cuadernos viejos.

Cualquiera de estas cosas se evalúa aparte.

## Cómo está pensado

- **Solo en la nube** ([ADR-0002](../adr/0002-stack-django-react.md)): un portal React y una API Django con PostgreSQL.
- **Un local es un tenant** ([ADR-0003](../adr/0003-tenant-por-local.md)): el mismo sistema sirve a muchos locales, cada uno aislado de los demás. Se entra por membresía, con rol dueño, carga o consulta.
- **Entornos y despliegue automáticos** ([ADR-0004](../adr/0004-entornos-hosting-ci-cd.md)): desarrollo, pruebas y producción, con planes gratuitos mientras alcancen.

## Versiones

| Versión | Qué trae |
|---|---|
| R0. Esqueleto | Repositorio, CI/CD, entornos y un recorrido mínimo de punta a punta |
| R1. Cuadernos | Locales, ingreso, permisos, auditoría, backups, carga, corrección, venta espejo, reportes, filtros, exportación y puesta en marcha |
| Después | Que el dueño invite gente desde el portal, documentación generada, lo que pidan los clientes |

## Relación con floky

Nació como el módulo de cuadernos de `floky`, un punto de venta para restaurantes. Se separó porque se vende solo ([ADR-0001](../adr/0001-producto-aparte-de-floky.md)). Si algún día se hace el punto de venta, la identidad, los locales y los permisos de este repo se pueden reutilizar.
