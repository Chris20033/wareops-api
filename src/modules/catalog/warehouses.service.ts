import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createPaginatedResult,
  type PaginatedResult,
} from '../../common/http/pagination.dto.js';
import { mapWarehouseToDto } from './catalog.mapper.js';
import { CatalogRepository } from './catalog.repository.js';
import type {
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseQueryDto,
  WarehouseResponseDto,
} from './dto/warehouse.dto.js';

@Injectable()
export class WarehousesService {
  constructor(private readonly catalogRepository: CatalogRepository) {}

  async create(
    organizationId: string,
    dto: CreateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    const branch = await this.catalogRepository.findBranchById(
      organizationId,
      dto.branchId,
    );

    if (!branch) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'La sucursal especificada no existe en esta organización.',
      });
    }

    const code = dto.code.trim().toUpperCase();

    const existing = await this.catalogRepository.findWarehouseByCode(
      dto.branchId,
      code,
    );
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        code: 'DUPLICATE_RESOURCE',
        message:
          'Ya existe un almacén con el código especificado en esta sucursal.',
      });
    }

    const payload = await this.catalogRepository.createWarehouse({
      branchId: dto.branchId,
      code,
      name: dto.name.trim(),
      description: dto.description?.trim() || undefined,
    });

    return mapWarehouseToDto(payload);
  }

  async list(
    organizationId: string,
    query: WarehouseQueryDto,
  ): Promise<PaginatedResult<WarehouseResponseDto>> {
    const { items, totalItems } = await this.catalogRepository.listWarehouses(
      organizationId,
      query,
    );

    return createPaginatedResult(
      items.map(mapWarehouseToDto),
      totalItems,
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  async findById(
    organizationId: string,
    warehouseId: string,
  ): Promise<WarehouseResponseDto> {
    const payload = await this.catalogRepository.findWarehouseById(
      organizationId,
      warehouseId,
    );

    if (!payload) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Almacén no encontrado.',
      });
    }

    return mapWarehouseToDto(payload);
  }

  async update(
    organizationId: string,
    warehouseId: string,
    dto: UpdateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    await this.findById(organizationId, warehouseId);

    const payload = await this.catalogRepository.updateWarehouse(warehouseId, {
      name: dto.name !== undefined ? dto.name.trim() : undefined,
      description:
        dto.description !== undefined
          ? dto.description.trim() || undefined
          : undefined,
      isActive: dto.isActive,
    });

    return mapWarehouseToDto(payload);
  }
}
