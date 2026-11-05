# ADR-0011. Límite de ingresos fallidos: en la base, por usuario y por IP confiable

- **Estado:** aceptada, 05/11/2026. Sale de la revisión de seguridad previa a la entrega.

## Contexto

El ingreso usaba el límite de Django REST Framework: 10 intentos por minuto por IP, contados en la memoria de cada proceso. La revisión mostró tres agujeros:

- **La IP se podía inventar.** Se tomaba del encabezado `X-Forwarded-For` entero, que lo escribe quien hace el pedido. Con un valor distinto en cada intento, el contador arrancaba de cero.
- **Cada proceso contaba por su lado.** Con dos procesos el límite real era 20, y en Cloud Run crece con cada copia que se levanta.
- **El admin de Django no tenía límite.** Usa su propio ingreso, que no pasaba por el de la API.

## Opciones

| Opción | A favor | En contra |
|---|---|---|
| A. Caché compartida (Redis) para el límite de DRF | Es lo habitual | Un servicio más para pagar y cuidar. Sigue dependiendo de la IP. No cubre el admin |
| B. Contar los fallos en PostgreSQL, por usuario y por IP, desde el backend de autenticación de Django | Compartido por todas las copias sin servicios nuevos. Por usuario no depende de encabezados. El admin pasa por el mismo backend | Una consulta más por intento de ingreso. Alguien puede bloquear a propósito a un usuario por 15 minutos |

## Decisión

Opción B.

- Cada ingreso fallido se guarda en `FailedLogin` (usuario en minúsculas, IP y hora). Lo registra la señal `user_login_failed`, así que cuenta tanto la API como el admin. El cambio de contraseña cuenta la contraseña actual equivocada.
- Con **10 fallos del mismo usuario en 15 minutos**, ese usuario queda bloqueado hasta que pasen los 15 minutos, aunque escriba bien la contraseña. Un ingreso bueno borra sus fallos.
- Con **50 fallos desde la misma IP en 15 minutos**, esa IP queda bloqueada. Solo se aplica si la IP es confiable.
- **La IP confiable** sale de `X-Forwarded-For` contando desde el final las entradas que agregan nuestros propios proxies (`TRUSTED_PROXY_HOPS`). Cloud Run agrega la IP real al final: vale 1. Si se pone un balanceador delante (por ejemplo, para el dominio propio), pasa a 2. Sin proxies (en una PC) vale 0 y se usa la dirección de la conexión.
- Los números se cambian por variables de entorno, sin tocar código.

## Consecuencias

- Probar contraseñas sin límite deja de ser posible, cambie o no la IP, y con cualquier cantidad de copias.
- Alguien que conozca un nombre de usuario puede dejarlo afuera 15 minutos a propósito. Es el precio de no depender de la IP. Si pasa seguido, se baja la ventana o se agrega un aviso por mail.
- **Al poner el balanceador del dominio propio hay que cambiar `TRUSTED_PROXY_HOPS` a 2.** Si no, el límite por IP mira la dirección del balanceador y se vuelve inútil (el límite por usuario sigue funcionando).
- La tabla se limpia sola: cada fallo nuevo borra los de hace más de un día.
