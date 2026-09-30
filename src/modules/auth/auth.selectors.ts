import {
  MembershipStatus,
  type Prisma,
} from '../../generated/prisma/client.js';

export const accessibleMembershipSelect = {
  id: true,
  status: true,
  createdAt: true,
  organization: {
    select: {
      id: true,
      name: true,
      slug: true,
      timezone: true,
    },
  },
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
} satisfies Prisma.MembershipSelect;

export const userWithAccessibleMembershipsSelect = {
  id: true,
  email: true,
  displayName: true,
  isActive: true,
  createdAt: true,
  memberships: {
    where: {
      status: MembershipStatus.ACTIVE,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: accessibleMembershipSelect,
  },
} satisfies Prisma.UserSelect;

export const userWithCredentialsSelect = {
  ...userWithAccessibleMembershipsSelect,
  passwordHash: true,
} satisfies Prisma.UserSelect;

export type AccessibleMembershipPayload = Prisma.MembershipGetPayload<{
  select: typeof accessibleMembershipSelect;
}>;

export type UserWithAccessibleMembershipsPayload = Prisma.UserGetPayload<{
  select: typeof userWithAccessibleMembershipsSelect;
}>;

export type UserWithCredentialsPayload = Prisma.UserGetPayload<{
  select: typeof userWithCredentialsSelect;
}>;
