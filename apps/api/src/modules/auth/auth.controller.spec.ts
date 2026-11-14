import { describe, expect, it } from '@jest/globals';
import { AuthController } from './auth.controller';
import { Role } from '../../common/enums';

describe('AuthController', () => {
  it('debe retornar el perfil autenticado proveniente del AuthGuard sin exponer campos extra', () => {
    const controller = new AuthController();

    const result = controller.getMe({
      id: 'user-uuid-1',
      name: 'Administrador Orión',
      email: 'admin@orion.cl',
      role: Role.admin,
    });

    expect(result).toEqual({
      id: 'user-uuid-1',
      name: 'Administrador Orión',
      email: 'admin@orion.cl',
      role: Role.admin,
    });
  });
});

