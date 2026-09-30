import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
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
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator.js';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator.js';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard.js';
import { OrganizationContextGuard } from '../../common/auth/guards/organization-context.guard.js';
import { PermissionsGuard } from '../../common/auth/guards/permissions.guard.js';
import { PERMISSION_CODES } from '../../common/auth/rbac.constants.js';
import { ApiErrorResponseDto } from '../../common/errors/api-error-response.dto.js';
import type {
  AuthenticatedUserContext,
  TenantMembershipContext,
} from '../../common/http/request-with-id.js';
import { AccessibleOrganizationSummaryDto } from '../auth/dto/auth-response.dto.js';
import {
  AccessibleOrganizationsEnvelopeDto,
  CurrentOrganizationDto,
  CurrentOrganizationEnvelopeDto,
  UpdateOrganizationDto,
} from './dto/organization.dto.js';
import { OrganizationsService } from './organizations.service.js';

@ApiTags('Organizations')
@ApiBearerAuth('bearer')
@ApiSecurity('requestId')
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista las organizaciones donde el usuario autenticado posee membresía activa.',
  })
  @ApiOkResponse({ type: AccessibleOrganizationsEnvelopeDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  async listAccessibleOrganizations(
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ): Promise<AccessibleOrganizationSummaryDto[]> {
    return this.organizationsService.listAccessibleOrganizations(currentUser);
  }

  @Get('current')
  @UseGuards(OrganizationContextGuard)
  @ApiSecurity('organizationId')
  @ApiHeader({
    name: 'X-Organization-Id',
    required: true,
    description: 'UUID de la organización activa.',
  })
  @ApiOperation({
    summary:
      'Obtiene el detalle de la organización activa y la membresía/permisos del solicitante.',
  })
  @ApiOkResponse({ type: CurrentOrganizationEnvelopeDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async getCurrentOrganization(
    @CurrentTenant() tenant: TenantMembershipContext,
  ): Promise<CurrentOrganizationDto> {
    return this.organizationsService.getCurrentOrganization(tenant);
  }

  @Patch('current')
  @UseGuards(OrganizationContextGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_CODES.ORGANIZATION_MANAGE)
  @ApiSecurity('organizationId')
  @ApiHeader({
    name: 'X-Organization-Id',
    required: true,
    description: 'UUID de la organización activa.',
  })
  @ApiOperation({
    summary:
      'Actualiza los datos de la organización activa (exclusivo para OWNER).',
  })
  @ApiOkResponse({ type: CurrentOrganizationEnvelopeDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async updateCurrentOrganization(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<CurrentOrganizationDto> {
    return this.organizationsService.updateCurrentOrganization(tenant, dto);
  }
}
