import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';

export class UpdateMinimumStockDto {
  @ApiProperty({
    description: 'Nivel mínimo de existencia para alertas (entero >= 0)',
    minimum: 0,
    example: 10,
  })
  @IsInt()
  @Min(0)
  minimumStock!: number;
}

export class ConfigureMinimumStockDto {
  @ApiProperty({ description: 'ID del almacén' })
  @IsNotEmpty()
  @IsUUID('4')
  warehouseId!: string;

  @ApiProperty({ description: 'ID del producto' })
  @IsNotEmpty()
  @IsUUID('4')
  productId!: string;

  @ApiProperty({
    description: 'Nivel mínimo de existencia para alertas (entero >= 0)',
    minimum: 0,
    example: 10,
  })
  @IsInt()
  @Min(0)
  minimumStock!: number;
}
