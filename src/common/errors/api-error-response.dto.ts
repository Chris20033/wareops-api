import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorResponseDto {
  @ApiProperty({ example: 503 })
  statusCode!: number;

  @ApiProperty({ example: 'DEPENDENCY_UNAVAILABLE' })
  code!: string;

  @ApiProperty({ example: 'Una dependencia esencial no está disponible.' })
  message!: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { postgres: 'down' },
  })
  details?: Record<string, unknown>;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;
}
