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

export class InventoryEntryDto {
  @ApiProperty({ description: 'ID del almacén donde ingresa la mercancía' })
  @IsNotEmpty()
  @IsUUID('4')
  warehouseId!: string;

  @ApiProperty({ description: 'ID del producto ingresado' })
  @IsNotEmpty()
  @IsUUID('4')
  productId!: string;

  @ApiProperty({
    description: 'Cantidad física positiva a ingresar',
    minimum: 1,
    example: 10,
  })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    description: 'ID del proveedor de procedencia (opcional)',
  })
  @IsOptional()
  @IsUUID('4')
  supplierId?: string;

  @ApiPropertyOptional({
    description: 'Motivo o justificación de la entrada',
    maxLength: 240,
  })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Referencia externa (ej. número de factura o remisión)',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalReference?: string;
}
