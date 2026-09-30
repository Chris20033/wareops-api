import type { Request } from 'express';

export type AuthenticatedUserContext = {
  userId: string;
  email: string;
  displayName: string;
  sessionId: string;
};

export type TenantMembershipContext = {
  organizationId: string;
  membershipId: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  permissions: ReadonlySet<string>;
};

export type RequestWithId = Request & {
  requestId: string;
  authContext?: AuthenticatedUserContext;
  tenantContext?: TenantMembershipContext;
};
