import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AttachSupplierDto {
  @ApiProperty({
    example: '320e4bbf-cf97-4f6c-827b-fb80df8f0ad5',
    description: 'ID del proveedor a asociar con el producto.',
  })
  @IsUUID('4', { message: 'supplierId debe ser un UUID v4 válido.' })
  supplierId!: string;
}

export class ProductSupplierItemDto {
  @ApiProperty({ example: '320e4bbf-cf97-4f6c-827b-fb80df8f0ad5' })
  supplierId!: string;

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

export class ProductSupplierListEnvelopeDto {
  @ApiProperty({ type: [ProductSupplierItemDto] })
  data!: ProductSupplierItemDto[];

  @ApiProperty({ example: '6ad489b4-ecc0-48cf-98e1-c5455f7d2963' })
  requestId!: string;
}
