import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseClientFactory } from '../../database/database-client.factory.js';

@Injectable()
export class HealthService {
  private static readonly readinessTimeoutMs = 1_500;

  constructor(private readonly databaseClientFactory: DatabaseClientFactory) {}

  async checkReadiness(): Promise<{
    status: 'ok';
    dependencies: { postgres: 'up' };
  }> {
    const client = this.databaseClientFactory.create(
      HealthService.readinessTimeoutMs,
    );
    let timeout: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        (async () => {
          await client.$connect();
          await client.$transaction(() => Promise.resolve(), {
            maxWait: HealthService.readinessTimeoutMs,
            timeout: HealthService.readinessTimeoutMs,
          });
        })(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Database readiness check timed out')),
            HealthService.readinessTimeoutMs,
          );
        }),
      ]);

      return {
        status: 'ok',
        dependencies: { postgres: 'up' },
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Una dependencia esencial no está disponible.',
        details: { postgres: 'down' },
      });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
      await client.$disconnect().catch(() => undefined);
    }
  }
}
