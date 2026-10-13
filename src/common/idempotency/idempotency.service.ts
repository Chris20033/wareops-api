import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';

export function canonicalizeJson(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    if (obj[k] !== undefined) {
      result[k] = canonicalizeJson(obj[k]);
    }
  }
  return result;
}

export function computeRequestHash(
  method: string,
  route: string,
  organizationId: string,
  body: unknown,
): string {
  const canonicalBody = JSON.stringify(canonicalizeJson(body) ?? {});
  const payload = `${method.toUpperCase()}:${route}:${organizationId}:${canonicalBody}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

@Injectable()
export class IdempotencyService {
  computeHash(
    method: string,
    route: string,
    organizationId: string,
    body: unknown,
  ): string {
    return computeRequestHash(method, route, organizationId, body);
  }

  async findRecord(
    client: PrismaClient | Prisma.TransactionClient,
    organizationId: string,
    key: string,
  ) {
    return client.idempotencyRecord.findUnique({
      where: {
        organizationId_key: {
          organizationId,
          key,
        },
      },
    });
  }

  validateHash(existingHash: string, currentHash: string): void {
    if (existingHash !== currentHash) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message:
          'La clave de idempotencia ya fue utilizada con una carga diferente.',
      });
    }
  }

  async saveRecord(
    tx: Prisma.TransactionClient,
    params: {
      organizationId: string;
      key: string;
      requestHash: string;
      method: string;
      route: string;
      responseStatus: number;
      responseBody: unknown;
      resourceType?: string;
      resourceId?: string;
    },
  ) {
    return tx.idempotencyRecord.create({
      data: {
        organizationId: params.organizationId,
        key: params.key,
        requestHash: params.requestHash,
        method: params.method,
        route: params.route,
        responseStatus: params.responseStatus,
        responseBody: params.responseBody as Prisma.InputJsonValue,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
      },
    });
  }
}
