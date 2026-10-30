# ADR-0006. El portal React lo sirve Django, con sesión por cookie

- **Estado:** propuesta, 29/10/2026. Reemplaza la fila del portal de [ADR-0004](0004-entornos-hosting-ci-cd.md) (Cloudflare Pages) y cierra la duda de autenticación de [ADR-0002](0002-stack-django-react.md).

## Contexto

La primera versión se tiene que mostrar en una semana y la hace una sola persona. Gran parte de las pantallas de los cuadernos ya existe en una demo navegable en React, con las pantallas separadas de los datos por una capa de servicios. Pasar a plantillas de Django tiraría ese trabajo.

Con el portal en Cloudflare Pages y la API en Cloud Run, como decía ADR-0004, quedan dos despliegues, dos dominios, CORS y un esquema de tokens para la autenticación. Es configuración que no le suma nada al cliente.

## Opciones

| Opción | A favor | En contra |
|---|---|---|
| A. Portal en Pages, API en Cloud Run, con tokens | Front y back se despliegan por separado | Dos despliegues, CORS, guardar tokens en el navegador |
| B. Django sirve el build de React, sesión con cookie | Un solo despliegue, un solo dominio, sin CORS. La sesión y la protección CSRF de Django ya están hechas y probadas | La imagen lleva Node solo para compilar. Front y back salen siempre juntos |
| C. Plantillas de Django con HTMX | Sin build de front | Se pierde lo que ya está hecho en la demo |

## Decisión

Opción B.

- El frontend se compila con Vite y Django lo sirve con WhiteNoise, con nombres de archivo con hash y caché larga.
- La API vive bajo `/api/`. Cualquier otra ruta devuelve el `index.html` del portal, y React Router se encarga.
- **Autenticación por sesión con cookie** (`SessionAuthentication` de DRF). La cookie es `HttpOnly`, `Secure` y `SameSite=Lax`. Toda escritura lleva el token CSRF en la cabecera `X-CSRFToken`, y la capa de servicios del front lo agrega sola.
- La imagen se construye en dos etapas: Node compila el front y la imagen final es solo Python con los archivos ya compilados.

## Consecuencias

- Un servicio en Cloud Run y una base en Neon. Cloudflare Pages no se usa.
- Front y back se versionan y se despliegan juntos: no puede haber un portal nuevo hablando con una API vieja.
- Si un día hace falta una app nativa o un cliente externo, se agrega autenticación por token para esos casos. La sesión sigue para el portal.
- Los tests de la API usan el cliente de prueba de DRF con sesión, igual que el navegador.
