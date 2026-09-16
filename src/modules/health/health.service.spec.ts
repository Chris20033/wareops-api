import { ServiceUnavailableException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { DatabaseClientFactory } from '../../database/database-client.factory.js';
import { HealthService } from './health.service.js';

type HealthClient = Pick<
  PrismaClient,
  '$connect' | '$disconnect' | '$transaction'
>;

function createService(client: HealthClient): HealthService {
  const factory = {
    create: jest.fn(() => client as PrismaClient),
  } as unknown as DatabaseClientFactory;

  return new HealthService(factory);
}

describe('HealthService', () => {
  it('reports PostgreSQL as available after a Prisma connection', async () => {
    const client: HealthClient = {
      $connect: jest.fn().mockResolvedValue(undefined),
      $transaction: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };

    await expect(createService(client).checkReadiness()).resolves.toEqual({
      status: 'ok',
      dependencies: { postgres: 'up' },
    });
    expect(client.$disconnect).toHaveBeenCalledTimes(1);
  });

  it('returns the documented dependency error without leaking a cause', async () => {
    const client: HealthClient = {
      $connect: jest.fn().mockRejectedValue(new Error('password=secret')),
      $transaction: jest.fn().mockResolvedValue(undefined),
      $disconnect: jest.fn().mockResolvedValue(undefined),
    };

    await expect(createService(client).checkReadiness()).rejects.toMatchObject({
      constructor: ServiceUnavailableException,
      response: {
        code: 'DEPENDENCY_UNAVAILABLE',
        details: { postgres: 'down' },
      },
    });
  });
});
