import {
  type ArgumentMetadata,
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ParseUuidParamPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    const paramName = metadata.data ?? 'id';
    const trimmed = typeof value === 'string' ? value.trim() : '';

    if (!UUID_PATTERN.test(trimmed)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `El parámetro ${paramName} debe ser un UUID válido.`,
        details: {
          fields: {
            [paramName]: ['INVALID_UUID'],
          },
        },
      });
    }

    return trimmed;
  }
}
