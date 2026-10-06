import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentTenant } from '../../common/auth/decorators/current-tenant.decorator.js';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator.js';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard.js';
import { OrganizationContextGuard } from '../../common/auth/guards/organization-context.guard.js';
import { PermissionsGuard } from '../../common/auth/guards/permissions.guard.js';
import { PERMISSION_CODES } from '../../common/auth/rbac.constants.js';
import { ApiErrorResponseDto } from '../../common/errors/api-error-response.dto.js';
import type { PaginatedResult } from '../../common/http/pagination.dto.js';
import { ParseUuidParamPipe } from '../../common/http/parse-uuid-param.pipe.js';
import type { TenantMembershipContext } from '../../common/http/request-with-id.js';
import {
  AttachSupplierDto,
  ProductSupplierItemDto,
  ProductSupplierListEnvelopeDto,
} from './dto/product-supplier.dto.js';
import {
  CreateProductDto,
  ProductDetailEnvelopeDto,
  ProductDetailResponseDto,
  ProductEnvelopeDto,
  ProductListEnvelopeDto,
  ProductQueryDto,
  ProductResponseDto,
  UpdateProductDto,
} from './dto/product.dto.js';
import { ProductSuppliersService } from './product-suppliers.service.js';
import { ProductsService } from './products.service.js';

@ApiTags('Catalog - Products')
@ApiBearerAuth('bearer')
@ApiSecurity('organizationId')
@ApiSecurity('requestId')
@UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionsGuard)
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productSuppliersService: ProductSuppliersService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @ApiOperation({
    summary: 'Crea un nuevo producto en la organización activa.',
  })
  @ApiCreatedResponse({ type: ProductEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async create(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Body() dto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.create(tenant.organizationId, dto);
  }

  @Get()
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  @ApiOperation({
    summary:
      'Lista productos paginados con soporte de búsqueda textual, filtros y ordenamiento.',
  })
  @ApiOkResponse({ type: ProductListEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async list(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Query() query: ProductQueryDto,
  ): Promise<PaginatedResult<ProductResponseDto>> {
    return this.productsService.list(tenant.organizationId, query);
  }

  @Get(':productId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  @ApiOperation({
    summary:
      'Obtiene el detalle de un producto incluyendo sus proveedores asociados.',
  })
  @ApiOkResponse({ type: ProductDetailEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async findById(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Param('productId', ParseUuidParamPipe) productId: string,
  ): Promise<ProductDetailResponseDto> {
    return this.productsService.findById(tenant.organizationId, productId);
  }

  @Patch(':productId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @ApiOperation({
    summary:
      'Actualiza parcialmente un producto o modifica su estado activo/inactivo.',
  })
  @ApiOkResponse({ type: ProductDetailEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async update(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Param('productId', ParseUuidParamPipe) productId: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductDetailResponseDto> {
    return this.productsService.update(tenant.organizationId, productId, dto);
  }

  @Post(':productId/suppliers')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @ApiOperation({
    summary:
      'Asocia un proveedor a un producto dentro de la misma organización.',
  })
  @ApiCreatedResponse({ type: ProductSupplierItemDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async attachSupplier(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Param('productId', ParseUuidParamPipe) productId: string,
    @Body() dto: AttachSupplierDto,
  ): Promise<ProductSupplierItemDto> {
    return this.productSuppliersService.attach(
      tenant.organizationId,
      productId,
      dto,
    );
  }

  @Get(':productId/suppliers')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  @ApiOperation({
    summary: 'Lista los proveedores asociados a un producto.',
  })
  @ApiOkResponse({ type: ProductSupplierListEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listSuppliers(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Param('productId', ParseUuidParamPipe) productId: string,
  ): Promise<ProductSupplierItemDto[]> {
    return this.productSuppliersService.list(tenant.organizationId, productId);
  }

  @Delete(':productId/suppliers/:supplierId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @ApiOperation({
    summary:
      'Elimina la relación entre un producto y un proveedor sin alterar inventario.',
  })
  @ApiNoContentResponse({ description: 'Relación desasociada exitosamente.' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async detachSupplier(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Param('productId', ParseUuidParamPipe) productId: string,
    @Param('supplierId', ParseUuidParamPipe) supplierId: string,
  ): Promise<void> {
    await this.productSuppliersService.detach(
      tenant.organizationId,
      productId,
      supplierId,
    );
  }
}
