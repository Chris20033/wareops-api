import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentTenant } from '../../common/auth/decorators/current-tenant.decorator.js';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator.js';
import { Public } from '../../common/auth/decorators/public.decorator.js';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator.js';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard.js';
import { OrganizationContextGuard } from '../../common/auth/guards/organization-context.guard.js';
import { PermissionsGuard } from '../../common/auth/guards/permissions.guard.js';
import { PERMISSION_CODES } from '../../common/auth/rbac.constants.js';
import { ApiErrorResponseDto } from '../../common/errors/api-error-response.dto.js';
import type { PaginatedResult } from '../../common/http/pagination.dto.js';
import { ParseUuidParamPipe } from '../../common/http/parse-uuid-param.pipe.js';
import type {
  AuthenticatedUserContext,
  RequestWithId,
  TenantMembershipContext,
} from '../../common/http/request-with-id.js';
import {
  AcceptedInvitationEnvelopeDto,
  AcceptedInvitationResultDto,
  CreatedInvitationDto,
  CreatedInvitationEnvelopeDto,
  CreateInvitationDto,
  InvitationDto,
  InvitationEnvelopeDto,
  ListInvitationsQueryDto,
  PaginatedInvitationsEnvelopeDto,
  AcceptInvitationDto,
} from './dto/invitation.dto.js';
import { InvitationsService } from './invitations.service.js';

@ApiTags('Invitations')
@ApiSecurity('requestId')
@UseGuards(JwtAuthGuard)
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @UseGuards(OrganizationContextGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_CODES.MEMBER_MANAGE)
  @ApiBearerAuth('bearer')
  @ApiSecurity('organizationId')
  @ApiHeader({
    name: 'X-Organization-Id',
    required: true,
    description: 'UUID de la organización activa.',
  })
  @ApiOperation({
    summary:
      'Crea una invitación temporal (72h) y devuelve por única vez el enlace copiable.',
  })
  @ApiCreatedResponse({ type: CreatedInvitationEnvelopeDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async createInvitation(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @CurrentTenant() tenant: TenantMembershipContext,
    @Body() dto: CreateInvitationDto,
  ): Promise<CreatedInvitationDto> {
    return this.invitationsService.createInvitation(currentUser, tenant, dto);
  }

  @Get()
  @UseGuards(OrganizationContextGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_CODES.MEMBER_MANAGE)
  @ApiBearerAuth('bearer')
  @ApiSecurity('organizationId')
  @ApiHeader({
    name: 'X-Organization-Id',
    required: true,
    description: 'UUID de la organización activa.',
  })
  @ApiOperation({
    summary:
      'Lista las invitaciones de la organización activa de forma paginada sin exponer hashes.',
  })
  @ApiOkResponse({ type: PaginatedInvitationsEnvelopeDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async listInvitations(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Query() query: ListInvitationsQueryDto,
  ): Promise<PaginatedResult<InvitationDto>> {
    return this.invitationsService.listInvitations(tenant, query);
  }

  @Post(':invitationId/revoke')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrganizationContextGuard, PermissionsGuard)
  @RequirePermissions(PERMISSION_CODES.MEMBER_MANAGE)
  @ApiBearerAuth('bearer')
  @ApiSecurity('organizationId')
  @ApiHeader({
    name: 'X-Organization-Id',
    required: true,
    description: 'UUID de la organización activa.',
  })
  @ApiParam({ name: 'invitationId', format: 'uuid' })
  @ApiOperation({
    summary: 'Revoca una invitación pendiente de la organización activa.',
  })
  @ApiOkResponse({ type: InvitationEnvelopeDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async revokeInvitation(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Param('invitationId', ParseUuidParamPipe) invitationId: string,
  ): Promise<InvitationDto> {
    return this.invitationsService.revokeInvitation(tenant, invitationId);
  }

  @Public()
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Acepta una invitación pendiente usando una cuenta autenticada del mismo correo o creando una cuenta nueva.',
  })
  @ApiOkResponse({ type: AcceptedInvitationEnvelopeDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async acceptInvitation(
    @Req() request: RequestWithId,
    @Body() dto: AcceptInvitationDto,
  ): Promise<AcceptedInvitationResultDto> {
    return this.invitationsService.acceptInvitation(request, dto);
  }
}
