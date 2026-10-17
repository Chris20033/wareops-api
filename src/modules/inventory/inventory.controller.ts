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
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
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
import type {
  RequestWithId,
  TenantMembershipContext,
} from '../../common/http/request-with-id.js';
import { IdempotencyKey } from '../../common/idempotency/idempotency-key.decorator.js';
import {
  ConfigureMinimumStockDto,
  UpdateMinimumStockDto,
} from './dto/update-minimum-stock.dto.js';
import { CreateTransferDto } from './dto/create-transfer.dto.js';
import { InventoryAdjustmentDto } from './dto/inventory-adjustment.dto.js';
import { InventoryEntryDto } from './dto/inventory-entry.dto.js';
import { InventoryExitDto } from './dto/inventory-exit.dto.js';
import { InventoryQueryDto } from './dto/inventory-query.dto.js';
import { TransfersQueryDto } from './dto/transfers-query.dto.js';
import { InventoryService } from './inventory.service.js';

@ApiTags('Inventory')
@ApiBearerAuth('bearer')
@ApiSecurity('organizationId')
@ApiSecurity('requestId')
@UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.INVENTORY_READ)
  @ApiOperation({
    summary:
      'Lista los saldos de inventario de la organización activa con soporte de filtros por almacén, producto, alertas de mínimo y paginación.',
  })
  @ApiOkResponse({ description: 'Listado paginado de saldos de inventario' })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async list(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Query() query: InventoryQueryDto,
  ) {
    return this.inventoryService.listBalances(tenant.organizationId, query);
  }

  @Post('transfers')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSION_CODES.INVENTORY_WRITE)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Clave única de idempotencia para la transacción de transferencia',
  })
  @ApiOperation({
    summary:
      'Registra una transferencia de inventario entre dos almacenes de forma idempotente, atómica y serializable.',
  })
  @ApiCreatedResponse({
    description: 'Transferencia registrada y movimientos generados',
  })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async transfer(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Req() req: RequestWithId,
    @IdempotencyKey() idempotencyKey: string,
    @Body() dto: CreateTransferDto,
  ) {
    return this.inventoryService.recordTransfer(
      tenant.organizationId,
      tenant.membershipId,
      req.authContext?.userId ?? 'system',
      req.requestId,
      dto,
      idempotencyKey,
    );
  }

  @Get('transfers')
  @RequirePermissions(PERMISSION_CODES.INVENTORY_READ)
  @ApiOperation({
    summary:
      'Lista el historial paginado de transferencias de inventario de la organización activa.',
  })
  @ApiOkResponse({ description: 'Listado paginado de transferencias' })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listTransfers(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Query() query: TransfersQueryDto,
  ) {
    return this.inventoryService.listTransfers(tenant.organizationId, query);
  }

  @Get('transfers/:transferId')
  @RequirePermissions(PERMISSION_CODES.INVENTORY_READ)
  @ApiOperation({
    summary:
      'Obtiene el detalle completo de una transferencia incluyendo almacenes, producto y ambos movimientos.',
  })
  @ApiOkResponse({ description: 'Detalle de la transferencia' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async getTransfer(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Param('transferId', ParseUuidParamPipe) transferId: string,
  ) {
    return this.inventoryService.getTransfer(tenant.organizationId, transferId);
  }

  @Get(':balanceId')
  @RequirePermissions(PERMISSION_CODES.INVENTORY_READ)
  @ApiOperation({
    summary:
      'Obtiene el detalle de un saldo específico calculando disponibilidad física y alerta de mínimo.',
  })
  @ApiOkResponse({ description: 'Detalle del saldo de inventario' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async get(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Param('balanceId', ParseUuidParamPipe) balanceId: string,
  ) {
    return this.inventoryService.getBalance(tenant.organizationId, balanceId);
  }

  @Patch('minimum-stock')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @ApiOperation({
    summary:
      'Configura el umbral de existencia mínima por almacén y producto (PATCH), creando el saldo si no existe aún.',
  })
  @ApiOkResponse({
    description: 'Saldo creado o actualizado con el nuevo mínimo',
  })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async configureMinimumPatch(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Req() req: RequestWithId,
    @Body() dto: ConfigureMinimumStockDto,
  ) {
    return this.inventoryService.configureMinimumStock(
      tenant.organizationId,
      req.authContext?.userId ?? 'system',
      req.requestId,
      dto,
    );
  }

  @Post('minimum-stock')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @ApiOperation({
    summary:
      'Configura el umbral de existencia mínima por almacén y producto, creando el saldo si no existe aún.',
  })
  @ApiOkResponse({
    description: 'Saldo creado o actualizado con el nuevo mínimo',
  })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async configureMinimum(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Req() req: RequestWithId,
    @Body() dto: ConfigureMinimumStockDto,
  ) {
    return this.inventoryService.configureMinimumStock(
      tenant.organizationId,
      req.authContext?.userId ?? 'system',
      req.requestId,
      dto,
    );
  }

  @Patch(':balanceId/minimum-stock')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @ApiOperation({
    summary:
      'Actualiza el umbral de existencia mínima (minimumStock) de un saldo para el cálculo de alertas.',
  })
  @ApiOkResponse({ description: 'Saldo actualizado con el nuevo mínimo' })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async updateMinimum(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Req() req: RequestWithId,
    @Param('balanceId', ParseUuidParamPipe) balanceId: string,
    @Body() dto: UpdateMinimumStockDto,
  ) {
    return this.inventoryService.updateMinimumStock(
      tenant.organizationId,
      req.authContext?.userId ?? 'system',
      req.requestId,
      balanceId,
      dto,
    );
  }

  @Post('entries')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSION_CODES.INVENTORY_WRITE)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única de idempotencia para la transacción',
  })
  @ApiOperation({
    summary:
      'Registra una entrada de inventario de forma idempotente, atómica y serializable.',
  })
  @ApiCreatedResponse({
    description: 'Entrada registrada y movimiento generado',
  })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async entry(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Req() req: RequestWithId,
    @IdempotencyKey() idempotencyKey: string,
    @Body() dto: InventoryEntryDto,
  ) {
    return this.inventoryService.recordEntry(
      tenant.organizationId,
      tenant.membershipId,
      req.authContext?.userId ?? 'system',
      req.requestId,
      dto,
      idempotencyKey,
    );
  }

  @Post('exits')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSION_CODES.INVENTORY_WRITE)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única de idempotencia para la transacción',
  })
  @ApiOperation({
    summary:
      'Registra una salida de inventario verificando existencia disponible y ejecutando actualización condicional.',
  })
  @ApiCreatedResponse({
    description: 'Salida registrada y movimiento generado',
  })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async exit(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Req() req: RequestWithId,
    @IdempotencyKey() idempotencyKey: string,
    @Body() dto: InventoryExitDto,
  ) {
    return this.inventoryService.recordExit(
      tenant.organizationId,
      tenant.membershipId,
      req.authContext?.userId ?? 'system',
      req.requestId,
      dto,
      idempotencyKey,
    );
  }

  @Post('adjustments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSION_CODES.INVENTORY_WRITE)
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única de idempotencia para la transacción',
  })
  @ApiOperation({
    summary:
      'Registra un ajuste de inventario con delta positivo o negativo y motivo obligatorio.',
  })
  @ApiCreatedResponse({
    description: 'Ajuste registrado y movimiento generado',
  })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async adjustment(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Req() req: RequestWithId,
    @IdempotencyKey() idempotencyKey: string,
    @Body() dto: InventoryAdjustmentDto,
  ) {
    return this.inventoryService.recordAdjustment(
      tenant.organizationId,
      tenant.membershipId,
      req.authContext?.userId ?? 'system',
      req.requestId,
      dto,
      idempotencyKey,
    );
  }
}
