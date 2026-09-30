import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 2 })
  totalItems!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export type PaginatedResult<T> = {
  data: T[];
  meta: PaginationMetaDto;
};

export function createPaginatedResult<T>(
  items: T[],
  totalItems: number,
  page = 1,
  pageSize = 20,
): PaginatedResult<T> {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

  return {
    data: items,
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  };
}
