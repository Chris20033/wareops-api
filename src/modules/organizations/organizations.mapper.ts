import type { TenantMembershipContext } from '../../common/http/request-with-id.js';
import type {
  CreatedInvitationDto,
  InvitationDto,
} from './dto/invitation.dto.js';
import type { MemberDto } from './dto/member.dto.js';
import type { CurrentOrganizationDto } from './dto/organization.dto.js';
import type {
  InvitationPublicPayload,
  MemberPayload,
  OrganizationDetailPayload,
} from './organizations.selectors.js';

export class OrganizationsMapper {
  static toCurrentOrganizationDto(
    organization: OrganizationDetailPayload,
    tenant: TenantMembershipContext,
  ): CurrentOrganizationDto {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      timezone: organization.timezone,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
      membership: {
        id: tenant.membershipId,
        status: 'ACTIVE',
        role: {
          id: tenant.roleId,
          code: tenant.roleCode,
          name: tenant.roleName,
        },
        permissions: Array.from(tenant.permissions).sort(),
      },
    };
  }

  static toMemberDto(member: MemberPayload): MemberDto {
    return {
      id: member.id,
      organizationId: member.organizationId,
      status: member.status,
      user: {
        id: member.user.id,
        email: member.user.email,
        displayName: member.user.displayName,
        isActive: member.user.isActive,
      },
      role: {
        id: member.role.id,
        code: member.role.code,
        name: member.role.name,
      },
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    };
  }

  static toInvitationDto(invitation: InvitationPublicPayload): InvitationDto {
    return {
      id: invitation.id,
      organizationId: invitation.organizationId,
      email: invitation.email,
      status: invitation.status,
      role: {
        id: invitation.role.id,
        code: invitation.role.code,
        name: invitation.role.name,
      },
      invitedBy: {
        id: invitation.invitedByUser.id,
        email: invitation.invitedByUser.email,
        displayName: invitation.invitedByUser.displayName,
      },
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt
        ? invitation.acceptedAt.toISOString()
        : null,
      revokedAt: invitation.revokedAt
        ? invitation.revokedAt.toISOString()
        : null,
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  static toCreatedInvitationDto(
    invitation: InvitationPublicPayload,
    invitationToken: string,
    invitationUrl: string,
  ): CreatedInvitationDto {
    return {
      ...OrganizationsMapper.toInvitationDto(invitation),
      invitationToken,
      invitationUrl,
    };
  }
}
