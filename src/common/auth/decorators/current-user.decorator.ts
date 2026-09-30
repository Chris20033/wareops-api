import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AuthenticatedUserContext,
  RequestWithId,
} from '../../http/request-with-id.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUserContext => {
    const request = ctx.switchToHttp().getRequest<RequestWithId>();

    if (!request.authContext) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Se requiere autenticación.',
      });
    }

    return request.authContext;
  },
);
