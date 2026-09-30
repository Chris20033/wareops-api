import 'dotenv/config';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import { ARGON2ID_OPTIONS } from '../src/common/auth/password-hasher.service.js';
import {
  ensureRbacCatalog,
  ROLE_CODES,
  type RoleCode,
} from '../src/common/auth/rbac.constants.js';
import {
  MembershipStatus,
  PrismaClient,
} from '../src/generated/prisma/client.js';

const DEMO_DEFAULT_PASSWORD =
  process.env.SEED_DEMO_PASSWORD ?? 'WareOpsDemo!2026';

export async function runSeed(prisma: PrismaClient): Promise<void> {
  const { rolesByCode } = await ensureRbacCatalog(prisma);
  const passwordHash = await argon2.hash(
    DEMO_DEFAULT_PASSWORD,
    ARGON2ID_OPTIONS,
  );

  const orgNorte = await prisma.organization.upsert({
    where: { slug: 'organizacion-norte' },
    update: {
      name: 'Organización Norte',
      timezone: 'America/Mexico_City',
    },
    create: {
      name: 'Organización Norte',
      slug: 'organizacion-norte',
      timezone: 'America/Mexico_City',
    },
    select: { id: true, slug: true },
  });

  const orgSur = await prisma.organization.upsert({
    where: { slug: 'organizacion-sur' },
    update: {
      name: 'Organización Sur',
      timezone: 'America/Monterrey',
    },
    create: {
      name: 'Organización Sur',
      slug: 'organizacion-sur',
      timezone: 'America/Monterrey',
    },
    select: { id: true, slug: true },
  });

  const seedUsers: ReadonlyArray<{
    email: string;
    displayName: string;
    memberships: ReadonlyArray<{
      organizationId: string;
      roleCode: RoleCode;
    }>;
  }> = [
    {
      email: 'owner@wareops.local',
      displayName: 'Propietario Norte',
      memberships: [
        { organizationId: orgNorte.id, roleCode: ROLE_CODES.OWNER },
        { organizationId: orgSur.id, roleCode: ROLE_CODES.VIEWER },
      ],
    },
    {
      email: 'admin@wareops.local',
      displayName: 'Administrador Norte',
      memberships: [
        { organizationId: orgNorte.id, roleCode: ROLE_CODES.ADMIN },
      ],
    },
    {
      email: 'manager@wareops.local',
      displayName: 'Gerente Norte',
      memberships: [
        { organizationId: orgNorte.id, roleCode: ROLE_CODES.MANAGER },
      ],
    },
    {
      email: 'operator@wareops.local',
      displayName: 'Operador Norte',
      memberships: [
        { organizationId: orgNorte.id, roleCode: ROLE_CODES.OPERATOR },
      ],
    },
    {
      email: 'viewer@wareops.local',
      displayName: 'Lector Norte',
      memberships: [
        { organizationId: orgNorte.id, roleCode: ROLE_CODES.VIEWER },
      ],
    },
    {
      email: 'owner.sur@wareops.local',
      displayName: 'Propietario Sur',
      memberships: [{ organizationId: orgSur.id, roleCode: ROLE_CODES.OWNER }],
    },
  ];

  for (const seedUser of seedUsers) {
    const user = await prisma.user.upsert({
      where: { email: seedUser.email },
      update: {
        displayName: seedUser.displayName,
        passwordHash,
        isActive: true,
      },
      create: {
        email: seedUser.email,
        displayName: seedUser.displayName,
        passwordHash,
        isActive: true,
      },
      select: { id: true },
    });

    for (const membershipDef of seedUser.memberships) {
      const role = rolesByCode.get(membershipDef.roleCode);
      if (!role) {
        throw new Error(`Missing role ${membershipDef.roleCode} during seed`);
      }

      await prisma.membership.upsert({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: membershipDef.organizationId,
          },
        },
        update: {
          roleId: role.id,
          status: MembershipStatus.ACTIVE,
        },
        create: {
          userId: user.id,
          organizationId: membershipDef.organizationId,
          roleId: role.id,
          status: MembershipStatus.ACTIVE,
        },
      });
    }
  }
}

async function main(): Promise<void> {
  const connectionString =
    process.env.DATABASE_URL ??
    'postgresql://wareops:wareops_local@localhost:5432/wareops';
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    await runSeed(prisma);
    console.info(
      'Seed completed: RBAC roles, permissions, and two demo organizations are ready.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  await main();
}
