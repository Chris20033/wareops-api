import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard.js';
import { PasswordHasherService } from '../../common/auth/password-hasher.service.js';
import { ROLE_CODES, type RoleCode } from '../../common/auth/rbac.constants.js';
import {
  generateOpaqueSecret,
  hashOpaqueToken,
} from '../../common/auth/token-crypto.util.js';
import {
  createPaginatedResult,
  type PaginatedResult,
} from '../../common/http/pagination.dto.js';
import type {
  AuthenticatedUserContext,
  RequestWithId,
  TenantMembershipContext,
} from '../../common/http/request-with-id.js';
import type { AppEnvironment } from '../../config/environment.validation.js';
import { InvitationStatus, Prisma } from '../../generated/prisma/client.js';
import type {
  AcceptedInvitationResultDto,
  AcceptInvitationDto,
  CreatedInvitationDto,
  CreateInvitationDto,
  InvitationDto,
  ListInvitationsQueryDto,
} from './dto/invitation.dto.js';
import { OrganizationsMapper } from './organizations.mapper.js';
import { OrganizationsRepository } from './organizations.repository.js';

const INVITATION_TTL_MS = 72 * 60 * 60 * 1_000;
const INVITABLE_ROLE_CODES = new Set<RoleCode>([
  ROLE_CODES.ADMIN,
  ROLE_CODES.MANAGER,
  ROLE_CODES.OPERATOR,
  ROLE_CODES.VIEWER,
]);

@Injectable()
export class InvitationsService {
  constructor(
    private readonly organizationsRepository: OrganizationsRepository,
    private readonly passwordHasher: PasswordHasherService,
    private readonly jwtAuthGuard: JwtAuthGuard,
    private readonly configService: ConfigService<AppEnvironment, true>,
  ) {}

  async createInvitation(
    currentUser: AuthenticatedUserContext,
    tenant: TenantMembershipContext,
    dto: CreateInvitationDto,
  ): Promise<CreatedInvitationDto> {
    const normalizedRole = dto.roleCode.trim().toUpperCase();

    if (normalizedRole === ROLE_CODES.OWNER) {
      throw new UnprocessableEntityException({
        code: 'BUSINESS_RULE_VIOLATION',
        message: 'No se permite emitir invitaciones para el rol OWNER.',
      });
    }

    if (!INVITABLE_ROLE_CODES.has(normalizedRole as RoleCode)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'El código de rol indicado no es válido para una invitación.',
        details: {
          fields: {
            roleCode: ['INVALID_ROLE'],
          },
        },
      });
    }

    const email = dto.email.trim().toLowerCase();
    const alreadyActiveMember =
      await this.organizationsRepository.existsActiveMemberByEmailInOrganization(
        tenant.organizationId,
        email,
      );

    if (alreadyActiveMember) {
      throw new ConflictException({
        code: 'DUPLICATE_RESOURCE',
        message:
          'El correo indicado ya tiene una membresía activa en esta organización.',
        details: { field: 'email' },
      });
    }

    const role = await this.organizationsRepository.ensureRoleByCode(
      normalizedRole as RoleCode,
    );
    const rawToken = generateOpaqueSecret();
    const tokenHash = hashOpaqueToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const created = await this.organizationsRepository.createInvitation({
      organizationId: tenant.organizationId,
      invitedByUserId: currentUser.userId,
      roleId: role.id,
      email,
      tokenHash,
      expiresAt,
    });

    const webOrigin = this.configService
      .get('WEB_ORIGIN', { infer: true })
      .replace(/\/+$/, '');
    const invitationUrl = `${webOrigin}/invitations/accept?token=${encodeURIComponent(rawToken)}`;

    return OrganizationsMapper.toCreatedInvitationDto(
      created,
      rawToken,
      invitationUrl,
    );
  }

  async listInvitations(
    tenant: TenantMembershipContext,
    query: ListInvitationsQueryDto,
  ): Promise<PaginatedResult<InvitationDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const { items, totalItems } =
      await this.organizationsRepository.listInvitations({
        organizationId: tenant.organizationId,
        status: query.status,
        search: query.search,
        skip,
        take: pageSize,
      });

    return createPaginatedResult(
      items.map((item) => OrganizationsMapper.toInvitationDto(item)),
      totalItems,
      page,
      pageSize,
    );
  }

  async revokeInvitation(
    tenant: TenantMembershipContext,
    invitationId: string,
  ): Promise<InvitationDto> {
    const existing =
      await this.organizationsRepository.findInvitationInOrganization(
        tenant.organizationId,
        invitationId,
      );

    if (!existing) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'El recurso solicitado no existe.',
      });
    }

    const now = new Date();

    if (
      existing.status === InvitationStatus.PENDING &&
      existing.expiresAt <= now
    ) {
      await this.organizationsRepository.markInvitationExpiredById(existing.id);
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: 'La invitación ya ha expirado y no puede revocarse.',
      });
    }

    if (existing.status !== InvitationStatus.PENDING) {
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: 'Sólo se pueden revocar invitaciones en estado PENDING.',
      });
    }

    const revoked = await this.organizationsRepository.revokePendingInvitation(
      existing.id,
      now,
    );

    if (!revoked) {
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: 'No fue posible revocar la invitación en su estado actual.',
      });
    }

    return OrganizationsMapper.toInvitationDto(revoked);
  }

  async acceptInvitation(
    request: RequestWithId,
    dto: AcceptInvitationDto,
  ): Promise<AcceptedInvitationResultDto> {
    const tokenHash = hashOpaqueToken(dto.token.trim());
    const invitation =
      await this.organizationsRepository.findInvitationByTokenHash(tokenHash);

    if (!invitation) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'El recurso solicitado no existe.',
      });
    }

    const now = new Date();

    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: 'La invitación ya fue aceptada previamente.',
      });
    }

    if (invitation.status === InvitationStatus.REVOKED) {
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: 'La invitación ha sido revocada.',
      });
    }

    if (
      invitation.status === InvitationStatus.EXPIRED ||
      invitation.expiresAt <= now
    ) {
      if (invitation.status === InvitationStatus.PENDING) {
        await this.organizationsRepository.markInvitationExpiredById(
          invitation.id,
        );
      }
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: 'La invitación ha expirado.',
      });
    }

    let existingUserId: string | undefined;
    let newUserPayload:
      { displayName: string; passwordHash: string } | undefined;

    if (request.header('authorization')) {
      const authenticatedUser =
        await this.jwtAuthGuard.authenticateRequest(request);

      if (
        authenticatedUser.email.toLowerCase() !== invitation.email.toLowerCase()
      ) {
        throw new ForbiddenException({
          code: 'PERMISSION_DENIED',
          message:
            'El correo de la sesión autenticada no coincide con el correo invitado.',
        });
      }

      existingUserId = authenticatedUser.userId;
    } else {
      const existingAccount =
        await this.organizationsRepository.findUserByEmail(invitation.email);

      if (existingAccount) {
        throw new UnauthorizedException({
          code: 'AUTHENTICATION_REQUIRED',
          message:
            'Ya existe una cuenta registrada para este correo; inicie sesión para aceptar la invitación.',
        });
      }

      const missingFields: Record<string, string[]> = {};
      if (!dto.displayName) {
        missingFields.displayName = ['REQUIRED'];
      }
      if (!dto.password) {
        missingFields.password = ['REQUIRED'];
      }

      if (Object.keys(missingFields).length > 0) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message:
            'Para crear una cuenta nueva al aceptar la invitación se requieren displayName y password.',
          details: { fields: missingFields },
        });
      }

      const passwordHash = await this.passwordHasher.hash(dto.password!);
      newUserPayload = {
        displayName: dto.displayName!.trim(),
        passwordHash,
      };
    }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const result =
          await this.organizationsRepository.acceptInvitationTransaction({
            invitationId: invitation.id,
            organizationId: invitation.organizationId,
            roleId: invitation.roleId,
            email: invitation.email,
            existingUserId,
            newUser: newUserPayload,
            now: new Date(),
          });

        if (!result) {
          throw new ConflictException({
            code: 'INVALID_STATE_TRANSITION',
            message:
              'La invitación ya no se encuentra disponible para aceptación.',
          });
        }

        return {
          invitation: OrganizationsMapper.toInvitationDto(result.invitation),
          membership: OrganizationsMapper.toMemberDto(result.membership),
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          if (attempt === 3) {
            throw new ConflictException({
              code: 'CONCURRENT_MODIFICATION',
              message:
                'Conflicto concurrente al aceptar la invitación; intente nuevamente.',
            });
          }
          continue;
        }
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException({
            code: 'DUPLICATE_RESOURCE',
            message: 'Ya existe una cuenta o membresía para este correo.',
          });
        }
        throw error;
      }
    }

    throw new ConflictException({
      code: 'CONCURRENT_MODIFICATION',
      message:
        'Conflicto concurrente al aceptar la invitación; intente nuevamente.',
    });
  }
}
