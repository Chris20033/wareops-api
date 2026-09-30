import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestWithId } from '../../http/request-with-id.js';
import { REQUIRE_PERMISSIONS_KEY } from '../decorators/require-permissions.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(REQUIRE_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithId>();

    if (!request.tenantContext) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'El recurso solicitado no existe.',
      });
    }

    const hasAllPermissions = requiredPermissions.every((permission) =>
      request.tenantContext?.permissions.has(permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'No cuenta con permiso para esta operación.',
      });
    }

    return true;
  }
}
