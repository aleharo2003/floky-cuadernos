# ADR-0003. Cada local es un tenant y se entra por membresía

- **Estado:** aceptada el 29/10/2026 (PR #1). Viene de ADR-0004 de floky, con un cambio: los cuadernos pasan a ser del local y no del dueño.

## Contexto

El sistema tiene que servir a muchos locales sin cambiar el esquema. Una persona puede trabajar en varios locales, con un rol distinto en cada uno, y otra en uno solo. Los cuadernos los carga el dueño y también personal autorizado.

## Decisión

- **Tenant = local.** Cada local tiene sus movimientos, sus categorías y su gente.
- **Toda tabla de negocio lleva `tenant_id` obligatorio.**
- **Las personas entran por membresía:** persona + local + rol. Una persona con dos locales tiene dos membresías.
- **Roles:** dueño (todo, incluidas las categorías), carga (carga, corrige y anula) y consulta (ve, filtra, ve el historial y exporta). Los roles son conjuntos de permisos y el código valida permisos ("puede cargar"), no nombres de rol. Así se puede sumar un rol nuevo sin tocar el código.
- **Elegir local:** con una sola membresía activa se entra directo; con más de una se elige al ingresar y se puede cambiar sin volver a entrar.
- **Sin segunda clave.** En `floky` los cuadernos eran privados del dueño y se abrían con otra clave. Acá son del local y los protege la membresía, como todo lo demás.

## Aislamiento (defensa en profundidad)

1. **Aplicación:** un manager de Django por defecto que exige filtrar por el local activo, y un permiso de DRF que valida el local pedido contra las membresías de la persona.
2. **Base de datos:** Row Level Security de PostgreSQL en todas las tablas de negocio. Al empezar cada transacción, un middleware fija `SET LOCAL app.tenant_ids`; las políticas solo dejan ver las filas de esos locales.
3. **Tests de fuga:** cada endpoint tiene un test con dos locales y dos personas que intenta leer y escribir lo del otro. Pedir un recurso de otro local responde 404, no 403, para no confirmar que existe.

> Tip: la capa 1 sola alcanza casi siempre. La capa 2 está para el día que alguien escriba una consulta a mano y se olvide el filtro. Agregarla al principio cuesta poco; agregarla con datos de clientes adentro cuesta mucho.

## Consecuencias

- El usuario de base con el que corre la app no puede ser superusuario ni dueño de las tablas, porque si no RLS no aplica. Las migraciones corren con otro usuario.
- En R1 las membresías las crea el equipo durante la puesta en marcha. Que el dueño invite gente desde el portal queda para después.
- Si el dueño quiere anotar gastos personales, van en un local o se pide como función aparte.
