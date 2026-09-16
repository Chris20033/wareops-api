import { Controller, Get } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../../common/errors/api-error-response.dto.js';
import {
  LiveHealthResponseDto,
  ReadyHealthResponseDto,
} from './dto/health-response.dto.js';
import { HealthService } from './health.service.js';

@ApiTags('Health')
@ApiHeader({
  name: 'X-Request-Id',
  required: false,
  description: 'UUID opcional para correlación de la solicitud.',
  schema: { type: 'string', format: 'uuid' },
})
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: 'Comprueba que el proceso de la API está activo' })
  @ApiOkResponse({ type: LiveHealthResponseDto })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Comprueba la disponibilidad de dependencias esenciales',
  })
  @ApiOkResponse({ type: ReadyHealthResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorResponseDto })
  ready(): Promise<{
    status: 'ok';
    dependencies: { postgres: 'up' };
  }> {
    return this.healthService.checkReadiness();
  }
}
