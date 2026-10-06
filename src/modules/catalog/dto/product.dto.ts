import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
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

export class CreateProductDto {
  @ApiProperty({
    example: 'PROD-A01',
    minLength: 1,
    maxLength: 80,
    description: 'SKU único en la organización (normalizado a mayúsculas).',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  sku!: string;

  @ApiProperty({
    example: 'Caja de Cartón Reforzada 40x40',
    minLength: 1,
    maxLength: 160,
    description: 'Nombre visible del producto.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({
    example: 'Empaque industrial corrugado calibre estándar',
    maxLength: 500,
    description: 'Descripción del producto.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional({
    example: 'Caja de Cartón Extra Reforzada',
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
    example: 'Nueva descripción técnica',
    maxLength: 500,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Estado activo del producto.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'Cartón',
    description: 'Búsqueda por SKU o nombre de producto.',
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
    enum: ['name', 'sku', 'createdAt'],
    default: 'name',
    example: 'name',
    description: 'Campo para ordenamiento.',
  })
  @IsOptional()
  @IsIn(['name', 'sku', 'createdAt'])
  sort?: 'name' | 'sku' | 'createdAt' = 'name';

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

export class ProductSupplierSummaryDto {
  @ApiProperty({ example: '320e4bbf-cf97-4f6c-827b-fb80df8f0ad5' })
  id!: string;

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

  @ApiProperty({ example: '2026-03-30T12:00:00.000Z' })
  linkedAt!: string;
}

export class ProductResponseDto {
  @ApiProperty({ example: '11a2b3c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c' })
  id!: string;

  @ApiProperty({ example: '320e4bbf-cf97-4f6c-827b-fb80df8f0ad5' })
  organizationId!: string;

  @ApiProperty({ example: 'PROD-A01' })
  sku!: string;

  @ApiProperty({ example: 'Caja de Cartón Reforzada 40x40' })
  name!: string;

  @ApiPropertyOptional({
    example: 'Empaque industrial corrugado calibre estándar',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 1, description: 'Número de proveedores asociados.' })
  suppliersCount!: number;

  @ApiProperty({ example: '2026-03-30T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-30T12:00:00.000Z' })
  updatedAt!: string;
}

export class ProductDetailResponseDto extends ProductResponseDto {
  @ApiProperty({ type: [ProductSupplierSummaryDto] })
  suppliers!: ProductSupplierSummaryDto[];
}

export class ProductEnvelopeDto {
  @ApiProperty({ type: ProductResponseDto })
  data!: ProductResponseDto;

  @ApiProperty({ example: '6ad489b4-ecc0-48cf-98e1-c5455f7d2963' })
  requestId!: string;
}

export class ProductDetailEnvelopeDto {
  @ApiProperty({ type: ProductDetailResponseDto })
  data!: ProductDetailResponseDto;

  @ApiProperty({ example: '6ad489b4-ecc0-48cf-98e1-c5455f7d2963' })
  requestId!: string;
}

export class ProductListEnvelopeDto {
  @ApiProperty({ type: [ProductResponseDto] })
  data!: ProductResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;

  @ApiProperty({ example: '6ad489b4-ecc0-48cf-98e1-c5455f7d2963' })
  requestId!: string;
}
