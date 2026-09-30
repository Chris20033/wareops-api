import { ApiProperty } from '@nestjs/swagger';

export class AuthRoleSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'OWNER' })
  code!: string;

  @ApiProperty({ example: 'Propietario' })
  name!: string;
}

export class AccessibleOrganizationSummaryDto {
  @ApiProperty({ format: 'uuid' })
  membershipId!: string;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ example: 'Logística Norte S.A.' })
  name!: string;

  @ApiProperty({ example: 'logistica-norte' })
  slug!: string;

  @ApiProperty({ example: 'America/Mexico_City' })
  timezone!: string;

  @ApiProperty({ type: () => AuthRoleSummaryDto })
  role!: AuthRoleSummaryDto;

  @ApiProperty({
    type: [String],
    example: ['organization:manage', 'member:manage', 'catalog:read'],
  })
  permissions!: string[];
}

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ana.garcia@wareops.local' })
  email!: string;

  @ApiProperty({ example: 'Ana García' })
  displayName!: string;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class AuthSessionDto {
  @ApiProperty({
    description: 'JWT de acceso de corta duración (15m).',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Tiempo de vida del access token en segundos.',
    example: 900,
  })
  expiresIn!: number;

  @ApiProperty({ type: () => AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({ type: () => [AccessibleOrganizationSummaryDto] })
  organizations!: AccessibleOrganizationSummaryDto[];
}

export class AuthSessionEnvelopeDto {
  @ApiProperty({ type: () => AuthSessionDto })
  data!: AuthSessionDto;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;
}

export class AuthenticatedProfileDto {
  @ApiProperty({ format: 'uuid' })
  sessionId!: string;

  @ApiProperty({ type: () => AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({ type: () => [AccessibleOrganizationSummaryDto] })
  organizations!: AccessibleOrganizationSummaryDto[];
}

export class AuthenticatedProfileEnvelopeDto {
  @ApiProperty({ type: () => AuthenticatedProfileDto })
  data!: AuthenticatedProfileDto;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;
}

export class LogoutResultDto {
  @ApiProperty({ example: true })
  loggedOut!: boolean;
}

export class LogoutEnvelopeDto {
  @ApiProperty({ type: () => LogoutResultDto })
  data!: LogoutResultDto;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;
}
