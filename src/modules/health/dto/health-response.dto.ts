import { ApiProperty } from '@nestjs/swagger';

export class LiveHealthDataDto {
  @ApiProperty({ example: 'ok', enum: ['ok'] })
  status!: 'ok';
}

export class ReadyDependenciesDto {
  @ApiProperty({ example: 'up', enum: ['up'] })
  postgres!: 'up';
}

export class ReadyHealthDataDto extends LiveHealthDataDto {
  @ApiProperty({ type: ReadyDependenciesDto })
  dependencies!: ReadyDependenciesDto;
}

export class LiveHealthResponseDto {
  @ApiProperty({ type: LiveHealthDataDto })
  data!: LiveHealthDataDto;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;
}

export class ReadyHealthResponseDto {
  @ApiProperty({ type: ReadyHealthDataDto })
  data!: ReadyHealthDataDto;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;
}
