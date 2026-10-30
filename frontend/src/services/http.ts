/**
 * Cómo habla el portal con la API: mismo origen, sesión por cookie y el token CSRF en cada
 * escritura (ADR-0006). Las pantallas no usan esto directo: pasan por los servicios.
 */

export class ErrorDeApi extends Error {
  constructor(
    mensaje: string,
    readonly estado: number,
    readonly codigo?: string,
  ) {
    super(mensaje);
  }
}

const SIN_DETALLE = 'No pudimos completar la operación. Probá de nuevo.';

function leerCookie(nombre: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((parte) => parte.startsWith(`${nombre}=`))
    ?.split('=')[1];
}

/** DRF responde `{detail}` o errores por campo (`{campo: [mensajes]}`). Se muestra el primero. */
function mensajeDe(cuerpo: unknown): { mensaje: string; codigo?: string } {
  if (cuerpo && typeof cuerpo === 'object') {
    const datos = cuerpo as Record<string, unknown>;
    if (typeof datos.detail === 'string') return { mensaje: datos.detail, codigo: datos.code as string | undefined };
    const primero = Object.values(datos)[0];
    if (Array.isArray(primero) && typeof primero[0] === 'string') return { mensaje: primero[0] };
  }
  return { mensaje: SIN_DETALLE };
}

export async function pedir<T>(
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  ruta: string,
  cuerpo?: unknown,
  extra: Record<string, string> = {},
): Promise<T> {
  const cabeceras: Record<string, string> = { Accept: 'application/json', ...extra };
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (metodo !== 'GET') cabeceras['X-CSRFToken'] = leerCookie('csrftoken') ?? '';

  let respuesta: Response;
  try {
    const opciones: RequestInit = { method: metodo, headers: cabeceras, credentials: 'same-origin' };
    if (cuerpo !== undefined) opciones.body = JSON.stringify(cuerpo);
    respuesta = await fetch(`/api${ruta}`, opciones);
  } catch {
    throw new ErrorDeApi('No hay conexión con el servidor. Revisá internet y probá de nuevo.', 0);
  }

  const datos = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const { mensaje, codigo } = mensajeDe(datos);
    throw new ErrorDeApi(respuesta.status === 429 ? 'Demasiados intentos. Esperá un minuto y probá de nuevo.' : mensaje, respuesta.status, codigo);
  }
  return datos as T;
}
