import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ROLE_CODES } from '../../common/auth/rbac.constants.js';
import type {
  AuthenticatedUserContext,
  TenantMembershipContext,
} from '../../common/http/request-with-id.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AuthMapper } from '../auth/auth.mapper.js';
import type { AccessibleOrganizationSummaryDto } from '../auth/dto/auth-response.dto.js';
import type {
  CurrentOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto.js';
import { OrganizationsMapper } from './organizations.mapper.js';
import { OrganizationsRepository } from './organizations.repository.js';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
  ) {}

  async listAccessibleOrganizations(
    currentUser: AuthenticatedUserContext,
  ): Promise<AccessibleOrganizationSummaryDto[]> {
    const memberships =
      await this.organizationsRepository.listAccessibleMembershipsForUser(
        currentUser.userId,
      );

    return memberships.map((membership) =>
      AuthMapper.toAccessibleOrganizationDto(membership),
    );
  }

  async getCurrentOrganization(
    tenant: TenantMembershipContext,
  ): Promise<CurrentOrganizationDto> {
    const organization =
      await this.organizationsRepository.findOrganizationById(
        tenant.organizationId,
      );

    if (!organization) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'El recurso solicitado no existe.',
      });
    }

    return OrganizationsMapper.toCurrentOrganizationDto(organization, tenant);
  }

  async updateCurrentOrganization(
    tenant: TenantMembershipContext,
    dto: UpdateOrganizationDto,
  ): Promise<CurrentOrganizationDto> {
    if (tenant.roleCode !== ROLE_CODES.OWNER) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message:
          'Sólo el propietario (OWNER) puede modificar datos de la organización.',
      });
    }

    if (
      dto.name === undefined &&
      dto.slug === undefined &&
      dto.timezone === undefined
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Debe proporcionar al menos un campo para actualizar.',
      });
    }

    if (dto.slug) {
      const slugTaken =
        await this.organizationsRepository.existsAnotherOrganizationWithSlug(
          dto.slug,
          tenant.organizationId,
        );

      if (slugTaken) {
        throw new ConflictException({
          code: 'DUPLICATE_RESOURCE',
          message: 'El identificador (slug) de la organización ya está en uso.',
          details: { field: 'slug' },
        });
      }
    }

    try {
      const updated = await this.organizationsRepository.updateOrganization(
        tenant.organizationId,
        {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
          ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        },
      );

      return OrganizationsMapper.toCurrentOrganizationDto(updated, tenant);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'DUPLICATE_RESOURCE',
          message: 'El identificador (slug) de la organización ya está en uso.',
          details: { field: 'slug' },
        });
      }
      throw error;
    }
  }
}
