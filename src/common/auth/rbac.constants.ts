import type { PrismaClient } from '../../generated/prisma/client.js';

export const ROLE_CODES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  OPERATOR: 'OPERATOR',
  VIEWER: 'VIEWER',
} as const;

export type RoleCode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const PERMISSION_CODES = {
  ORGANIZATION_MANAGE: 'organization:manage',
  MEMBER_MANAGE: 'member:manage',
  CATALOG_READ: 'catalog:read',
  CATALOG_WRITE: 'catalog:write',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_WRITE: 'inventory:write',
  ORDER_WRITE: 'order:write',
  AUDIT_READ: 'audit:read',
  DASHBOARD_READ: 'dashboard:read',
} as const;

export type PermissionCode =
  (typeof PERMISSION_CODES)[keyof typeof PERMISSION_CODES];

export const PREDEFINED_ROLES: ReadonlyArray<{
  code: RoleCode;
  name: string;
  description: string;
}> = [
  {
    code: ROLE_CODES.OWNER,
    name: 'Propietario',
    description:
      'Control total, miembros, roles operativos y configuración de organización.',
  },
  {
    code: ROLE_CODES.ADMIN,
    name: 'Administrador',
    description:
      'Gestión operativa y de usuarios, excepto acciones exclusivas del propietario.',
  },
  {
    code: ROLE_CODES.MANAGER,
    name: 'Gerente',
    description:
      'Catálogos, inventario, órdenes, dashboard y auditoría de lectura.',
  },
  {
    code: ROLE_CODES.OPERATOR,
    name: 'Operador',
    description:
      'Consulta y ejecución de entradas, salidas, transferencias y órdenes según permiso.',
  },
  {
    code: ROLE_CODES.VIEWER,
    name: 'Lector',
    description: 'Acceso de sólo lectura a catálogos, inventario y dashboard.',
  },
];

export const PREDEFINED_PERMISSIONS: ReadonlyArray<{
  code: PermissionCode;
  description: string;
}> = [
  {
    code: PERMISSION_CODES.ORGANIZATION_MANAGE,
    description: 'Modificar la configuración de la organización activa.',
  },
  {
    code: PERMISSION_CODES.MEMBER_MANAGE,
    description:
      'Listar miembros, cambiar su rol o estado y gestionar invitaciones.',
  },
  {
    code: PERMISSION_CODES.CATALOG_READ,
    description: 'Consultar sucursales, almacenes, productos y proveedores.',
  },
  {
    code: PERMISSION_CODES.CATALOG_WRITE,
    description:
      'Crear, editar y desactivar ubicaciones, productos, proveedores y mínimos.',
  },
  {
    code: PERMISSION_CODES.INVENTORY_READ,
    description:
      'Consultar saldos de inventario, transferencias, movimientos y órdenes.',
  },
  {
    code: PERMISSION_CODES.INVENTORY_WRITE,
    description:
      'Registrar entradas, salidas, ajustes y transferencias de inventario.',
  },
  {
    code: PERMISSION_CODES.ORDER_WRITE,
    description:
      'Crear, editar, confirmar, cancelar y completar órdenes de salida.',
  },
  {
    code: PERMISSION_CODES.AUDIT_READ,
    description: 'Consultar eventos y cambios de auditoría de la organización.',
  },
  {
    code: PERMISSION_CODES.DASHBOARD_READ,
    description:
      'Consultar resumen, alertas de mínimo y actividad reciente del dashboard.',
  },
];

export const ROLE_PERMISSION_MATRIX: Record<
  RoleCode,
  ReadonlyArray<PermissionCode>
> = {
  [ROLE_CODES.OWNER]: [
    PERMISSION_CODES.ORGANIZATION_MANAGE,
    PERMISSION_CODES.MEMBER_MANAGE,
    PERMISSION_CODES.CATALOG_READ,
    PERMISSION_CODES.CATALOG_WRITE,
    PERMISSION_CODES.INVENTORY_READ,
    PERMISSION_CODES.INVENTORY_WRITE,
    PERMISSION_CODES.ORDER_WRITE,
    PERMISSION_CODES.AUDIT_READ,
    PERMISSION_CODES.DASHBOARD_READ,
  ],
  [ROLE_CODES.ADMIN]: [
    PERMISSION_CODES.MEMBER_MANAGE,
    PERMISSION_CODES.CATALOG_READ,
    PERMISSION_CODES.CATALOG_WRITE,
    PERMISSION_CODES.INVENTORY_READ,
    PERMISSION_CODES.INVENTORY_WRITE,
    PERMISSION_CODES.ORDER_WRITE,
    PERMISSION_CODES.AUDIT_READ,
    PERMISSION_CODES.DASHBOARD_READ,
  ],
  [ROLE_CODES.MANAGER]: [
    PERMISSION_CODES.CATALOG_READ,
    PERMISSION_CODES.CATALOG_WRITE,
    PERMISSION_CODES.INVENTORY_READ,
    PERMISSION_CODES.INVENTORY_WRITE,
    PERMISSION_CODES.ORDER_WRITE,
    PERMISSION_CODES.AUDIT_READ,
    PERMISSION_CODES.DASHBOARD_READ,
  ],
  [ROLE_CODES.OPERATOR]: [
    PERMISSION_CODES.CATALOG_READ,
    PERMISSION_CODES.INVENTORY_READ,
    PERMISSION_CODES.INVENTORY_WRITE,
    PERMISSION_CODES.ORDER_WRITE,
    PERMISSION_CODES.DASHBOARD_READ,
  ],
  [ROLE_CODES.VIEWER]: [
    PERMISSION_CODES.CATALOG_READ,
    PERMISSION_CODES.INVENTORY_READ,
    PERMISSION_CODES.DASHBOARD_READ,
  ],
};

export async function ensureRbacCatalog(prisma: PrismaClient): Promise<{
  rolesByCode: Map<RoleCode, { id: string; code: RoleCode; name: string }>;
  permissionsByCode: Map<PermissionCode, { id: string; code: PermissionCode }>;
}> {
  const rolesByCode = new Map<
    RoleCode,
    { id: string; code: RoleCode; name: string }
  >();
  const permissionsByCode = new Map<
    PermissionCode,
    { id: string; code: PermissionCode }
  >();

  for (const roleDef of PREDEFINED_ROLES) {
    const role = await prisma.role.upsert({
      where: { code: roleDef.code },
      update: {
        name: roleDef.name,
        description: roleDef.description,
      },
      create: {
        code: roleDef.code,
        name: roleDef.name,
        description: roleDef.description,
      },
      select: { id: true, code: true, name: true },
    });
    rolesByCode.set(roleDef.code, {
      id: role.id,
      code: roleDef.code,
      name: role.name,
    });
  }

  for (const permDef of PREDEFINED_PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { code: permDef.code },
      update: {
        description: permDef.description,
      },
      create: {
        code: permDef.code,
        description: permDef.description,
      },
      select: { id: true, code: true },
    });
    permissionsByCode.set(permDef.code, {
      id: permission.id,
      code: permDef.code,
    });
  }

  for (const [roleCode, permissionCodes] of Object.entries(
    ROLE_PERMISSION_MATRIX,
  ) as Array<[RoleCode, ReadonlyArray<PermissionCode>]>) {
    const role = rolesByCode.get(roleCode);
    if (!role) {
      continue;
    }

    for (const permissionCode of permissionCodes) {
      const permission = permissionsByCode.get(permissionCode);
      if (!permission) {
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  return { rolesByCode, permissionsByCode };
}
