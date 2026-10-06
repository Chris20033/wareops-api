import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PaginationMetaDto,
  PaginationQueryDto,
} from '../../../common/http/pagination.dto.js';

export class CreateWarehouseDto {
  @ApiProperty({
    example: '85fbb9a4-1234-4a25-9c59-efd537fbb974',
    description: 'ID de la sucursal a la que pertenece el almacén.',
  })
  @IsUUID('4', { message: 'branchId debe ser un UUID v4 válido.' })
  branchId!: string;

  @ApiProperty({
    example: 'ALM-MTY-01',
    minLength: 1,
    maxLength: 40,
    description: 'Código único del almacén dentro de la sucursal.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code!: string;

  @ApiProperty({
    example: 'Almacén Principal Monterrey',
    minLength: 1,
    maxLength: 120,
    description: 'Nombre descriptivo del almacén.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    example: 'Almacén general de alta rotación',
    maxLength: 500,
    description: 'Descripción operativa.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateWarehouseDto {
  @ApiPropertyOptional({
    example: 'Almacén Central Modificado',
    minLength: 1,
    maxLength: 120,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: 'Nueva descripción operativa',
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
    description: 'Estado activo del almacén.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class WarehouseQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: '85fbb9a4-1234-4a25-9c59-efd537fbb974',
    description: 'Filtrar almacenes por sucursal específica.',
  })
  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @ApiPropertyOptional({
    example: 'Refrigerado',
    description: 'Búsqueda por nombre o código de almacén.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
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

export class WarehouseBranchSummaryDto {
  @ApiProperty({ example: '85fbb9a4-1234-4a25-9c59-efd537fbb974' })
  id!: string;

  @ApiProperty({ example: 'SUC-MTY-01' })
  code!: string;

  @ApiProperty({ example: 'Sucursal Monterrey' })
  name!: string;
}

export class WarehouseResponseDto {
  @ApiProperty({ example: '94e2cb5a-5678-4b36-ad68-fed648fcc185' })
  id!: string;

  @ApiProperty({ example: '85fbb9a4-1234-4a25-9c59-efd537fbb974' })
  branchId!: string;

  @ApiProperty({ example: 'ALM-MTY-01' })
  code!: string;

  @ApiProperty({ example: 'Almacén Principal Monterrey' })
  name!: string;

  @ApiPropertyOptional({
    example: 'Almacén general de alta rotación',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: WarehouseBranchSummaryDto })
  branch!: WarehouseBranchSummaryDto;

  @ApiProperty({ example: '2026-03-30T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-30T12:00:00.000Z' })
  updatedAt!: string;
}

export class WarehouseEnvelopeDto {
  @ApiProperty({ type: WarehouseResponseDto })
  data!: WarehouseResponseDto;

  @ApiProperty({ example: '6ad489b4-ecc0-48cf-98e1-c5455f7d2963' })
  requestId!: string;
}

export class WarehouseListEnvelopeDto {
  @ApiProperty({ type: [WarehouseResponseDto] })
  data!: WarehouseResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;

  @ApiProperty({ example: '6ad489b4-ecc0-48cf-98e1-c5455f7d2963' })
  requestId!: string;
}
