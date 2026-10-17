import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.setup.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { DatabaseClientFactory } from '../src/database/database-client.factory.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { runSeed } from '../prisma/seed.js';

type TestTransferItem = {
  id: string;
  operationId: string;
  sourceBalanceId: string;
  destinationBalanceId: string;
  quantity: number;
  product: { id: string; sku: string; name: string };
  sourceWarehouse: { id: string; code: string; name: string };
  destinationWarehouse: { id: string; code: string; name: string };
  sourceMovement?: { onHandDelta: number } | null;
  destinationMovement?: { onHandDelta: number } | null;
  movements: Array<{ id: string; onHandDelta: number; warehouseId: string }>;
};

describe('Sprint 04 — Transfers (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const runId = Date.now().toString(36);

  let ownerToken: string;
  let ownerOrgId: string;

  let operatorToken: string;
  let viewerToken: string;

  let surOwnerToken: string;
  let surOrgId: string;

  let warehouseMty01Id: string;
  let warehouseMty02Id: string;
  let prodA01Id: string;
  let prodSur01Id: string;

  beforeAll(async () => {
    const testDatabaseUrl =
      process.env.TEST_DATABASE_URL ??
      (!process.env.DATABASE_URL ||
      process.env.DATABASE_URL.includes('127.0.0.1:1/')
        ? 'postgresql://wareops:wareops_local@localhost:5432/wareops'
        : process.env.DATABASE_URL);

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseClientFactory)
      .useValue({
        create: (connectionTimeoutMillis = 5_000) => {
          const adapter = new PrismaPg({
            connectionString: testDatabaseUrl,
            connectionTimeoutMillis,
          });
          return new PrismaClient({ adapter });
        },
      })
      .compile();

    app = moduleFixture.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();

    prisma = app.get(PrismaService);
    await runSeed(prisma.client);

    // Login Owner Norte
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner@wareops.local',
        password: 'WareOpsDemo!2026',
      });
    expect(ownerLogin.status).toBe(200);
    ownerToken = ownerLogin.body.data.accessToken;
    ownerOrgId = ownerLogin.body.data.organizations[0].organizationId;

    // Login Operator Norte
    const operatorLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'operator@wareops.local',
        password: 'WareOpsDemo!2026',
      });
    expect(operatorLogin.status).toBe(200);
    operatorToken = operatorLogin.body.data.accessToken;

    // Login Viewer Norte
    const viewerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'viewer@wareops.local',
        password: 'WareOpsDemo!2026',
      });
    expect(viewerLogin.status).toBe(200);
    viewerToken = viewerLogin.body.data.accessToken;

    // Login Owner Sur
    const surLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner.sur@wareops.local',
        password: 'WareOpsDemo!2026',
      });
    expect(surLogin.status).toBe(200);
    surOwnerToken = surLogin.body.data.accessToken;
    surOrgId = surLogin.body.data.organizations[0].organizationId;

    // Resolve entities
    const whMty01 = await prisma.client.warehouse.findFirstOrThrow({
      where: { code: 'ALM-MTY-01' },
      select: { id: true },
    });
    warehouseMty01Id = whMty01.id;

    const whMty02 = await prisma.client.warehouse.findFirstOrThrow({
      where: { code: 'ALM-MTY-02' },
      select: { id: true },
    });
    warehouseMty02Id = whMty02.id;

    const pA01 = await prisma.client.product.findFirstOrThrow({
      where: { sku: 'PROD-A01' },
      select: { id: true },
    });
    prodA01Id = pA01.id;

    const pSur01 = await prisma.client.product.findFirstOrThrow({
      where: { sku: 'PROD-S01' },
      select: { id: true },
    });
    prodSur01Id = pSur01.id;

    // Ensure known initial balance for Mty01 with ProdA01
    await prisma.client.inventoryBalance.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: warehouseMty01Id,
          productId: prodA01Id,
        },
      },
      update: {
        onHand: 100,
        reserved: 0,
        minimumStock: 20,
      },
      create: {
        warehouseId: warehouseMty01Id,
        productId: prodA01Id,
        onHand: 100,
        reserved: 0,
        minimumStock: 20,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Validation & Edge Cases (POST /api/v1/inventory/transfers)', () => {
    it('rejects transfer when source and destination warehouse are identical with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', `trf-same-${runId}`)
        .send({
          productId: prodA01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: warehouseMty01Id,
          quantity: 5,
          reason: 'Intento con mismo origen y destino',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects transfer with quantity <= 0 with 400 VALIDATION_ERROR', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', `trf-zero-qty-${runId}`)
        .send({
          productId: prodA01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: warehouseMty02Id,
          quantity: 0,
          reason: 'Intento con cantidad cero',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects transfer without mandatory reason with 400 VALIDATION_ERROR', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', `trf-no-reason-${runId}`)
        .send({
          productId: prodA01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: warehouseMty02Id,
          quantity: 5,
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects transfer without Idempotency-Key header with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          productId: prodA01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: warehouseMty02Id,
          quantity: 5,
          reason: 'Sin clave de idempotencia',
        });

      expect(response.status).toBe(400);
    });

    it('rejects transfer when destination warehouse belongs to another tenant with 404', async () => {
      // Create a warehouse in Sur
      const surBranch = await prisma.client.branch.findFirstOrThrow({
        where: { organizationId: surOrgId },
        select: { id: true },
      });

      const surWarehouse = await prisma.client.warehouse.create({
        data: {
          branchId: surBranch.id,
          code: `ALM-SUR-${runId}`,
          name: 'Almacén Sur Foráneo',
          isActive: true,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', `trf-cross-dest-${runId}`)
        .send({
          productId: prodA01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: surWarehouse.id,
          quantity: 5,
          reason: 'Intento de transferencia entre organizaciones',
        });

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('rejects transfer when product belongs to another tenant with 404', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', `trf-cross-prod-${runId}`)
        .send({
          productId: prodSur01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: warehouseMty02Id,
          quantity: 5,
          reason: 'Intento con producto foráneo',
        });

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('rejects transfer when destination warehouse is inactive with 404', async () => {
      const mtyBranch = await prisma.client.branch.findFirstOrThrow({
        where: { organizationId: ownerOrgId },
        select: { id: true },
      });

      const inactiveWh = await prisma.client.warehouse.create({
        data: {
          branchId: mtyBranch.id,
          code: `ALM-INACT-${runId}`,
          name: 'Almacén Inactivo Temporal',
          isActive: false,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', `trf-inactive-dest-${runId}`)
        .send({
          productId: prodA01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: inactiveWh.id,
          quantity: 5,
          reason: 'Intento a almacén inactivo',
        });

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('rejects transfer exceeding available stock in source warehouse with 409 INSUFFICIENT_STOCK', async () => {
      const sourceBalBefore =
        await prisma.client.inventoryBalance.findUniqueOrThrow({
          where: {
            warehouseId_productId: {
              warehouseId: warehouseMty01Id,
              productId: prodA01Id,
            },
          },
        });

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', `trf-excess-${runId}`)
        .send({
          productId: prodA01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: warehouseMty02Id,
          quantity: sourceBalBefore.onHand + 500,
          reason: 'Intento que supera el stock disponible',
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('INSUFFICIENT_STOCK');

      // Verify balance was not modified
      const sourceBalAfter =
        await prisma.client.inventoryBalance.findUniqueOrThrow({
          where: {
            warehouseId_productId: {
              warehouseId: warehouseMty01Id,
              productId: prodA01Id,
            },
          },
        });
      expect(sourceBalAfter.onHand).toBe(sourceBalBefore.onHand);
    });
  });

  describe('Successful Transfer & All-or-Nothing Consistency (CA-007, CA-008)', () => {
    it('executes transfer decreasing source and increasing destination, creating 2 movements and audit', async () => {
      const idempotencyKey = `trf-success-${runId}`;

      const sourceBalBefore =
        await prisma.client.inventoryBalance.findUniqueOrThrow({
          where: {
            warehouseId_productId: {
              warehouseId: warehouseMty01Id,
              productId: prodA01Id,
            },
          },
        });

      const destBalBefore = await prisma.client.inventoryBalance.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: warehouseMty02Id,
            productId: prodA01Id,
          },
        },
      });
      const destOnHandBefore = destBalBefore?.onHand ?? 0;

      const transferQty = 12;

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          productId: prodA01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: warehouseMty02Id,
          quantity: transferQty,
          reason: 'Reubicación planificada de inventario a cámara fría',
          externalReference: `TRF-REF-${runId}`,
        });

      expect(response.status).toBe(201);
      const data = response.body.data as TestTransferItem;
      expect(data.id).toBeDefined();

      expect(data.quantity).toBe(transferQty);
      expect(data.product.id).toBe(prodA01Id);
      expect(data.sourceWarehouse.id).toBe(warehouseMty01Id);
      expect(data.destinationWarehouse.id).toBe(warehouseMty02Id);

      // Verify source and destination movements
      expect(data.movements).toHaveLength(2);
      const sourceMov = data.movements.find(
        (m) => m.warehouseId === warehouseMty01Id,
      );
      const destMov = data.movements.find(
        (m) => m.warehouseId === warehouseMty02Id,
      );
      expect(sourceMov?.onHandDelta).toBe(-transferQty);
      expect(destMov?.onHandDelta).toBe(transferQty);

      // Verify database balances updated atomically
      const sourceBalAfter =
        await prisma.client.inventoryBalance.findUniqueOrThrow({
          where: {
            warehouseId_productId: {
              warehouseId: warehouseMty01Id,
              productId: prodA01Id,
            },
          },
        });
      expect(sourceBalAfter.onHand).toBe(sourceBalBefore.onHand - transferQty);

      const destBalAfter =
        await prisma.client.inventoryBalance.findUniqueOrThrow({
          where: {
            warehouseId_productId: {
              warehouseId: warehouseMty02Id,
              productId: prodA01Id,
            },
          },
        });
      expect(destBalAfter.onHand).toBe(destOnHandBefore + transferQty);

      // Verify Audit event
      const auditEvent = await prisma.client.auditEvent.findFirst({
        where: {
          entityType: 'Transfer',
          entityId: data.id,
        },
        include: { changes: true },
      });
      expect(auditEvent).toBeDefined();
      expect(auditEvent?.action).toBe('inventory.transfer');
    });

    it('automatically initializes destination balance if it did not exist before transfer', async () => {
      // Create a brand new warehouse in Monterrey
      const mtyBranch = await prisma.client.branch.findFirstOrThrow({
        where: { organizationId: ownerOrgId },
        select: { id: true },
      });

      const brandNewWh = await prisma.client.warehouse.create({
        data: {
          branchId: mtyBranch.id,
          code: `ALM-NEW-${runId}`,
          name: 'Almacén Recién Creado',
          isActive: true,
        },
      });

      // Verify balance does not exist yet
      const initialDestBal = await prisma.client.inventoryBalance.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: brandNewWh.id,
            productId: prodA01Id,
          },
        },
      });
      expect(initialDestBal).toBeNull();

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', `trf-autocreate-${runId}`)
        .send({
          productId: prodA01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: brandNewWh.id,
          quantity: 7,
          reason: 'Primer envío al nuevo almacén',
        });

      expect(response.status).toBe(201);
      const createdDestBal =
        await prisma.client.inventoryBalance.findUniqueOrThrow({
          where: {
            warehouseId_productId: {
              warehouseId: brandNewWh.id,
              productId: prodA01Id,
            },
          },
        });
      expect(createdDestBal.onHand).toBe(7);
      expect(createdDestBal.reserved).toBe(0);
    });

    it('returns cached response on idempotent retry with the same key and payload (CA-009)', async () => {
      const idempotencyKey = `trf-idemp-${runId}`;

      const firstRes = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          productId: prodA01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: warehouseMty02Id,
          quantity: 4,
          reason: 'Prueba de idempotencia inicial',
        });

      expect(firstRes.status).toBe(201);
      const transferId = firstRes.body.data.id;

      // Repeat with same key and payload
      const secondRes = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          productId: prodA01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: warehouseMty02Id,
          quantity: 4,
          reason: 'Prueba de idempotencia inicial',
        });

      expect(secondRes.status).toBe(201);
      expect(secondRes.body.data.id).toBe(transferId);
    });

    it('rejects reusing idempotency key with differing payload with 409 IDEMPOTENCY_KEY_REUSED', async () => {
      const idempotencyKey = `trf-conflict-key-${runId}`;

      await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          productId: prodA01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: warehouseMty02Id,
          quantity: 2,
          reason: 'Envío original',
        });

      const conflictRes = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          productId: prodA01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: warehouseMty02Id,
          quantity: 10, // Altered payload
          reason: 'Envío modificado con la misma clave',
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });
  });

  describe('Queries & Details (GET /api/v1/inventory/transfers)', () => {
    it('retrieves transfer detail with product, warehouses, operation and both movements', async () => {
      // Create transfer to query
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', `trf-detail-${runId}`)
        .send({
          productId: prodA01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: warehouseMty02Id,
          quantity: 3,
          reason: 'Transferencia para consultar detalle',
        });

      expect(createRes.status).toBe(201);
      const transferId = createRes.body.data.id;

      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/inventory/transfers/${transferId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(detailRes.status).toBe(200);
      const transfer = detailRes.body.data as TestTransferItem;
      expect(transfer.id).toBe(transferId);
      expect(transfer.quantity).toBe(3);
      expect(transfer.product.id).toBe(prodA01Id);
      expect(transfer.sourceWarehouse.id).toBe(warehouseMty01Id);
      expect(transfer.destinationWarehouse.id).toBe(warehouseMty02Id);
      expect(transfer.movements).toHaveLength(2);
      expect(transfer.sourceMovement?.onHandDelta).toBe(-3);
      expect(transfer.destinationMovement?.onHandDelta).toBe(3);
    });

    it('rejects cross-tenant access to transfer detail with 404', async () => {
      // Create transfer in Norte
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', `trf-cross-get-${runId}`)
        .send({
          productId: prodA01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: warehouseMty02Id,
          quantity: 1,
          reason: 'Transferencia Norte',
        });

      const transferId = createRes.body.data.id;

      // Attempt to access with Sur token
      const forbiddenRes = await request(app.getHttpServer())
        .get(`/api/v1/inventory/transfers/${transferId}`)
        .set('Authorization', `Bearer ${surOwnerToken}`)
        .set('X-Organization-Id', surOrgId);

      expect(forbiddenRes.status).toBe(404);
      expect(forbiddenRes.body.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('lists transfers with pagination and filters by product and warehouse', async () => {
      const listRes = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory/transfers?productId=${prodA01Id}&warehouseId=${warehouseMty01Id}&pageSize=10`,
        )
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toBeInstanceOf(Array);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(listRes.body.meta).toMatchObject({
        page: 1,
        pageSize: 10,
      });

      const transfers = listRes.body.data as TestTransferItem[];
      for (const t of transfers) {
        expect(t.product.id).toBe(prodA01Id);
        expect(
          t.sourceWarehouse.id === warehouseMty01Id ||
            t.destinationWarehouse.id === warehouseMty01Id,
        ).toBe(true);
      }
    });
  });

  describe('Concurrency & Serializable Isolation (ADR-003, RN-020, RN-021)', () => {
    it('handles concurrent transfers consistently without over-drafting source stock', async () => {
      // Create a dedicated product and balance with exactly 15 units
      const concProduct = await prisma.client.product.create({
        data: {
          organizationId: ownerOrgId,
          sku: `PROD-CONC-${runId}`,
          name: 'Producto Concurrencia Transferencias',
          isActive: true,
        },
      });

      await prisma.client.inventoryBalance.create({
        data: {
          warehouseId: warehouseMty01Id,
          productId: concProduct.id,
          onHand: 15,
          reserved: 0,
          minimumStock: 0,
        },
      });

      // Launch 5 concurrent transfer requests of 4 units each (5 * 4 = 20 > 15)
      // Exactly 3 should succeed (3 * 4 = 12 <= 15), and 2 must fail (remaining 3 < 4)
      const requests = Array.from({ length: 5 }, (_, idx) =>
        request(app.getHttpServer())
          .post('/api/v1/inventory/transfers')
          .set('Authorization', `Bearer ${operatorToken}`)
          .set('X-Organization-Id', ownerOrgId)
          .set('Idempotency-Key', `conc-trf-${runId}-${idx}`)
          .send({
            productId: concProduct.id,
            sourceWarehouseId: warehouseMty01Id,
            destinationWarehouseId: warehouseMty02Id,
            quantity: 4,
            reason: `Transferencia concurrente hilo ${idx}`,
          }),
      );

      const results = await Promise.all(requests);
      const succeeded = results.filter((r) => r.status === 201);
      const failed = results.filter((r) => r.status === 409);

      expect(succeeded.length).toBe(3);
      expect(failed.length).toBe(2);

      // Verify source balance has exactly 15 - (3 * 4) = 3 units
      const sourceBal = await prisma.client.inventoryBalance.findUniqueOrThrow({
        where: {
          warehouseId_productId: {
            warehouseId: warehouseMty01Id,
            productId: concProduct.id,
          },
        },
      });
      expect(sourceBal.onHand).toBe(3);

      // Verify destination balance has exactly 12 units
      const destBal = await prisma.client.inventoryBalance.findUniqueOrThrow({
        where: {
          warehouseId_productId: {
            warehouseId: warehouseMty02Id,
            productId: concProduct.id,
          },
        },
      });
      expect(destBal.onHand).toBe(12);
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('allows OPERATOR to perform transfers (inventory:write)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', `trf-rbac-op-${runId}`)
        .send({
          productId: prodA01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: warehouseMty02Id,
          quantity: 1,
          reason: 'Operador autorizado',
        });

      expect(response.status).toBe(201);
    });

    it('rejects VIEWER from performing transfers with 403 FORBIDDEN', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', `trf-rbac-view-${runId}`)
        .send({
          productId: prodA01Id,
          sourceWarehouseId: warehouseMty01Id,
          destinationWarehouseId: warehouseMty02Id,
          quantity: 1,
          reason: 'Intento de lector no autorizado',
        });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('PERMISSION_DENIED');
    });

    it('allows VIEWER to list and view transfers (inventory:read)', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/inventory/transfers')
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toBeInstanceOf(Array);
    });
  });
});
