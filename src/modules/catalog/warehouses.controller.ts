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
  CreateWarehouseDto,
  UpdateWarehouseDto,
  WarehouseEnvelopeDto,
  WarehouseListEnvelopeDto,
  WarehouseQueryDto,
  WarehouseResponseDto,
} from './dto/warehouse.dto.js';
import { WarehousesService } from './warehouses.service.js';

@ApiTags('Catalog - Warehouses')
@ApiBearerAuth('bearer')
@ApiSecurity('organizationId')
@ApiSecurity('requestId')
@UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionsGuard)
@Controller('warehouses')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @ApiOperation({
    summary: 'Crea un nuevo almacén dentro de una sucursal del tenant activo.',
  })
  @ApiCreatedResponse({ type: WarehouseEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async create(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Body() dto: CreateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    return this.warehousesService.create(tenant.organizationId, dto);
  }

  @Get()
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  @ApiOperation({
    summary:
      'Lista almacenes paginados con soporte de filtro por sucursal, búsqueda y ordenamiento.',
  })
  @ApiOkResponse({ type: WarehouseListEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async list(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Query() query: WarehouseQueryDto,
  ): Promise<PaginatedResult<WarehouseResponseDto>> {
    return this.warehousesService.list(tenant.organizationId, query);
  }

  @Get(':warehouseId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  @ApiOperation({
    summary: 'Obtiene el detalle de un almacén por su identificador.',
  })
  @ApiOkResponse({ type: WarehouseEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async findById(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Param('warehouseId', ParseUuidParamPipe) warehouseId: string,
  ): Promise<WarehouseResponseDto> {
    return this.warehousesService.findById(tenant.organizationId, warehouseId);
  }

  @Patch(':warehouseId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @ApiOperation({
    summary:
      'Actualiza parcialmente un almacén o modifica su estado activo/inactivo.',
  })
  @ApiOkResponse({ type: WarehouseEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async update(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Param('warehouseId', ParseUuidParamPipe) warehouseId: string,
    @Body() dto: UpdateWarehouseDto,
  ): Promise<WarehouseResponseDto> {
    return this.warehousesService.update(
      tenant.organizationId,
      warehouseId,
      dto,
    );
  }
}
