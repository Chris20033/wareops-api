import { Injectable } from '@nestjs/common';
import {
  ensureRbacCatalog,
  ROLE_CODES,
  type RoleCode,
} from '../../common/auth/rbac.constants.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  InvitationStatus,
  MembershipStatus,
  Prisma,
} from '../../generated/prisma/client.js';
import {
  accessibleMembershipSelect,
  type AccessibleMembershipPayload,
} from '../auth/auth.selectors.js';
import {
  invitationPublicSelect,
  type InvitationPublicPayload,
  memberSelect,
  type MemberPayload,
  organizationDetailSelect,
  type OrganizationDetailPayload,
} from './organizations.selectors.js';

@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async listAccessibleMembershipsForUser(
    userId: string,
  ): Promise<AccessibleMembershipPayload[]> {
    return this.prismaService.client.membership.findMany({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: accessibleMembershipSelect,
    });
  }

  async findOrganizationById(
    organizationId: string,
  ): Promise<OrganizationDetailPayload | null> {
    return this.prismaService.client.organization.findUnique({
      where: { id: organizationId },
      select: organizationDetailSelect,
    });
  }

  async existsAnotherOrganizationWithSlug(
    slug: string,
    excludeOrganizationId: string,
  ): Promise<boolean> {
    const count = await this.prismaService.client.organization.count({
      where: {
        slug,
        id: { not: excludeOrganizationId },
      },
    });
    return count > 0;
  }

  async updateOrganization(
    organizationId: string,
    data: {
      name?: string;
      slug?: string;
      timezone?: string;
    },
  ): Promise<OrganizationDetailPayload> {
    return this.prismaService.client.organization.update({
      where: { id: organizationId },
      data,
      select: organizationDetailSelect,
    });
  }

  async ensureRoleByCode(
    code: RoleCode,
  ): Promise<{ id: string; code: string; name: string }> {
    const existing = await this.prismaService.client.role.findUnique({
      where: { code },
      select: { id: true, code: true, name: true },
    });

    if (existing) {
      return existing;
    }

    const { rolesByCode } = await ensureRbacCatalog(this.prismaService.client);
    const created = rolesByCode.get(code);

    if (!created) {
      throw new Error(`Role ${code} is not defined in RBAC catalog`);
    }

    return created;
  }

  async listMembers(params: {
    organizationId: string;
    status?: MembershipStatus;
    roleCode?: RoleCode;
    search?: string;
    skip: number;
    take: number;
  }): Promise<{ items: MemberPayload[]; totalItems: number }> {
    const where: Prisma.MembershipWhereInput = {
      organizationId: params.organizationId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.roleCode ? { role: { code: params.roleCode } } : {}),
      ...(params.search
        ? {
            user: {
              OR: [
                {
                  displayName: {
                    contains: params.search,
                    mode: 'insensitive',
                  },
                },
                {
                  email: {
                    contains: params.search,
                    mode: 'insensitive',
                  },
                },
              ],
            },
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      this.prismaService.client.membership.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: params.skip,
        take: params.take,
        select: memberSelect,
      }),
      this.prismaService.client.membership.count({ where }),
    ]);

    return { items, totalItems };
  }

  async findMemberInOrganization(
    organizationId: string,
    membershipId: string,
  ): Promise<MemberPayload | null> {
    return this.prismaService.client.membership.findFirst({
      where: {
        id: membershipId,
        organizationId,
      },
      select: memberSelect,
    });
  }

  async updateMemberSafely(params: {
    organizationId: string;
    membershipId: string;
    newRoleId?: string;
    newRoleCode?: RoleCode;
    newStatus?: MembershipStatus;
  }): Promise<{
    updated: MemberPayload | null;
    violatedLastOwner: boolean;
  }> {
    return this.prismaService.client.$transaction(
      async (tx) => {
        const target = await tx.membership.findFirst({
          where: {
            id: params.membershipId,
            organizationId: params.organizationId,
          },
          select: memberSelect,
        });

        if (!target) {
          return { updated: null, violatedLastOwner: false };
        }

        const effectiveRoleCode = params.newRoleCode ?? target.role.code;
        const effectiveStatus = params.newStatus ?? target.status;

        const isRemovingActiveOwner =
          target.role.code === ROLE_CODES.OWNER &&
          target.status === MembershipStatus.ACTIVE &&
          (effectiveRoleCode !== ROLE_CODES.OWNER ||
            effectiveStatus !== MembershipStatus.ACTIVE);

        if (isRemovingActiveOwner) {
          const activeOwnerCount = await tx.membership.count({
            where: {
              organizationId: params.organizationId,
              status: MembershipStatus.ACTIVE,
              role: {
                code: ROLE_CODES.OWNER,
              },
            },
          });

          if (activeOwnerCount <= 1) {
            return { updated: null, violatedLastOwner: true };
          }
        }

        const updated = await tx.membership.update({
          where: { id: target.id },
          data: {
            ...(params.newRoleId ? { roleId: params.newRoleId } : {}),
            ...(params.newStatus ? { status: params.newStatus } : {}),
          },
          select: memberSelect,
        });

        return { updated, violatedLastOwner: false };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async existsActiveMemberByEmailInOrganization(
    organizationId: string,
    email: string,
  ): Promise<boolean> {
    const count = await this.prismaService.client.membership.count({
      where: {
        organizationId,
        status: MembershipStatus.ACTIVE,
        user: {
          email,
        },
      },
    });
    return count > 0;
  }

  async createInvitation(params: {
    organizationId: string;
    invitedByUserId: string;
    roleId: string;
    email: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<InvitationPublicPayload> {
    return this.prismaService.client.invitation.create({
      data: {
        organizationId: params.organizationId,
        invitedByUserId: params.invitedByUserId,
        roleId: params.roleId,
        email: params.email,
        tokenHash: params.tokenHash,
        status: InvitationStatus.PENDING,
        expiresAt: params.expiresAt,
      },
      select: invitationPublicSelect,
    });
  }

  async expireOverduePendingInvitations(
    organizationId: string,
    now = new Date(),
  ): Promise<void> {
    await this.prismaService.client.invitation.updateMany({
      where: {
        organizationId,
        status: InvitationStatus.PENDING,
        expiresAt: { lte: now },
      },
      data: {
        status: InvitationStatus.EXPIRED,
      },
    });
  }

  async listInvitations(params: {
    organizationId: string;
    status?: InvitationStatus;
    search?: string;
    skip: number;
    take: number;
  }): Promise<{ items: InvitationPublicPayload[]; totalItems: number }> {
    await this.expireOverduePendingInvitations(params.organizationId);

    const where: Prisma.InvitationWhereInput = {
      organizationId: params.organizationId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            email: {
              contains: params.search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      this.prismaService.client.invitation.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: params.skip,
        take: params.take,
        select: invitationPublicSelect,
      }),
      this.prismaService.client.invitation.count({ where }),
    ]);

    return { items, totalItems };
  }

  async findInvitationInOrganization(
    organizationId: string,
    invitationId: string,
  ): Promise<InvitationPublicPayload | null> {
    return this.prismaService.client.invitation.findFirst({
      where: {
        id: invitationId,
        organizationId,
      },
      select: invitationPublicSelect,
    });
  }

  async markInvitationExpiredById(invitationId: string): Promise<void> {
    await this.prismaService.client.invitation.updateMany({
      where: {
        id: invitationId,
        status: InvitationStatus.PENDING,
      },
      data: {
        status: InvitationStatus.EXPIRED,
      },
    });
  }

  async revokePendingInvitation(
    invitationId: string,
    now = new Date(),
  ): Promise<InvitationPublicPayload | null> {
    const result = await this.prismaService.client.invitation.updateMany({
      where: {
        id: invitationId,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: now },
      },
      data: {
        status: InvitationStatus.REVOKED,
        revokedAt: now,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.prismaService.client.invitation.findUnique({
      where: { id: invitationId },
      select: invitationPublicSelect,
    });
  }

  async findInvitationByTokenHash(tokenHash: string): Promise<
    | (InvitationPublicPayload & {
        roleId: string;
      })
    | null
  > {
    return this.prismaService.client.invitation.findUnique({
      where: { tokenHash },
      select: {
        ...invitationPublicSelect,
        roleId: true,
      },
    });
  }

  async findUserByEmail(
    email: string,
  ): Promise<{ id: string; email: string; isActive: boolean } | null> {
    return this.prismaService.client.user.findUnique({
      where: { email },
      select: { id: true, email: true, isActive: true },
    });
  }

  async acceptInvitationTransaction(params: {
    invitationId: string;
    organizationId: string;
    roleId: string;
    email: string;
    existingUserId?: string;
    newUser?: {
      displayName: string;
      passwordHash: string;
    };
    now: Date;
  }): Promise<{
    invitation: InvitationPublicPayload;
    membership: MemberPayload;
  } | null> {
    return this.prismaService.client.$transaction(
      async (tx) => {
        const updatedInvitationCount = await tx.invitation.updateMany({
          where: {
            id: params.invitationId,
            status: InvitationStatus.PENDING,
            expiresAt: { gt: params.now },
          },
          data: {
            status: InvitationStatus.ACCEPTED,
            acceptedAt: params.now,
          },
        });

        if (updatedInvitationCount.count === 0) {
          return null;
        }

        let userId = params.existingUserId;

        if (!userId) {
          if (!params.newUser) {
            throw new Error(
              'Missing newUser data when accepting invitation without existingUserId',
            );
          }

          const createdUser = await tx.user.create({
            data: {
              email: params.email,
              displayName: params.newUser.displayName,
              passwordHash: params.newUser.passwordHash,
              isActive: true,
            },
            select: { id: true },
          });

          userId = createdUser.id;
        }

        const membership = await tx.membership.upsert({
          where: {
            userId_organizationId: {
              userId,
              organizationId: params.organizationId,
            },
          },
          create: {
            userId,
            organizationId: params.organizationId,
            roleId: params.roleId,
            status: MembershipStatus.ACTIVE,
          },
          update: {
            roleId: params.roleId,
            status: MembershipStatus.ACTIVE,
          },
          select: memberSelect,
        });

        const invitation = await tx.invitation.findUniqueOrThrow({
          where: { id: params.invitationId },
          select: invitationPublicSelect,
        });

        return { invitation, membership };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }
}
