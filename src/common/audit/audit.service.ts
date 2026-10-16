import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';

export type FieldChange = {
  field: string;
  oldValue?: string | number | null;
  newValue?: string | number | null;
};

const REDACTED_FIELDS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'token',
  'tokenhash',
  'token_hash',
  'cookie',
  'secret',
]);

@Injectable()
export class AuditService {
  async recordEvent(
    tx: Prisma.TransactionClient,
    params: {
      organizationId: string;
      actorUserId?: string | null;
      action: string;
      entityType: string;
      entityId?: string | null;
      requestId: string;
      changes?: FieldChange[];
    },
  ) {
    const validChanges = (params.changes ?? [])
      .filter((c) => !REDACTED_FIELDS.has(c.field.toLowerCase()))
      .map((c) => ({
        field: c.field,
        oldValue: c.oldValue != null ? String(c.oldValue) : null,
        newValue: c.newValue != null ? String(c.newValue) : null,
      }));

    return tx.auditEvent.create({
      data: {
        organizationId: params.organizationId,
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        requestId: params.requestId,
        changes:
          validChanges.length > 0
            ? {
                create: validChanges,
              }
            : undefined,
      },
      include: {
        changes: true,
      },
    });
  }
}
