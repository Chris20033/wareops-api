import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsIanaTimezone } from '../../../common/http/timezone.validator.js';
import {
  AccessibleOrganizationSummaryDto,
  AuthRoleSummaryDto,
} from '../../auth/dto/auth-response.dto.js';

export class UpdateOrganizationDto {
  @ApiPropertyOptional({
    example: 'Logística Norte Corporativo',
    minLength: 2,
    maxLength: 120,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: 'logistica-norte-corp',
    minLength: 2,
    maxLength: 80,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'slug sólo puede contener letras minúsculas, números y guiones intermedios.',
  })
  slug?: string;

  @ApiPropertyOptional({ example: 'America/Monterrey' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(64)
  @IsIanaTimezone()
  timezone?: string;
}

export class CurrentMembershipSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE'], example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ type: () => AuthRoleSummaryDto })
  role!: AuthRoleSummaryDto;

  @ApiProperty({
    type: [String],
    example: ['organization:manage', 'member:manage', 'catalog:read'],
  })
  permissions!: string[];
}

export class CurrentOrganizationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Logística Norte S.A.' })
  name!: string;

  @ApiProperty({ example: 'logistica-norte' })
  slug!: string;

  @ApiProperty({ example: 'America/Mexico_City' })
  timezone!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: () => CurrentMembershipSummaryDto })
  membership!: CurrentMembershipSummaryDto;
}

export class AccessibleOrganizationsEnvelopeDto {
  @ApiProperty({ type: () => [AccessibleOrganizationSummaryDto] })
  data!: AccessibleOrganizationSummaryDto[];

  @ApiProperty({ format: 'uuid' })
  requestId!: string;
}

export class CurrentOrganizationEnvelopeDto {
  @ApiProperty({ type: () => CurrentOrganizationDto })
  data!: CurrentOrganizationDto;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;
}
