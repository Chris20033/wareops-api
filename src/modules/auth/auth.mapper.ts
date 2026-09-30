import type {
  AccessibleMembershipPayload,
  UserWithAccessibleMembershipsPayload,
} from './auth.selectors.js';
import type {
  AccessibleOrganizationSummaryDto,
  AuthenticatedProfileDto,
  AuthSessionDto,
  AuthUserDto,
} from './dto/auth-response.dto.js';

export class AuthMapper {
  static toUserDto(user: UserWithAccessibleMembershipsPayload): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    };
  }

  static toAccessibleOrganizationDto(
    membership: AccessibleMembershipPayload,
  ): AccessibleOrganizationSummaryDto {
    const permissions = membership.role.rolePermissions
      .map((rp) => rp.permission.code)
      .sort();

    return {
      membershipId: membership.id,
      organizationId: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      timezone: membership.organization.timezone,
      role: {
        id: membership.role.id,
        code: membership.role.code,
        name: membership.role.name,
      },
      permissions,
    };
  }

  static toAuthSessionDto(params: {
    accessToken: string;
    expiresIn: number;
    user: UserWithAccessibleMembershipsPayload;
  }): AuthSessionDto {
    return {
      accessToken: params.accessToken,
      expiresIn: params.expiresIn,
      user: AuthMapper.toUserDto(params.user),
      organizations: params.user.memberships.map((m) =>
        AuthMapper.toAccessibleOrganizationDto(m),
      ),
    };
  }

  static toProfileDto(params: {
    sessionId: string;
    user: UserWithAccessibleMembershipsPayload;
  }): AuthenticatedProfileDto {
    return {
      sessionId: params.sessionId,
      user: AuthMapper.toUserDto(params.user),
      organizations: params.user.memberships.map((m) =>
        AuthMapper.toAccessibleOrganizationDto(m),
      ),
    };
  }
}
