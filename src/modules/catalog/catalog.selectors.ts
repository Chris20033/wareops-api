import type { Prisma } from '../../generated/prisma/client.js';

export const branchSelect = {
  id: true,
  organizationId: true,
  code: true,
  name: true,
  address: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      warehouses: true,
    },
  },
} satisfies Prisma.BranchSelect;

export type BranchPayload = Prisma.BranchGetPayload<{
  select: typeof branchSelect;
}>;

export const warehouseSelect = {
  id: true,
  branchId: true,
  code: true,
  name: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  branch: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
} satisfies Prisma.WarehouseSelect;

export type WarehousePayload = Prisma.WarehouseGetPayload<{
  select: typeof warehouseSelect;
}>;

export const productSelect = {
  id: true,
  organizationId: true,
  sku: true,
  name: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      productSuppliers: true,
    },
  },
} satisfies Prisma.ProductSelect;

export type ProductPayload = Prisma.ProductGetPayload<{
  select: typeof productSelect;
}>;

export const productDetailSelect = {
  id: true,
  organizationId: true,
  sku: true,
  name: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      productSuppliers: true,
    },
  },
  productSuppliers: {
    select: {
      createdAt: true,
      supplier: {
        select: {
          id: true,
          code: true,
          name: true,
          contactName: true,
          email: true,
          phone: true,
          isActive: true,
        },
      },
    },
    orderBy: {
      supplier: {
        name: 'asc',
      },
    },
  },
} satisfies Prisma.ProductSelect;

export type ProductDetailPayload = Prisma.ProductGetPayload<{
  select: typeof productDetailSelect;
}>;

export const supplierSelect = {
  id: true,
  organizationId: true,
  code: true,
  name: true,
  contactName: true,
  email: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      productSuppliers: true,
    },
  },
} satisfies Prisma.SupplierSelect;

export type SupplierPayload = Prisma.SupplierGetPayload<{
  select: typeof supplierSelect;
}>;

export const productSupplierItemSelect = {
  createdAt: true,
  supplier: {
    select: {
      id: true,
      code: true,
      name: true,
      contactName: true,
      email: true,
      phone: true,
      isActive: true,
    },
  },
} satisfies Prisma.ProductSupplierSelect;

export type ProductSupplierItemPayload = Prisma.ProductSupplierGetPayload<{
  select: typeof productSupplierItemSelect;
}>;
