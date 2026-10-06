import type {
  BranchPayload,
  ProductDetailPayload,
  ProductPayload,
  ProductSupplierItemPayload,
  SupplierPayload,
  WarehousePayload,
} from './catalog.selectors.js';
import type { BranchResponseDto } from './dto/branch.dto.js';
import type {
  ProductDetailResponseDto,
  ProductResponseDto,
} from './dto/product.dto.js';
import type { ProductSupplierItemDto } from './dto/product-supplier.dto.js';
import type { SupplierResponseDto } from './dto/supplier.dto.js';
import type { WarehouseResponseDto } from './dto/warehouse.dto.js';

export function mapBranchToDto(payload: BranchPayload): BranchResponseDto {
  return {
    id: payload.id,
    organizationId: payload.organizationId,
    code: payload.code,
    name: payload.name,
    address: payload.address,
    isActive: payload.isActive,
    warehousesCount: payload._count.warehouses,
    createdAt: payload.createdAt.toISOString(),
    updatedAt: payload.updatedAt.toISOString(),
  };
}

export function mapWarehouseToDto(
  payload: WarehousePayload,
): WarehouseResponseDto {
  return {
    id: payload.id,
    branchId: payload.branchId,
    code: payload.code,
    name: payload.name,
    description: payload.description,
    isActive: payload.isActive,
    branch: {
      id: payload.branch.id,
      code: payload.branch.code,
      name: payload.branch.name,
    },
    createdAt: payload.createdAt.toISOString(),
    updatedAt: payload.updatedAt.toISOString(),
  };
}

export function mapProductToDto(payload: ProductPayload): ProductResponseDto {
  return {
    id: payload.id,
    organizationId: payload.organizationId,
    sku: payload.sku,
    name: payload.name,
    description: payload.description,
    isActive: payload.isActive,
    suppliersCount: payload._count.productSuppliers,
    createdAt: payload.createdAt.toISOString(),
    updatedAt: payload.updatedAt.toISOString(),
  };
}

export function mapProductDetailToDto(
  payload: ProductDetailPayload,
): ProductDetailResponseDto {
  return {
    ...mapProductToDto(payload),
    suppliers: payload.productSuppliers.map((ps) => ({
      id: ps.supplier.id,
      code: ps.supplier.code,
      name: ps.supplier.name,
      contactName: ps.supplier.contactName,
      email: ps.supplier.email,
      phone: ps.supplier.phone,
      isActive: ps.supplier.isActive,
      linkedAt: ps.createdAt.toISOString(),
    })),
  };
}

export function mapSupplierToDto(
  payload: SupplierPayload,
): SupplierResponseDto {
  return {
    id: payload.id,
    organizationId: payload.organizationId,
    code: payload.code,
    name: payload.name,
    contactName: payload.contactName,
    email: payload.email,
    phone: payload.phone,
    isActive: payload.isActive,
    productsCount: payload._count.productSuppliers,
    createdAt: payload.createdAt.toISOString(),
    updatedAt: payload.updatedAt.toISOString(),
  };
}

export function mapProductSupplierItemToDto(
  payload: ProductSupplierItemPayload,
): ProductSupplierItemDto {
  return {
    supplierId: payload.supplier.id,
    code: payload.supplier.code,
    name: payload.supplier.name,
    contactName: payload.supplier.contactName,
    email: payload.supplier.email,
    phone: payload.supplier.phone,
    isActive: payload.supplier.isActive,
    linkedAt: payload.createdAt.toISOString(),
  };
}
