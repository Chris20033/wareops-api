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
import { BranchesService } from './branches.service.js';
import {
  BranchEnvelopeDto,
  BranchListEnvelopeDto,
  BranchQueryDto,
  BranchResponseDto,
  CreateBranchDto,
  UpdateBranchDto,
} from './dto/branch.dto.js';

@ApiTags('Catalog - Branches')
@ApiBearerAuth('bearer')
@ApiSecurity('organizationId')
@ApiSecurity('requestId')
@UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionsGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @ApiOperation({
    summary: 'Crea una nueva sucursal en la organización activa.',
  })
  @ApiCreatedResponse({ type: BranchEnvelopeDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async create(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Body() dto: CreateBranchDto,
  ): Promise<BranchResponseDto> {
    return this.branchesService.create(tenant.organizationId, dto);
  }

  @Get()
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  @ApiOperation({
    summary:
      'Lista sucursales paginadas con soporte de filtros y ordenamiento.',
  })
  @ApiOkResponse({ type: BranchListEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async list(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Query() query: BranchQueryDto,
  ): Promise<PaginatedResult<BranchResponseDto>> {
    return this.branchesService.list(tenant.organizationId, query);
  }

  @Get(':branchId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_READ)
  @ApiOperation({
    summary: 'Obtiene el detalle de una sucursal por su identificador.',
  })
  @ApiOkResponse({ type: BranchEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async findById(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Param('branchId', ParseUuidParamPipe) branchId: string,
  ): Promise<BranchResponseDto> {
    return this.branchesService.findById(tenant.organizationId, branchId);
  }

  @Patch(':branchId')
  @RequirePermissions(PERMISSION_CODES.CATALOG_WRITE)
  @ApiOperation({
    summary:
      'Actualiza parcialmente una sucursal o modifica su estado activo/inactivo.',
  })
  @ApiOkResponse({ type: BranchEnvelopeDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async update(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Param('branchId', ParseUuidParamPipe) branchId: string,
    @Body() dto: UpdateBranchDto,
  ): Promise<BranchResponseDto> {
    return this.branchesService.update(tenant.organizationId, branchId, dto);
  }
}
