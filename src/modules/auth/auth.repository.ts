import { Injectable } from '@nestjs/common';
import {
  ensureRbacCatalog,
  ROLE_CODES,
} from '../../common/auth/rbac.constants.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  MembershipStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import {
  userWithAccessibleMembershipsSelect,
  type UserWithAccessibleMembershipsPayload,
  userWithCredentialsSelect,
  type UserWithCredentialsPayload,
} from './auth.selectors.js';

export type RefreshSessionLookupPayload = Prisma.RefreshSessionGetPayload<{
  select: {
    id: true;
    userId: true;
    tokenHash: true;
    expiresAt: true;
    lastUsedAt: true;
    revokedAt: true;
    user: {
      select: typeof userWithAccessibleMembershipsSelect;
    };
  };
}>;

@Injectable()
export class AuthRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findUserByEmailWithCredentials(
    email: string,
  ): Promise<UserWithCredentialsPayload | null> {
    return this.prismaService.client.user.findUnique({
      where: { email },
      select: userWithCredentialsSelect,
    });
  }

  async findUserByIdWithMemberships(
    userId: string,
  ): Promise<UserWithAccessibleMembershipsPayload | null> {
    return this.prismaService.client.user.findUnique({
      where: { id: userId },
      select: userWithAccessibleMembershipsSelect,
    });
  }

  async existsUserByEmail(email: string): Promise<boolean> {
    const count = await this.prismaService.client.user.count({
      where: { email },
    });
    return count > 0;
  }

  async existsOrganizationBySlug(slug: string): Promise<boolean> {
    const count = await this.prismaService.client.organization.count({
      where: { slug },
    });
    return count > 0;
  }

  async ensureOwnerRoleId(): Promise<string> {
    const existing = await this.prismaService.client.role.findUnique({
      where: { code: ROLE_CODES.OWNER },
      select: { id: true },
    });

    if (existing) {
      return existing.id;
    }

    const { rolesByCode } = await ensureRbacCatalog(this.prismaService.client);
    const ownerRole = rolesByCode.get(ROLE_CODES.OWNER);

    if (!ownerRole) {
      throw new Error('Failed to ensure OWNER role in RBAC catalog');
    }

    return ownerRole.id;
  }

  async registerUserWithOrganizationAndSession(params: {
    email: string;
    passwordHash: string;
    displayName: string;
    organizationName: string;
    organizationSlug: string;
    timezone: string;
    ownerRoleId: string;
    sessionId: string;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<UserWithAccessibleMembershipsPayload> {
    return this.prismaService.client.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: params.email,
          passwordHash: params.passwordHash,
          displayName: params.displayName,
          isActive: true,
        },
        select: { id: true },
      });

      const createdOrganization = await tx.organization.create({
        data: {
          name: params.organizationName,
          slug: params.organizationSlug,
          timezone: params.timezone,
        },
        select: { id: true },
      });

      await tx.membership.create({
        data: {
          userId: createdUser.id,
          organizationId: createdOrganization.id,
          roleId: params.ownerRoleId,
          status: MembershipStatus.ACTIVE,
        },
        select: { id: true },
      });

      await tx.refreshSession.create({
        data: {
          id: params.sessionId,
          userId: createdUser.id,
          tokenHash: params.tokenHash,
          expiresAt: params.expiresAt,
          lastUsedAt: params.now,
          userAgent: params.userAgent ?? null,
          ipAddress: params.ipAddress ?? null,
        },
        select: { id: true },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: createdUser.id },
        select: userWithAccessibleMembershipsSelect,
      });
    });
  }

  async createRefreshSession(params: {
    sessionId: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<void> {
    await this.prismaService.client.refreshSession.create({
      data: {
        id: params.sessionId,
        userId: params.userId,
        tokenHash: params.tokenHash,
        expiresAt: params.expiresAt,
        lastUsedAt: params.now,
        userAgent: params.userAgent ?? null,
        ipAddress: params.ipAddress ?? null,
      },
      select: { id: true },
    });
  }

  async findRefreshSessionById(
    sessionId: string,
  ): Promise<RefreshSessionLookupPayload | null> {
    return this.prismaService.client.refreshSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        tokenHash: true,
        expiresAt: true,
        lastUsedAt: true,
        revokedAt: true,
        user: {
          select: userWithAccessibleMembershipsSelect,
        },
      },
    });
  }

  async findRefreshSessionByTokenHash(
    tokenHash: string,
  ): Promise<RefreshSessionLookupPayload | null> {
    return this.prismaService.client.refreshSession.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        tokenHash: true,
        expiresAt: true,
        lastUsedAt: true,
        revokedAt: true,
        user: {
          select: userWithAccessibleMembershipsSelect,
        },
      },
    });
  }

  async rotateRefreshSessionToken(params: {
    sessionId: string;
    expectedTokenHash: string;
    newTokenHash: string;
    newExpiresAt: Date;
    now: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<boolean> {
    const result = await this.prismaService.client.refreshSession.updateMany({
      where: {
        id: params.sessionId,
        tokenHash: params.expectedTokenHash,
        revokedAt: null,
      },
      data: {
        tokenHash: params.newTokenHash,
        lastUsedAt: params.now,
        expiresAt: params.newExpiresAt,
        ...(params.userAgent ? { userAgent: params.userAgent } : {}),
        ...(params.ipAddress ? { ipAddress: params.ipAddress } : {}),
      },
    });

    return result.count === 1;
  }

  async revokeRefreshSessionById(
    sessionId: string,
    revokedAt = new Date(),
  ): Promise<void> {
    await this.prismaService.client.refreshSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt,
      },
    });
  }
}
