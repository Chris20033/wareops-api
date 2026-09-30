import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ROLE_CODES } from '../../common/auth/rbac.constants.js';
import {
  createPaginatedResult,
  type PaginatedResult,
} from '../../common/http/pagination.dto.js';
import type { TenantMembershipContext } from '../../common/http/request-with-id.js';
import { Prisma } from '../../generated/prisma/client.js';
import type {
  ListMembersQueryDto,
  MemberDto,
  UpdateMemberDto,
} from './dto/member.dto.js';
import { OrganizationsMapper } from './organizations.mapper.js';
import { OrganizationsRepository } from './organizations.repository.js';

@Injectable()
export class MembersService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
  ) {}

  async listMembers(
    tenant: TenantMembershipContext,
    query: ListMembersQueryDto,
  ): Promise<PaginatedResult<MemberDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const { items, totalItems } =
      await this.organizationsRepository.listMembers({
        organizationId: tenant.organizationId,
        status: query.status,
        roleCode: query.roleCode,
        search: query.search,
        skip,
        take: pageSize,
      });

    return createPaginatedResult(
      items.map((item) => OrganizationsMapper.toMemberDto(item)),
      totalItems,
      page,
      pageSize,
    );
  }

  async updateMember(
    tenant: TenantMembershipContext,
    membershipId: string,
    dto: UpdateMemberDto,
  ): Promise<MemberDto> {
    if (dto.roleCode === undefined && dto.status === undefined) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message:
          'Debe proporcionar al menos roleCode o status para actualizar la membresía.',
      });
    }

    const existing =
      await this.organizationsRepository.findMemberInOrganization(
        tenant.organizationId,
        membershipId,
      );

    if (!existing) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'El recurso solicitado no existe.',
      });
    }

    if (
      tenant.roleCode !== ROLE_CODES.OWNER &&
      (existing.role.code === ROLE_CODES.OWNER ||
        dto.roleCode === ROLE_CODES.OWNER)
    ) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message:
          'Sólo un propietario (OWNER) puede asignar o modificar membresías de propietario.',
      });
    }

    let newRoleId: string | undefined;
    if (dto.roleCode !== undefined) {
      const targetRole = await this.organizationsRepository.ensureRoleByCode(
        dto.roleCode,
      );
      newRoleId = targetRole.id;
    }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result = await this.organizationsRepository.updateMemberSafely({
          organizationId: tenant.organizationId,
          membershipId,
          newRoleId,
          newRoleCode: dto.roleCode,
          newStatus: dto.status,
        });

        if (result.violatedLastOwner) {
          throw new UnprocessableEntityException({
            code: 'BUSINESS_RULE_VIOLATION',
            message:
              'La organización debe conservar al menos un propietario (OWNER) activo.',
          });
        }

        if (!result.updated) {
          throw new NotFoundException({
            code: 'RESOURCE_NOT_FOUND',
            message: 'El recurso solicitado no existe.',
          });
        }

        return OrganizationsMapper.toMemberDto(result.updated);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          if (attempt === 3) {
            throw new ConflictException({
              code: 'CONCURRENT_MODIFICATION',
              message:
                'Conflicto concurrente al actualizar la membresía; intente nuevamente.',
            });
          }
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException({
      code: 'CONCURRENT_MODIFICATION',
      message:
        'Conflicto concurrente al actualizar la membresía; intente nuevamente.',
    });
  }
}
