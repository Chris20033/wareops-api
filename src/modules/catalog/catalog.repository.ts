import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  branchSelect,
  type BranchPayload,
  productDetailSelect,
  type ProductDetailPayload,
  productSelect,
  type ProductPayload,
  productSupplierItemSelect,
  type ProductSupplierItemPayload,
  supplierSelect,
  type SupplierPayload,
  warehouseSelect,
  type WarehousePayload,
} from './catalog.selectors.js';
import type { BranchQueryDto } from './dto/branch.dto.js';
import type { ProductQueryDto } from './dto/product.dto.js';
import type { SupplierQueryDto } from './dto/supplier.dto.js';
import type { WarehouseQueryDto } from './dto/warehouse.dto.js';

@Injectable()
export class CatalogRepository {
  constructor(private readonly prismaService: PrismaService) {}

  // ==========================================
  // SUCURSALES (BRANCHES)
  // ==========================================

  async createBranch(data: {
    organizationId: string;
    code: string;
    name: string;
    address?: string;
  }): Promise<BranchPayload> {
    return this.prismaService.client.branch.create({
      data: {
        organizationId: data.organizationId,
        code: data.code,
        name: data.name,
        address: data.address,
      },
      select: branchSelect,
    });
  }

  async findBranchById(
    organizationId: string,
    branchId: string,
  ): Promise<BranchPayload | null> {
    return this.prismaService.client.branch.findFirst({
      where: {
        id: branchId,
        organizationId,
      },
      select: branchSelect,
    });
  }

  async findBranchByCode(
    organizationId: string,
    code: string,
  ): Promise<BranchPayload | null> {
    return this.prismaService.client.branch.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code,
        },
      },
      select: branchSelect,
    });
  }

  async listBranches(
    organizationId: string,
    query: BranchQueryDto,
  ): Promise<{ items: BranchPayload[]; totalItems: number }> {
    const {
      page = 1,
      pageSize = 20,
      search,
      isActive,
      sort = 'name',
      order = 'asc',
    } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.BranchWhereInput = {
      organizationId,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.BranchOrderByWithRelationInput[] = [
      { [sort]: order },
      { id: 'asc' },
    ];

    const [items, totalItems] = await Promise.all([
      this.prismaService.client.branch.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: branchSelect,
      }),
      this.prismaService.client.branch.count({ where }),
    ]);

    return { items, totalItems };
  }

  async updateBranch(
    organizationId: string,
    branchId: string,
    data: {
      name?: string;
      address?: string;
      isActive?: boolean;
    },
  ): Promise<BranchPayload> {
    return this.prismaService.client.branch.update({
      where: {
        id: branchId,
        organizationId,
      },
      data,
      select: branchSelect,
    });
  }

  // ==========================================
  // ALMACENES (WAREHOUSES)
  // ==========================================

  async createWarehouse(data: {
    branchId: string;
    code: string;
    name: string;
    description?: string;
  }): Promise<WarehousePayload> {
    return this.prismaService.client.warehouse.create({
      data: {
        branchId: data.branchId,
        code: data.code,
        name: data.name,
        description: data.description,
      },
      select: warehouseSelect,
    });
  }

  async findWarehouseById(
    organizationId: string,
    warehouseId: string,
  ): Promise<WarehousePayload | null> {
    return this.prismaService.client.warehouse.findFirst({
      where: {
        id: warehouseId,
        branch: {
          organizationId,
        },
      },
      select: warehouseSelect,
    });
  }

  async findWarehouseByCode(
    branchId: string,
    code: string,
  ): Promise<WarehousePayload | null> {
    return this.prismaService.client.warehouse.findUnique({
      where: {
        branchId_code: {
          branchId,
          code,
        },
      },
      select: warehouseSelect,
    });
  }

  async listWarehouses(
    organizationId: string,
    query: WarehouseQueryDto,
  ): Promise<{ items: WarehousePayload[]; totalItems: number }> {
    const {
      page = 1,
      pageSize = 20,
      branchId,
      search,
      isActive,
      sort = 'name',
      order = 'asc',
    } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.WarehouseWhereInput = {
      branch: {
        organizationId,
        ...(branchId ? { id: branchId } : {}),
      },
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.WarehouseOrderByWithRelationInput[] = [
      { [sort]: order },
      { id: 'asc' },
    ];

    const [items, totalItems] = await Promise.all([
      this.prismaService.client.warehouse.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: warehouseSelect,
      }),
      this.prismaService.client.warehouse.count({ where }),
    ]);

    return { items, totalItems };
  }

  async updateWarehouse(
    warehouseId: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
    },
  ): Promise<WarehousePayload> {
    return this.prismaService.client.warehouse.update({
      where: {
        id: warehouseId,
      },
      data,
      select: warehouseSelect,
    });
  }

  // ==========================================
  // PRODUCTOS (PRODUCTS)
  // ==========================================

  async createProduct(data: {
    organizationId: string;
    sku: string;
    name: string;
    description?: string;
  }): Promise<ProductPayload> {
    return this.prismaService.client.product.create({
      data: {
        organizationId: data.organizationId,
        sku: data.sku,
        name: data.name,
        description: data.description,
      },
      select: productSelect,
    });
  }

  async findProductById(
    organizationId: string,
    productId: string,
  ): Promise<ProductDetailPayload | null> {
    return this.prismaService.client.product.findFirst({
      where: {
        id: productId,
        organizationId,
      },
      select: productDetailSelect,
    });
  }

  async findProductBySku(
    organizationId: string,
    sku: string,
  ): Promise<ProductPayload | null> {
    return this.prismaService.client.product.findUnique({
      where: {
        organizationId_sku: {
          organizationId,
          sku,
        },
      },
      select: productSelect,
    });
  }

  async listProducts(
    organizationId: string,
    query: ProductQueryDto,
  ): Promise<{ items: ProductPayload[]; totalItems: number }> {
    const {
      page = 1,
      pageSize = 20,
      search,
      isActive,
      sort = 'name',
      order = 'asc',
    } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ProductWhereInput = {
      organizationId,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
      { [sort]: order },
      { id: 'asc' },
    ];

    const [items, totalItems] = await Promise.all([
      this.prismaService.client.product.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: productSelect,
      }),
      this.prismaService.client.product.count({ where }),
    ]);

    return { items, totalItems };
  }

  async updateProduct(
    organizationId: string,
    productId: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
    },
  ): Promise<ProductDetailPayload> {
    return this.prismaService.client.product.update({
      where: {
        id: productId,
        organizationId,
      },
      data,
      select: productDetailSelect,
    });
  }

  // ==========================================
  // PROVEEDORES (SUPPLIERS)
  // ==========================================

  async createSupplier(data: {
    organizationId: string;
    code: string;
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
  }): Promise<SupplierPayload> {
    return this.prismaService.client.supplier.create({
      data: {
        organizationId: data.organizationId,
        code: data.code,
        name: data.name,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
      },
      select: supplierSelect,
    });
  }

  async findSupplierById(
    organizationId: string,
    supplierId: string,
  ): Promise<SupplierPayload | null> {
    return this.prismaService.client.supplier.findFirst({
      where: {
        id: supplierId,
        organizationId,
      },
      select: supplierSelect,
    });
  }

  async findSupplierByCode(
    organizationId: string,
    code: string,
  ): Promise<SupplierPayload | null> {
    return this.prismaService.client.supplier.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code,
        },
      },
      select: supplierSelect,
    });
  }

  async listSuppliers(
    organizationId: string,
    query: SupplierQueryDto,
  ): Promise<{ items: SupplierPayload[]; totalItems: number }> {
    const {
      page = 1,
      pageSize = 20,
      search,
      isActive,
      sort = 'name',
      order = 'asc',
    } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SupplierWhereInput = {
      organizationId,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { contactName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.SupplierOrderByWithRelationInput[] = [
      { [sort]: order },
      { id: 'asc' },
    ];

    const [items, totalItems] = await Promise.all([
      this.prismaService.client.supplier.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        select: supplierSelect,
      }),
      this.prismaService.client.supplier.count({ where }),
    ]);

    return { items, totalItems };
  }

  async updateSupplier(
    organizationId: string,
    supplierId: string,
    data: {
      name?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      isActive?: boolean;
    },
  ): Promise<SupplierPayload> {
    return this.prismaService.client.supplier.update({
      where: {
        id: supplierId,
        organizationId,
      },
      data,
      select: supplierSelect,
    });
  }

  // ==========================================
  // RELACIÓN PRODUCTO-PROVEEDOR
  // ==========================================

  async findProductSupplier(
    productId: string,
    supplierId: string,
  ): Promise<ProductSupplierItemPayload | null> {
    return this.prismaService.client.productSupplier.findUnique({
      where: {
        productId_supplierId: {
          productId,
          supplierId,
        },
      },
      select: productSupplierItemSelect,
    });
  }

  async attachSupplierToProduct(
    productId: string,
    supplierId: string,
  ): Promise<ProductSupplierItemPayload> {
    return this.prismaService.client.productSupplier.create({
      data: {
        productId,
        supplierId,
      },
      select: productSupplierItemSelect,
    });
  }

  async listSuppliersForProduct(
    organizationId: string,
    productId: string,
  ): Promise<ProductSupplierItemPayload[]> {
    return this.prismaService.client.productSupplier.findMany({
      where: {
        productId,
        product: {
          organizationId,
        },
      },
      orderBy: {
        supplier: {
          name: 'asc',
        },
      },
      select: productSupplierItemSelect,
    });
  }

  async detachSupplierFromProduct(
    productId: string,
    supplierId: string,
  ): Promise<void> {
    await this.prismaService.client.productSupplier.delete({
      where: {
        productId_supplierId: {
          productId,
          supplierId,
        },
      },
    });
  }
}
