import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createPaginatedResult,
  type PaginatedResult,
} from '../../common/http/pagination.dto.js';
import { mapBranchToDto } from './catalog.mapper.js';
import { CatalogRepository } from './catalog.repository.js';
import type {
  BranchQueryDto,
  BranchResponseDto,
  CreateBranchDto,
  UpdateBranchDto,
} from './dto/branch.dto.js';

@Injectable()
export class BranchesService {
  constructor(private readonly catalogRepository: CatalogRepository) {}

  async create(
    organizationId: string,
    dto: CreateBranchDto,
  ): Promise<BranchResponseDto> {
    const code = dto.code.trim().toUpperCase();

    const existing = await this.catalogRepository.findBranchByCode(
      organizationId,
      code,
    );
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        code: 'DUPLICATE_RESOURCE',
        message:
          'Ya existe una sucursal con el código especificado en esta organización.',
      });
    }

    const payload = await this.catalogRepository.createBranch({
      organizationId,
      code,
      name: dto.name.trim(),
      address: dto.address?.trim() || undefined,
    });

    return mapBranchToDto(payload);
  }

  async list(
    organizationId: string,
    query: BranchQueryDto,
  ): Promise<PaginatedResult<BranchResponseDto>> {
    const { items, totalItems } = await this.catalogRepository.listBranches(
      organizationId,
      query,
    );

    return createPaginatedResult(
      items.map(mapBranchToDto),
      totalItems,
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  async findById(
    organizationId: string,
    branchId: string,
  ): Promise<BranchResponseDto> {
    const payload = await this.catalogRepository.findBranchById(
      organizationId,
      branchId,
    );

    if (!payload) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Sucursal no encontrada.',
      });
    }

    return mapBranchToDto(payload);
  }

  async update(
    organizationId: string,
    branchId: string,
    dto: UpdateBranchDto,
  ): Promise<BranchResponseDto> {
    await this.findById(organizationId, branchId);

    const payload = await this.catalogRepository.updateBranch(
      organizationId,
      branchId,
      {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        address:
          dto.address !== undefined
            ? dto.address.trim() || undefined
            : undefined,
        isActive: dto.isActive,
      },
    );

    return mapBranchToDto(payload);
  }
}
