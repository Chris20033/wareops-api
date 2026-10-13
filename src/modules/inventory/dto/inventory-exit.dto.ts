import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class InventoryExitDto {
  @ApiProperty({ description: 'ID del almacén de donde sale la mercancía' })
  @IsNotEmpty()
  @IsUUID('4')
  warehouseId!: string;

  @ApiProperty({ description: 'ID del producto' })
  @IsNotEmpty()
  @IsUUID('4')
  productId!: string;

  @ApiProperty({
    description: 'Cantidad física positiva a despachar o retirar',
    minimum: 1,
    example: 5,
  })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({
    description: 'Motivo obligatorio de la salida',
    maxLength: 240,
    example: 'Consumo interno para mantenimiento',
  })
  @IsNotEmpty({
    message: 'El motivo es obligatorio en una salida de inventario',
  })
  @IsString()
  @MaxLength(240)
  reason!: string;

  @ApiPropertyOptional({
    description: 'Referencia externa opcional',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalReference?: string;
}
