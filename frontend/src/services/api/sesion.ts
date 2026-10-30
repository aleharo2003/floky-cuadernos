import type { Sesion } from '../../types';
import type { SesionService } from '../contratos';
import { pedir } from '../http';

export const sesionApi: SesionService = {
  actual: () => pedir<Sesion>('GET', '/auth/session/'),
  ingresar: (usuario, clave) => pedir<Sesion>('POST', '/auth/login/', { username: usuario, password: clave }),
  salir: () => pedir<Sesion>('POST', '/auth/logout/'),
  elegirLocal: (id) => pedir<Sesion>('POST', '/auth/tenant/', { tenant_id: id }),
};
