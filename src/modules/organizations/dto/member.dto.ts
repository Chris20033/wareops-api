import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  ROLE_CODES,
  type RoleCode,
} from '../../../common/auth/rbac.constants.js';
import {
  PaginationMetaDto,
  PaginationQueryDto,
} from '../../../common/http/pagination.dto.js';
import { MembershipStatus } from '../../../generated/prisma/enums.js';
import { AuthRoleSummaryDto } from '../../auth/dto/auth-response.dto.js';

const VALID_ROLE_CODES = Object.values(ROLE_CODES);

export class ListMembersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MembershipStatus })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;

  @ApiPropertyOptional({ enum: VALID_ROLE_CODES })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(VALID_ROLE_CODES)
  roleCode?: RoleCode;

  @ApiPropertyOptional({
    description: 'Búsqueda por nombre visible o correo electrónico.',
    maxLength: 120,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: VALID_ROLE_CODES, example: 'MANAGER' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(VALID_ROLE_CODES)
  roleCode?: RoleCode;

  @ApiPropertyOptional({ enum: MembershipStatus, example: 'ACTIVE' })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}

export class MemberUserSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'carlos.mendez@wareops.local' })
  email!: string;

  @ApiProperty({ example: 'Carlos Méndez' })
  displayName!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;
}

export class MemberDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ enum: MembershipStatus, example: 'ACTIVE' })
  status!: MembershipStatus;

  @ApiProperty({ type: () => MemberUserSummaryDto })
  user!: MemberUserSummaryDto;

  @ApiProperty({ type: () => AuthRoleSummaryDto })
  role!: AuthRoleSummaryDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class MemberEnvelopeDto {
  @ApiProperty({ type: () => MemberDto })
  data!: MemberDto;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;
}

export class PaginatedMembersEnvelopeDto {
  @ApiProperty({ type: () => [MemberDto] })
  data!: MemberDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;
}
