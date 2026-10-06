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

  // --- Seed Ubicaciones y Catálogo (Sprint 02) ---
  const branchMty = await prisma.branch.upsert({
    where: {
      organizationId_code: {
        organizationId: orgNorte.id,
        code: 'SUC-MTY-01',
      },
    },
    update: {
      name: 'Sucursal Monterrey',
      address: 'Av. Constitución 1000, Monterrey, NL',
      isActive: true,
    },
    create: {
      organizationId: orgNorte.id,
      code: 'SUC-MTY-01',
      name: 'Sucursal Monterrey',
      address: 'Av. Constitución 1000, Monterrey, NL',
      isActive: true,
    },
    select: { id: true },
  });

  const branchCdmx = await prisma.branch.upsert({
    where: {
      organizationId_code: {
        organizationId: orgNorte.id,
        code: 'SUC-CDMX-01',
      },
    },
    update: {
      name: 'Sucursal CDMX',
      address: 'Paseo de la Reforma 500, Cuauhtémoc, CDMX',
      isActive: true,
    },
    create: {
      organizationId: orgNorte.id,
      code: 'SUC-CDMX-01',
      name: 'Sucursal CDMX',
      address: 'Paseo de la Reforma 500, Cuauhtémoc, CDMX',
      isActive: true,
    },
    select: { id: true },
  });

  const branchGdl = await prisma.branch.upsert({
    where: {
      organizationId_code: {
        organizationId: orgSur.id,
        code: 'SUC-GDL-01',
      },
    },
    update: {
      name: 'Sucursal Guadalajara',
      address: 'Av. Vallarta 2000, Guadalajara, JAL',
      isActive: true,
    },
    create: {
      organizationId: orgSur.id,
      code: 'SUC-GDL-01',
      name: 'Sucursal Guadalajara',
      address: 'Av. Vallarta 2000, Guadalajara, JAL',
      isActive: true,
    },
    select: { id: true },
  });

  await prisma.warehouse.upsert({
    where: {
      branchId_code: {
        branchId: branchMty.id,
        code: 'ALM-MTY-01',
      },
    },
    update: {
      name: 'Almacén Principal Monterrey',
      description: 'Almacén general de alta rotación',
      isActive: true,
    },
    create: {
      branchId: branchMty.id,
      code: 'ALM-MTY-01',
      name: 'Almacén Principal Monterrey',
      description: 'Almacén general de alta rotación',
      isActive: true,
    },
  });

  await prisma.warehouse.upsert({
    where: {
      branchId_code: {
        branchId: branchMty.id,
        code: 'ALM-MTY-02',
      },
    },
    update: {
      name: 'Almacén Refrigerado Monterrey',
      description: 'Cámara fría para productos perecederos',
      isActive: true,
    },
    create: {
      branchId: branchMty.id,
      code: 'ALM-MTY-02',
      name: 'Almacén Refrigerado Monterrey',
      description: 'Cámara fría para productos perecederos',
      isActive: true,
    },
  });

  await prisma.warehouse.upsert({
    where: {
      branchId_code: {
        branchId: branchCdmx.id,
        code: 'ALM-CDMX-01',
      },
    },
    update: {
      name: 'Almacén Central CDMX',
      description: 'Centro de distribución metropolitano',
      isActive: true,
    },
    create: {
      branchId: branchCdmx.id,
      code: 'ALM-CDMX-01',
      name: 'Almacén Central CDMX',
      description: 'Centro de distribución metropolitano',
      isActive: true,
    },
  });

  await prisma.warehouse.upsert({
    where: {
      branchId_code: {
        branchId: branchGdl.id,
        code: 'ALM-GDL-01',
      },
    },
    update: {
      name: 'Almacén Occidente',
      description: 'Almacén principal occidente',
      isActive: true,
    },
    create: {
      branchId: branchGdl.id,
      code: 'ALM-GDL-01',
      name: 'Almacén Occidente',
      description: 'Almacén principal occidente',
      isActive: true,
    },
  });

  const prodA01 = await prisma.product.upsert({
    where: {
      organizationId_sku: {
        organizationId: orgNorte.id,
        sku: 'PROD-A01',
      },
    },
    update: {
      name: 'Caja de Cartón Reforzada 40x40',
      description: 'Empaque industrial corrugado calibre estándar',
      isActive: true,
    },
    create: {
      organizationId: orgNorte.id,
      sku: 'PROD-A01',
      name: 'Caja de Cartón Reforzada 40x40',
      description: 'Empaque industrial corrugado calibre estándar',
      isActive: true,
    },
    select: { id: true },
  });

  const prodB02 = await prisma.product.upsert({
    where: {
      organizationId_sku: {
        organizationId: orgNorte.id,
        sku: 'PROD-B02',
      },
    },
    update: {
      name: 'Cinta de Embalaje Transparente 50m',
      description: 'Cinta adhesiva acrílica para empaque',
      isActive: true,
    },
    create: {
      organizationId: orgNorte.id,
      sku: 'PROD-B02',
      name: 'Cinta de Embalaje Transparente 50m',
      description: 'Cinta adhesiva acrílica para empaque',
      isActive: true,
    },
    select: { id: true },
  });

  const prodC03 = await prisma.product.upsert({
    where: {
      organizationId_sku: {
        organizationId: orgNorte.id,
        sku: 'PROD-C03',
      },
    },
    update: {
      name: 'Rollo Poliburbuja 100m',
      description: 'Material amortiguante para embalaje',
      isActive: true,
    },
    create: {
      organizationId: orgNorte.id,
      sku: 'PROD-C03',
      name: 'Rollo Poliburbuja 100m',
      description: 'Material amortiguante para embalaje',
      isActive: true,
    },
    select: { id: true },
  });

  await prisma.product.upsert({
    where: {
      organizationId_sku: {
        organizationId: orgSur.id,
        sku: 'PROD-S01',
      },
    },
    update: {
      name: 'Tarima de Madera Estándar',
      description: 'Pallet de pino 120x100 para carga pesada',
      isActive: true,
    },
    create: {
      organizationId: orgSur.id,
      sku: 'PROD-S01',
      name: 'Tarima de Madera Estándar',
      description: 'Pallet de pino 120x100 para carga pesada',
      isActive: true,
    },
  });

  const provAcme = await prisma.supplier.upsert({
    where: {
      organizationId_code: {
        organizationId: orgNorte.id,
        code: 'PROV-ACME-01',
      },
    },
    update: {
      name: 'Empaques y Cajas Acme S.A.',
      contactName: 'Juan Pérez',
      email: 'contacto@acmeempaques.com',
      phone: '+528180001122',
      isActive: true,
    },
    create: {
      organizationId: orgNorte.id,
      code: 'PROV-ACME-01',
      name: 'Empaques y Cajas Acme S.A.',
      contactName: 'Juan Pérez',
      email: 'contacto@acmeempaques.com',
      phone: '+528180001122',
      isActive: true,
    },
    select: { id: true },
  });

  const provLogix = await prisma.supplier.upsert({
    where: {
      organizationId_code: {
        organizationId: orgNorte.id,
        code: 'PROV-LOGIX-02',
      },
    },
    update: {
      name: 'Suministros Industriales Logix',
      contactName: 'María González',
      email: 'ventas@logixsuministros.com',
      phone: '+525550003344',
      isActive: true,
    },
    create: {
      organizationId: orgNorte.id,
      code: 'PROV-LOGIX-02',
      name: 'Suministros Industriales Logix',
      contactName: 'María González',
      email: 'ventas@logixsuministros.com',
      phone: '+525550003344',
      isActive: true,
    },
    select: { id: true },
  });

  await prisma.supplier.upsert({
    where: {
      organizationId_code: {
        organizationId: orgSur.id,
        code: 'PROV-SUR-01',
      },
    },
    update: {
      name: 'Maderas del Sur S.A.',
      contactName: 'Carlos Ramos',
      email: 'carlos@maderasdelsur.com',
      phone: '+523330005566',
      isActive: true,
    },
    create: {
      organizationId: orgSur.id,
      code: 'PROV-SUR-01',
      name: 'Maderas del Sur S.A.',
      contactName: 'Carlos Ramos',
      email: 'carlos@maderasdelsur.com',
      phone: '+523330005566',
      isActive: true,
    },
  });

  const productSupplierLinks = [
    { productId: prodA01.id, supplierId: provAcme.id },
    { productId: prodB02.id, supplierId: provLogix.id },
    { productId: prodC03.id, supplierId: provAcme.id },
  ];

  for (const link of productSupplierLinks) {
    const existing = await prisma.productSupplier.findUnique({
      where: {
        productId_supplierId: {
          productId: link.productId,
          supplierId: link.supplierId,
        },
      },
      select: { productId: true },
    });

    if (!existing) {
      await prisma.productSupplier.create({
        data: link,
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
