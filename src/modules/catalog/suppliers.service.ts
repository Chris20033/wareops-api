import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createPaginatedResult,
  type PaginatedResult,
} from '../../common/http/pagination.dto.js';
import { mapSupplierToDto } from './catalog.mapper.js';
import { CatalogRepository } from './catalog.repository.js';
import type {
  CreateSupplierDto,
  SupplierQueryDto,
  SupplierResponseDto,
  UpdateSupplierDto,
} from './dto/supplier.dto.js';

@Injectable()
export class SuppliersService {
  constructor(private readonly catalogRepository: CatalogRepository) {}

  async create(
    organizationId: string,
    dto: CreateSupplierDto,
  ): Promise<SupplierResponseDto> {
    const code = dto.code.trim().toUpperCase();

    const existing = await this.catalogRepository.findSupplierByCode(
      organizationId,
      code,
    );
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        code: 'DUPLICATE_RESOURCE',
        message:
          'Ya existe un proveedor con el código especificado en esta organización.',
      });
    }

    const payload = await this.catalogRepository.createSupplier({
      organizationId,
      code,
      name: dto.name.trim(),
      contactName: dto.contactName?.trim() || undefined,
      email: dto.email?.trim().toLowerCase() || undefined,
      phone: dto.phone?.trim() || undefined,
    });

    return mapSupplierToDto(payload);
  }

  async list(
    organizationId: string,
    query: SupplierQueryDto,
  ): Promise<PaginatedResult<SupplierResponseDto>> {
    const { items, totalItems } = await this.catalogRepository.listSuppliers(
      organizationId,
      query,
    );

    return createPaginatedResult(
      items.map(mapSupplierToDto),
      totalItems,
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  async findById(
    organizationId: string,
    supplierId: string,
  ): Promise<SupplierResponseDto> {
    const payload = await this.catalogRepository.findSupplierById(
      organizationId,
      supplierId,
    );

    if (!payload) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Proveedor no encontrado.',
      });
    }

    return mapSupplierToDto(payload);
  }

  async update(
    organizationId: string,
    supplierId: string,
    dto: UpdateSupplierDto,
  ): Promise<SupplierResponseDto> {
    await this.findById(organizationId, supplierId);

    const payload = await this.catalogRepository.updateSupplier(
      organizationId,
      supplierId,
      {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        contactName:
          dto.contactName !== undefined
            ? dto.contactName.trim() || undefined
            : undefined,
        email:
          dto.email !== undefined
            ? dto.email.trim().toLowerCase() || undefined
            : undefined,
        phone:
          dto.phone !== undefined ? dto.phone.trim() || undefined : undefined,
        isActive: dto.isActive,
      },
    );

    return mapSupplierToDto(payload);
  }
}
