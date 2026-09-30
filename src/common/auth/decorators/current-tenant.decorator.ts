import {
  createParamDecorator,
  type ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import type {
  RequestWithId,
  TenantMembershipContext,
} from '../../http/request-with-id.js';

export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantMembershipContext => {
    const request = ctx.switchToHttp().getRequest<RequestWithId>();

    if (!request.tenantContext) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'El recurso solicitado no existe.',
      });
    }

    return request.tenantContext;
  },
);
