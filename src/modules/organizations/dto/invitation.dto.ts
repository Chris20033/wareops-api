import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PaginationMetaDto,
  PaginationQueryDto,
} from '../../../common/http/pagination.dto.js';
import { InvitationStatus } from '../../../generated/prisma/enums.js';
import { AuthRoleSummaryDto } from '../../auth/dto/auth-response.dto.js';
import { MemberDto } from './member.dto.js';

export class CreateInvitationDto {
  @ApiProperty({ example: 'operador.nuevo@wareops.local', maxLength: 320 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({
    description:
      'Código del rol invitado (ADMIN, MANAGER, OPERATOR, VIEWER). OWNER se rechaza en dominio.',
    example: 'OPERATOR',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  roleCode!: string;
}

export class ListInvitationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InvitationStatus })
  @IsOptional()
  @IsEnum(InvitationStatus)
  status?: InvitationStatus;

  @ApiPropertyOptional({
    description: 'Búsqueda por correo electrónico invitado.',
    maxLength: 320,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @MaxLength(320)
  search?: string;
}

export class AcceptInvitationDto {
  @ApiProperty({
    description: 'Token opaco incluido en el enlace de invitación.',
    minLength: 16,
    maxLength: 256,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  token!: string;

  @ApiPropertyOptional({
    description: 'Nombre visible requerido cuando aún no existe cuenta.',
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
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Contraseña requerida cuando aún no existe cuenta.',
    minLength: 8,
    maxLength: 128,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}

export class InvitationIssuerSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ana.garcia@wareops.local' })
  email!: string;

  @ApiProperty({ example: 'Ana García' })
  displayName!: string;
}

export class InvitationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ example: 'operador.nuevo@wareops.local' })
  email!: string;

  @ApiProperty({ enum: InvitationStatus, example: 'PENDING' })
  status!: InvitationStatus;

  @ApiProperty({ type: () => AuthRoleSummaryDto })
  role!: AuthRoleSummaryDto;

  @ApiProperty({ type: () => InvitationIssuerSummaryDto })
  invitedBy!: InvitationIssuerSummaryDto;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  acceptedAt!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  revokedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class CreatedInvitationDto extends InvitationDto {
  @ApiProperty({
    description: 'Token opaco devuelto únicamente al crear la invitación.',
  })
  invitationToken!: string;

  @ApiProperty({
    description: 'Enlace copiable devuelto únicamente al crear la invitación.',
    example: 'http://localhost:3000/invitations/accept?token=...',
  })
  invitationUrl!: string;
}

export class AcceptedInvitationResultDto {
  @ApiProperty({ type: () => InvitationDto })
  invitation!: InvitationDto;

  @ApiProperty({ type: () => MemberDto })
  membership!: MemberDto;
}

export class CreatedInvitationEnvelopeDto {
  @ApiProperty({ type: () => CreatedInvitationDto })
  data!: CreatedInvitationDto;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;
}

export class InvitationEnvelopeDto {
  @ApiProperty({ type: () => InvitationDto })
  data!: InvitationDto;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;
}

export class PaginatedInvitationsEnvelopeDto {
  @ApiProperty({ type: () => [InvitationDto] })
  data!: InvitationDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;
}

export class AcceptedInvitationEnvelopeDto {
  @ApiProperty({ type: () => AcceptedInvitationResultDto })
  data!: AcceptedInvitationResultDto;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;
}
