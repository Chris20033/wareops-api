import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PaginationMetaDto,
  PaginationQueryDto,
} from '../../../common/http/pagination.dto.js';

export class CreateSupplierDto {
  @ApiProperty({
    example: 'PROV-ACME-01',
    minLength: 1,
    maxLength: 40,
    description:
      'Código único del proveedor en la organización (normalizado a mayúsculas).',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code!: string;

  @ApiProperty({
    example: 'Empaques y Cajas Acme S.A.',
    minLength: 1,
    maxLength: 160,
    description: 'Razón social o nombre comercial del proveedor.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({
    example: 'Juan Pérez',
    maxLength: 120,
    description: 'Nombre de la persona o ejecutivo de contacto.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @ApiPropertyOptional({
    example: 'contacto@acmeempaques.com',
    maxLength: 320,
    description: 'Correo electrónico de contacto (normalizado a minúsculas).',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'email debe ser un correo electrónico válido.' })
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional({
    example: '+528180001122',
    maxLength: 40,
    description: 'Teléfono de contacto.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(40)
  phone?: string;
}

export class UpdateSupplierDto {
  @ApiPropertyOptional({
    example: 'Empaques Acme de México S.A. de C.V.',
    minLength: 1,
    maxLength: 160,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({
    example: 'Lic. Juan Pérez',
    maxLength: 120,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @ApiPropertyOptional({
    example: 'atencion@acmeempaques.com',
    maxLength: 320,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'email debe ser un correo electrónico válido.' })
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional({
    example: '+528180009988',
    maxLength: 40,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Estado activo del proveedor.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SupplierQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'Acme',
    description: 'Búsqueda por código, nombre o contacto de proveedor.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(160)
  search?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Filtrar por estado activo o inactivo.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: ['name', 'code', 'createdAt'],
    default: 'name',
    example: 'name',
    description: 'Campo para ordenamiento.',
  })
  @IsOptional()
  @IsIn(['name', 'code', 'createdAt'])
  sort?: 'name' | 'code' | 'createdAt' = 'name';

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    default: 'asc',
    example: 'asc',
    description: 'Dirección del ordenamiento.',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'asc';
}

export class SupplierResponseDto {
  @ApiProperty({ example: '320e4bbf-cf97-4f6c-827b-fb80df8f0ad5' })
  id!: string;

  @ApiProperty({ example: '320e4bbf-cf97-4f6c-827b-fb80df8f0ad5' })
  organizationId!: string;

  @ApiProperty({ example: 'PROV-ACME-01' })
  code!: string;

  @ApiProperty({ example: 'Empaques y Cajas Acme S.A.' })
  name!: string;

  @ApiPropertyOptional({ example: 'Juan Pérez', nullable: true })
  contactName!: string | null;

  @ApiPropertyOptional({ example: 'contacto@acmeempaques.com', nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ example: '+528180001122', nullable: true })
  phone!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 2, description: 'Número de productos asociados.' })
  productsCount!: number;

  @ApiProperty({ example: '2026-03-30T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-30T12:00:00.000Z' })
  updatedAt!: string;
}

export class SupplierEnvelopeDto {
  @ApiProperty({ type: SupplierResponseDto })
  data!: SupplierResponseDto;

  @ApiProperty({ example: '6ad489b4-ecc0-48cf-98e1-c5455f7d2963' })
  requestId!: string;
}

export class SupplierListEnvelopeDto {
  @ApiProperty({ type: [SupplierResponseDto] })
  data!: SupplierResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;

  @ApiProperty({ example: '6ad489b4-ecc0-48cf-98e1-c5455f7d2963' })
  requestId!: string;
}
