import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  createPaginatedResult,
  type PaginatedResult,
} from '../../common/http/pagination.dto.js';
import { mapProductDetailToDto, mapProductToDto } from './catalog.mapper.js';
import { CatalogRepository } from './catalog.repository.js';
import type {
  CreateProductDto,
  ProductDetailResponseDto,
  ProductQueryDto,
  ProductResponseDto,
  UpdateProductDto,
} from './dto/product.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly catalogRepository: CatalogRepository) {}

  async create(
    organizationId: string,
    dto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    const sku = dto.sku.trim().toUpperCase();

    const existing = await this.catalogRepository.findProductBySku(
      organizationId,
      sku,
    );
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        code: 'DUPLICATE_RESOURCE',
        message:
          'Ya existe un producto con el SKU especificado en esta organización.',
      });
    }

    const payload = await this.catalogRepository.createProduct({
      organizationId,
      sku,
      name: dto.name.trim(),
      description: dto.description?.trim() || undefined,
    });

    return mapProductToDto(payload);
  }

  async list(
    organizationId: string,
    query: ProductQueryDto,
  ): Promise<PaginatedResult<ProductResponseDto>> {
    const { items, totalItems } = await this.catalogRepository.listProducts(
      organizationId,
      query,
    );

    return createPaginatedResult(
      items.map(mapProductToDto),
      totalItems,
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  async findById(
    organizationId: string,
    productId: string,
  ): Promise<ProductDetailResponseDto> {
    const payload = await this.catalogRepository.findProductById(
      organizationId,
      productId,
    );

    if (!payload) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Producto no encontrado.',
      });
    }

    return mapProductDetailToDto(payload);
  }

  async update(
    organizationId: string,
    productId: string,
    dto: UpdateProductDto,
  ): Promise<ProductDetailResponseDto> {
    await this.findById(organizationId, productId);

    const payload = await this.catalogRepository.updateProduct(
      organizationId,
      productId,
      {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        description:
          dto.description !== undefined
            ? dto.description.trim() || undefined
            : undefined,
        isActive: dto.isActive,
      },
    );

    return mapProductDetailToDto(payload);
  }
}
