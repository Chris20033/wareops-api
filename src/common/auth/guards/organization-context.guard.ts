import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { MembershipStatus } from '../../../generated/prisma/enums.js';
import type { RequestWithId } from '../../http/request-with-id.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class OrganizationContextGuard implements CanActivate {
  constructor(private readonly prismaService: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithId>();

    if (!request.authContext) {
      throw new UnauthorizedException({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Se requiere autenticación.',
      });
    }

    const organizationId = request.header('x-organization-id')?.trim();

    if (!organizationId || !UUID_PATTERN.test(organizationId)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'La cabecera X-Organization-Id debe contener un UUID válido.',
        details: {
          fields: {
            'X-Organization-Id': [
              organizationId ? 'INVALID_UUID' : 'REQUIRED_HEADER',
            ],
          },
        },
      });
    }

    const membership = await this.prismaService.client.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: request.authContext.userId,
          organizationId,
        },
      },
      select: {
        id: true,
        organizationId: true,
        status: true,
        role: {
          select: {
            id: true,
            code: true,
            name: true,
            rolePermissions: {
              select: {
                permission: {
                  select: {
                    code: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'El recurso solicitado no existe.',
      });
    }

    request.tenantContext = {
      organizationId: membership.organizationId,
      membershipId: membership.id,
      roleId: membership.role.id,
      roleCode: membership.role.code,
      roleName: membership.role.name,
      permissions: new Set(
        membership.role.rolePermissions.map((rp) => rp.permission.code),
      ),
    };

    return true;
  }
}
