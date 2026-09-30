import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
  ListMembersQueryDto,
  MemberDto,
  MemberEnvelopeDto,
  PaginatedMembersEnvelopeDto,
  UpdateMemberDto,
} from './dto/member.dto.js';
import { MembersService } from './members.service.js';

@ApiTags('Members')
@ApiBearerAuth('bearer')
@ApiSecurity('organizationId')
@ApiSecurity('requestId')
@ApiHeader({
  name: 'X-Organization-Id',
  required: true,
  description: 'UUID de la organización activa.',
})
@UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionsGuard)
@RequirePermissions(PERMISSION_CODES.MEMBER_MANAGE)
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({
    summary:
      'Lista las membresías de la organización activa de forma paginada.',
  })
  @ApiOkResponse({ type: PaginatedMembersEnvelopeDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  async listMembers(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Query() query: ListMembersQueryDto,
  ): Promise<PaginatedResult<MemberDto>> {
    return this.membersService.listMembers(tenant, query);
  }

  @Patch(':membershipId')
  @ApiOperation({
    summary:
      'Cambia el rol o el estado (ACTIVE/INACTIVE) de una membresía de la organización activa.',
  })
  @ApiParam({ name: 'membershipId', format: 'uuid' })
  @ApiOkResponse({ type: MemberEnvelopeDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ApiErrorResponseDto })
  async updateMember(
    @CurrentTenant() tenant: TenantMembershipContext,
    @Param('membershipId', ParseUuidParamPipe) membershipId: string,
    @Body() dto: UpdateMemberDto,
  ): Promise<MemberDto> {
    return this.membersService.updateMember(tenant, membershipId, dto);
  }
}
