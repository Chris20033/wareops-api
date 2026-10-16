import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';

export function IsNotZero(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotZero',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'number' && value !== 0;
        },
        defaultMessage() {
          return 'El delta de ajuste no puede ser cero.';
        },
      },
    });
  };
}

export class InventoryAdjustmentDto {
  @ApiProperty({ description: 'ID del almacén' })
  @IsNotEmpty()
  @IsUUID('4')
  warehouseId!: string;

  @ApiProperty({ description: 'ID del producto' })
  @IsNotEmpty()
  @IsUUID('4')
  productId!: string;

  @ApiProperty({
    description:
      'Delta de ajuste físico (positivo o negativo, distinto de cero)',
    example: -3,
  })
  @IsInt()
  @IsNotZero()
  delta!: number;

  @ApiProperty({
    description: 'Motivo obligatorio del ajuste de inventario',
    maxLength: 240,
    example: 'Avería detectada en conteo físico cíclico',
  })
  @IsNotEmpty({
    message: 'El motivo es obligatorio en un ajuste de inventario',
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
