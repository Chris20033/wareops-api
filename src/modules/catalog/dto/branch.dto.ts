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

export class CreateBranchDto {
  @ApiProperty({
    example: 'SUC-MTY-01',
    minLength: 1,
    maxLength: 40,
    description: 'Código único de la sucursal en la organización.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code!: string;

  @ApiProperty({
    example: 'Sucursal Monterrey',
    minLength: 1,
    maxLength: 120,
    description: 'Nombre visible de la sucursal.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    example: 'Av. Constitución 1000, Monterrey, NL',
    maxLength: 500,
    description: 'Dirección física de la sucursal.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  address?: string;
}

export class UpdateBranchDto {
  @ApiPropertyOptional({
    example: 'Sucursal Monterrey Norte',
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
    example: 'Av. Constitución 2000, Monterrey, NL',
    maxLength: 500,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Estado activo de la sucursal.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BranchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'Monterrey',
    description: 'Búsqueda por nombre o código de sucursal.',
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

export class BranchResponseDto {
  @ApiProperty({ example: '85fbb9a4-1234-4a25-9c59-efd537fbb974' })
  id!: string;

  @ApiProperty({ example: '320e4bbf-cf97-4f6c-827b-fb80df8f0ad5' })
  organizationId!: string;

  @ApiProperty({ example: 'SUC-MTY-01' })
  code!: string;

  @ApiProperty({ example: 'Sucursal Monterrey' })
  name!: string;

  @ApiPropertyOptional({
    example: 'Av. Constitución 1000, Monterrey, NL',
    nullable: true,
  })
  address!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 2, description: 'Número de almacenes asociados.' })
  warehousesCount!: number;

  @ApiProperty({ example: '2026-03-30T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-30T12:00:00.000Z' })
  updatedAt!: string;
}

export class BranchEnvelopeDto {
  @ApiProperty({ type: BranchResponseDto })
  data!: BranchResponseDto;

  @ApiProperty({ example: '6ad489b4-ecc0-48cf-98e1-c5455f7d2963' })
  requestId!: string;
}

export class BranchListEnvelopeDto {
  @ApiProperty({ type: [BranchResponseDto] })
  data!: BranchResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;

  @ApiProperty({ example: '6ad489b4-ecc0-48cf-98e1-c5455f7d2963' })
  requestId!: string;
}
