import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class InventoryQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por ID de producto' })
  @IsOptional()
  @IsUUID('4')
  productId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID de almacén' })
  @IsOptional()
  @IsUUID('4')
  warehouseId?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar solo saldos en alerta de mínimo (available <= minimumStock)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') {
      return true;
    }
    if (value === 'false' || value === false || value === 0 || value === '0') {
      return false;
    }
    return Boolean(value);
  })
  @IsBoolean()
  alertOnly?: boolean;

  @ApiPropertyOptional({
    description:
      'Búsqueda por SKU/nombre de producto o código/nombre de almacén',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({
    enum: ['createdAt', 'onHand', 'reserved', 'minimumStock'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'onHand', 'reserved', 'minimumStock'])
  sortBy: 'createdAt' | 'onHand' | 'reserved' | 'minimumStock' = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
