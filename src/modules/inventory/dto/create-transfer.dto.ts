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

export class CreateTransferDto {
  @ApiProperty({ description: 'ID del producto a transferir' })
  @IsNotEmpty({ message: 'El ID del producto es obligatorio' })
  @IsUUID('4', { message: 'El ID del producto debe ser un UUID v4 válido' })
  productId!: string;

  @ApiProperty({ description: 'ID del almacén origen' })
  @IsNotEmpty({ message: 'El ID del almacén origen es obligatorio' })
  @IsUUID('4', {
    message: 'El ID del almacén origen debe ser un UUID v4 válido',
  })
  sourceWarehouseId!: string;

  @ApiProperty({ description: 'ID del almacén destino' })
  @IsNotEmpty({ message: 'El ID del almacén destino es obligatorio' })
  @IsUUID('4', {
    message: 'El ID del almacén destino debe ser un UUID v4 válido',
  })
  destinationWarehouseId!: string;

  @ApiProperty({
    description: 'Cantidad física positiva a transferir',
    minimum: 1,
    example: 5,
  })
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, {
    message: 'La cantidad debe ser un entero positivo mayor o igual a 1',
  })
  quantity!: number;

  @ApiProperty({
    description: 'Motivo o justificación de la transferencia',
    maxLength: 240,
    example: 'Reabastecimiento de sucursal centro',
  })
  @IsNotEmpty({ message: 'El motivo es obligatorio en una transferencia' })
  @IsString()
  @MaxLength(240, { message: 'El motivo no puede exceder 240 caracteres' })
  reason!: string;

  @ApiPropertyOptional({
    description: 'Referencia externa opcional (ej. guía de traslado)',
    maxLength: 120,
    example: 'GUIA-TRF-2026-001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120, {
    message: 'La referencia externa no puede exceder 120 caracteres',
  })
  externalReference?: string;
}
