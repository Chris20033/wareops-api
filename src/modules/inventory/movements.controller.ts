import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { ParseUuidParamPipe } from '../../common/http/parse-uuid-param.pipe.js';
import type { TenantMembershipContext } from '../../common/http/request-with-id.js';
import { MovementsQueryDto } from './dto/movements-query.dto.js';
import { InventoryService } from './inventory.service.js';

@ApiTags('Inventory - Movements')
@ApiBearerAuth('bearer')
@ApiSecurity('organizationId')
@ApiSecurity('requestId')
@UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionsGuard)
@Controller('movements')
export class MovementsController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.INVENTORY_READ)
  @ApiOperation({
    summary:
      'Consulta el historial paginado de movimientos de inventario con filtros por producto, almacén, tipo, actor y rango de fechas.',
  })
  @ApiOkResponse({ description: 'Listado paginado de movimientos' })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async list(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Query() query: MovementsQueryDto,
  ) {
    return this.inventoryService.listMovements(tenant.organizationId, query);
  }

  @Get(':movementId')
  @RequirePermissions(PERMISSION_CODES.INVENTORY_READ)
  @ApiOperation({
    summary:
      'Obtiene el detalle completo de un movimiento de inventario incluyendo saldos y cabecera de operación.',
  })
  @ApiOkResponse({ description: 'Detalle del movimiento de inventario' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async get(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Param('movementId', ParseUuidParamPipe) movementId: string,
  ) {
    return this.inventoryService.getMovement(tenant.organizationId, movementId);
  }
}
