import type { Prisma } from '../../generated/prisma/client.js';

export const organizationDetailSelect = {
  id: true,
  name: true,
  slug: true,
  timezone: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrganizationSelect;

export const memberSelect = {
  id: true,
  organizationId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      displayName: true,
      isActive: true,
    },
  },
  role: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
} satisfies Prisma.MembershipSelect;

export const invitationPublicSelect = {
  id: true,
  organizationId: true,
  email: true,
  status: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  createdAt: true,
  role: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  invitedByUser: {
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  },
} satisfies Prisma.InvitationSelect;

export type OrganizationDetailPayload = Prisma.OrganizationGetPayload<{
  select: typeof organizationDetailSelect;
}>;

export type MemberPayload = Prisma.MembershipGetPayload<{
  select: typeof memberSelect;
}>;

export type InvitationPublicPayload = Prisma.InvitationGetPayload<{
  select: typeof invitationPublicSelect;
}>;
