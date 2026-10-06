import {
  Body,
  Controller,
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
  CreateSupplierDto,
  SupplierEnvelopeDto,
  SupplierListEnvelopeDto,
  SupplierQueryDto,
  SupplierResponseDto,
  UpdateSupplierDto,
} from './dto/supplier.dto.js';
import { SuppliersService } from './suppliers.service.js';

@ApiTags('Catalog - Suppliers')
@ApiBearerAuth('bearer')
@ApiSecurity('organizationId')
@ApiSecurity('requestId')
@UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionsGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @ApiOperation({
    summary: 'Crea un nuevo proveedor en la organización activa.',
  })
  @ApiCreatedResponse({ type: SupplierEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async create(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Body() dto: CreateSupplierDto,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.create(tenant.organizationId, dto);
  }

  @Get()
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  @ApiOperation({
    summary:
      'Lista proveedores paginados con soporte de búsqueda textual, filtros y ordenamiento.',
  })
  @ApiOkResponse({ type: SupplierListEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async list(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Query() query: SupplierQueryDto,
  ): Promise<PaginatedResult<SupplierResponseDto>> {
    return this.suppliersService.list(tenant.organizationId, query);
  }

  @Get(':supplierId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  @ApiOperation({
    summary: 'Obtiene el detalle de un proveedor por su identificador.',
  })
  @ApiOkResponse({ type: SupplierEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async findById(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Param('supplierId', ParseUuidParamPipe) supplierId: string,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.findById(tenant.organizationId, supplierId);
  }

  @Patch(':supplierId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @ApiOperation({
    summary:
      'Actualiza parcialmente un proveedor o modifica su estado activo/inactivo.',
  })
  @ApiOkResponse({ type: SupplierEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async update(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Param('supplierId', ParseUuidParamPipe) supplierId: string,
    @Body() dto: UpdateSupplierDto,
  ): Promise<SupplierResponseDto> {
    return this.suppliersService.update(tenant.organizationId, supplierId, dto);
  }
}
