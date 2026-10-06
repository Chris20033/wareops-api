import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mapProductSupplierItemToDto } from './catalog.mapper.js';
import { CatalogRepository } from './catalog.repository.js';
import type {
  AttachSupplierDto,
  ProductSupplierItemDto,
} from './dto/product-supplier.dto.js';

@Injectable()
export class ProductSuppliersService {
  constructor(private readonly catalogRepository: CatalogRepository) {}

  async attach(
    organizationId: string,
    productId: string,
    dto: AttachSupplierDto,
  ): Promise<ProductSupplierItemDto> {
    const product = await this.catalogRepository.findProductById(
      organizationId,
      productId,
    );
    if (!product) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Producto no encontrado.',
      });
    }

    const supplier = await this.catalogRepository.findSupplierById(
      organizationId,
      dto.supplierId,
    );
    if (!supplier) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Proveedor no encontrado.',
      });
    }

    const existing = await this.catalogRepository.findProductSupplier(
      productId,
      dto.supplierId,
    );
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        code: 'DUPLICATE_RESOURCE',
        message: 'El proveedor ya se encuentra asociado a este producto.',
      });
    }

    const payload = await this.catalogRepository.attachSupplierToProduct(
      productId,
      dto.supplierId,
    );

    return mapProductSupplierItemToDto(payload);
  }

  async list(
    organizationId: string,
    productId: string,
  ): Promise<ProductSupplierItemDto[]> {
    const product = await this.catalogRepository.findProductById(
      organizationId,
      productId,
    );
    if (!product) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Producto no encontrado.',
      });
    }

    const items = await this.catalogRepository.listSuppliersForProduct(
      organizationId,
      productId,
    );

    return items.map(mapProductSupplierItemToDto);
  }

  async detach(
    organizationId: string,
    productId: string,
    supplierId: string,
  ): Promise<void> {
    const product = await this.catalogRepository.findProductById(
      organizationId,
      productId,
    );
    if (!product) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Producto no encontrado.',
      });
    }

    const existing = await this.catalogRepository.findProductSupplier(
      productId,
      supplierId,
    );
    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
        message: 'Asociación producto-proveedor no encontrada.',
      });
    }

    await this.catalogRepository.detachSupplierFromProduct(
      productId,
      supplierId,
    );
  }
}
