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

type TestBalanceItem = {
  id: string;
  warehouse: { id: string; code: string; name: string };
  product: { id: string; sku: string; name: string };
  onHand: number;
  reserved: number;
  available: number;
  minimumStock: number;
  isBelowMinimum: boolean;
};

type TestMovementItem = {
  id: string;
  onHandDelta: number;
  operation: { type: string; reason?: string | null };
  balance: { id: string; productId: string };
};

describe('Sprint 03 — Inventory Core and Platform Models (e2e)', () => {
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
  let warehouseCdmx01Id: string;
  let prodA01Id: string;
  let prodC03Id: string;
  let prodSur01Id: string;
  let supplierAcmeId: string;

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

    // Resolve entities from seed
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

    const whCdmx01 = await prisma.client.warehouse.findFirstOrThrow({
      where: { code: 'ALM-CDMX-01' },
      select: { id: true },
    });
    warehouseCdmx01Id = whCdmx01.id;

    const pA01 = await prisma.client.product.findFirstOrThrow({
      where: { sku: 'PROD-A01' },
      select: { id: true },
    });
    prodA01Id = pA01.id;

    const pC03 = await prisma.client.product.findFirstOrThrow({
      where: { sku: 'PROD-C03' },
      select: { id: true },
    });
    prodC03Id = pC03.id;

    const pSur01 = await prisma.client.product.findFirstOrThrow({
      where: { sku: 'PROD-S01' },
      select: { id: true },
    });
    prodSur01Id = pSur01.id;

    const supAcme = await prisma.client.supplier.findFirstOrThrow({
      where: { code: 'PROV-ACME-01' },
      select: { id: true },
    });
    supplierAcmeId = supAcme.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Inventory Balances & Queries (GET /api/v1/inventory)', () => {
    it('lists inventory balances with calculated available and alert status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      expect(response.body.meta).toMatchObject({
        page: 1,
        pageSize: 20,
      });

      const balances = response.body.data as TestBalanceItem[];

      const prodA = balances.find((b) => b.product.sku === 'PROD-A01');
      expect(prodA).toBeDefined();
      expect(prodA?.onHand).toBeGreaterThanOrEqual(50);
      expect(prodA?.reserved).toBe(0);
      expect(prodA?.available).toBe(
        (prodA?.onHand ?? 0) - (prodA?.reserved ?? 0),
      );
      expect(prodA?.minimumStock).toBeGreaterThanOrEqual(10);
      expect(prodA?.isBelowMinimum).toBe(false);

      const prodB = balances.find((b) => b.product.sku === 'PROD-B02');
      expect(prodB).toBeDefined();
      expect(prodB?.onHand).toBe(8);
      expect(prodB?.reserved).toBe(0);
      expect(prodB?.available).toBe(8);
      expect(prodB?.minimumStock).toBe(15);
      expect(prodB?.isBelowMinimum).toBe(true);
    });

    it('filters balances by alertOnly=true returning only items at or below minimumStock', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/inventory?alertOnly=true')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);

      const balances = response.body.data as TestBalanceItem[];
      expect(balances.every((b) => b.isBelowMinimum === true)).toBe(true);
      expect(balances.some((b) => b.product.sku === 'PROD-B02')).toBe(true);
    });

    it('filters balances by warehouseId and productId', async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory?warehouseId=${warehouseCdmx01Id}&productId=${prodA01Id}`,
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].warehouse.id).toBe(warehouseCdmx01Id);
      expect(response.body.data[0].product.id).toBe(prodA01Id);
    });

    it('filters balances by text search (matching sku or product name)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/inventory?search=PROD-A01')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].product.sku).toBe('PROD-A01');
    });

    it('retrieves single balance by ID', async () => {
      const listRes = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory?warehouseId=${warehouseCdmx01Id}&productId=${prodA01Id}`,
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      const balanceId = listRes.body.data[0].id;

      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/inventory/${balanceId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.id).toBe(balanceId);
      expect(detailRes.body.data.available).toBe(50);
    });

    it('rejects cross-tenant access to balance with 404', async () => {
      const listRes = await request(app.getHttpServer())
        .get(
          `/api/v1/inventory?warehouseId=${warehouseCdmx01Id}&productId=${prodA01Id}`,
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      const balanceId = listRes.body.data[0].id;

      // Access with Sur Org
      const crossRes = await request(app.getHttpServer())
        .get(`/api/v1/inventory/${balanceId}`)
        .set('Authorization', `Bearer ${surOwnerToken}`)
        .set('X-Organization-Id', surOrgId);

      expect(crossRes.status).toBe(404);
    });
  });

  describe('Inventory Entries (POST /api/v1/inventory/entries)', () => {
    it('registers an entry increasing onHand, creating operation, movement, and audit', async () => {
      const idempotencyKey = `entry-${runId}-1`;

      const balanceBefore =
        await prisma.client.inventoryBalance.findUniqueOrThrow({
          where: {
            warehouseId_productId: {
              warehouseId: warehouseCdmx01Id,
              productId: prodA01Id,
            },
          },
        });

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/entries')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          warehouseId: warehouseCdmx01Id,
          productId: prodA01Id,
          supplierId: supplierAcmeId,
          quantity: 10,
          reason: 'Recepcion de compra PO-2026-001',
          externalReference: 'FAC-99120',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.onHandDelta).toBe(10);
      expect(response.body.data.operation.type).toBe('ENTRY');
      expect(response.body.data.operation.supplier.id).toBe(supplierAcmeId);
      expect(response.body.data.balance.onHand).toBe(balanceBefore.onHand + 10);
      expect(response.body.data.balance.available).toBe(
        balanceBefore.onHand + 10 - balanceBefore.reserved,
      );

      // Verify audit event persisted
      const audit = await prisma.client.auditEvent.findFirst({
        where: {
          organizationId: ownerOrgId,
          action: 'inventory.entry',
          entityId: response.body.data.balance.id,
        },
        include: { changes: true },
      });
      expect(audit).toBeDefined();
      expect(audit?.changes.length).toBeGreaterThan(0);
    });

    it('returns identical cached response on idempotent retry with same key', async () => {
      const idempotencyKey = `entry-idem-${runId}`;
      const payload = {
        warehouseId: warehouseCdmx01Id,
        productId: prodA01Id,
        quantity: 5,
        reason: 'Prueba de idempotencia inicial',
      };

      const firstRes = await request(app.getHttpServer())
        .post('/api/v1/inventory/entries')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(firstRes.status).toBe(201);
      const balanceAfterFirst = firstRes.body.data.balance.onHand;

      // Second call with same idempotency key and same payload
      const secondRes = await request(app.getHttpServer())
        .post('/api/v1/inventory/entries')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(secondRes.status).toBe(201);
      expect(secondRes.body.data).toEqual(firstRes.body.data);

      // Verify onHand did NOT double increment
      const balanceCheck = await prisma.client.inventoryBalance.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: warehouseCdmx01Id,
            productId: prodA01Id,
          },
        },
      });
      expect(balanceCheck?.onHand).toBe(balanceAfterFirst);
    });

    it('rejects reusing idempotency key with differing payload with 409 IDEMPOTENCY_KEY_REUSED', async () => {
      const idempotencyKey = `entry-idem-conflict-${runId}`;

      const firstRes = await request(app.getHttpServer())
        .post('/api/v1/inventory/entries')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          warehouseId: warehouseCdmx01Id,
          productId: prodA01Id,
          quantity: 2,
          reason: 'Primer payload',
        });

      expect(firstRes.status).toBe(201);

      // Differing quantity
      const conflictRes = await request(app.getHttpServer())
        .post('/api/v1/inventory/entries')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          warehouseId: warehouseCdmx01Id,
          productId: prodA01Id,
          quantity: 4,
          reason: 'Segundo payload diferente',
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('rejects entry without Idempotency-Key header with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/entries')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          warehouseId: warehouseCdmx01Id,
          productId: prodA01Id,
          quantity: 5,
        });

      expect(response.status).toBe(400);
      expect(['VALIDATION_ERROR', 'MISSING_IDEMPOTENCY_KEY']).toContain(
        response.body.code,
      );
    });

    it('automatically initializes balance when entering product into new warehouse', async () => {
      // Create a fresh product so there is no existing balance in any warehouse
      const freshProdRes = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          sku: `PROD-NEW-${runId.toUpperCase()}`,
          name: `Producto Nuevo ${runId}`,
        });
      expect(freshProdRes.status).toBe(201);
      const newProdId = freshProdRes.body.data.id;

      const idempotencyKey = `entry-new-prod-${runId}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/entries')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          warehouseId: warehouseMty02Id,
          productId: newProdId,
          quantity: 25,
          reason: 'Stock inicial para bodega Mty02',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.onHandDelta).toBe(25);
      expect(response.body.data.balance.onHand).toBe(25);
      expect(response.body.data.balance.reserved).toBe(0);
      expect(response.body.data.balance.available).toBe(25);
    });

    it('rejects entry for warehouse or product belonging to another tenant with 404', async () => {
      const idempotencyKey = `entry-cross-${runId}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/entries')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          warehouseId: warehouseMty01Id,
          productId: prodSur01Id, // Belongs to Org Sur
          quantity: 10,
        });

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('RESOURCE_NOT_FOUND');
    });
  });

  describe('Inventory Exits (POST /api/v1/inventory/exits)', () => {
    it('registers an exit decreasing onHand and creating movement and audit', async () => {
      const idempotencyKey = `exit-${runId}-1`;

      const currentBalance =
        await prisma.client.inventoryBalance.findUniqueOrThrow({
          where: {
            warehouseId_productId: {
              warehouseId: warehouseMty02Id,
              productId: prodC03Id,
            },
          },
        });

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/exits')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          warehouseId: warehouseMty02Id,
          productId: prodC03Id,
          quantity: 5,
          reason: 'Despacho local a taller',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.operation.type).toBe('EXIT');
      expect(response.body.data.onHandDelta).toBe(-5);
      expect(response.body.data.balance.onHand).toBe(currentBalance.onHand - 5);
    });

    it('rejects exit without mandatory reason with 400 VALIDATION_ERROR', async () => {
      const idempotencyKey = `exit-no-reason-${runId}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/exits')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          warehouseId: warehouseMty02Id,
          productId: prodC03Id,
          quantity: 2,
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects exit exceeding available stock with 409 INSUFFICIENT_STOCK leaving balances unchanged', async () => {
      const idempotencyKey = `exit-exceed-${runId}`;

      const balanceBefore =
        await prisma.client.inventoryBalance.findUniqueOrThrow({
          where: {
            warehouseId_productId: {
              warehouseId: warehouseMty02Id,
              productId: prodC03Id,
            },
          },
        });

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/exits')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          warehouseId: warehouseMty02Id,
          productId: prodC03Id,
          quantity: balanceBefore.onHand + 100,
          reason: 'Intento de salida sin stock',
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('INSUFFICIENT_STOCK');

      // Verify balance did not change
      const balanceAfter =
        await prisma.client.inventoryBalance.findUniqueOrThrow({
          where: {
            warehouseId_productId: {
              warehouseId: warehouseMty02Id,
              productId: prodC03Id,
            },
          },
        });
      expect(balanceAfter.onHand).toBe(balanceBefore.onHand);
    });
  });

  describe('Inventory Adjustments (POST /api/v1/inventory/adjustments)', () => {
    it('applies positive adjustment increasing stock', async () => {
      const idempotencyKey = `adj-pos-${runId}`;

      const balanceBefore =
        await prisma.client.inventoryBalance.findUniqueOrThrow({
          where: {
            warehouseId_productId: {
              warehouseId: warehouseMty02Id,
              productId: prodC03Id,
            },
          },
        });

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/adjustments')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          warehouseId: warehouseMty02Id,
          productId: prodC03Id,
          delta: 3,
          reason: 'Conteo ciclico: sobrante de 3 piezas',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.operation.type).toBe('ADJUSTMENT');
      expect(response.body.data.onHandDelta).toBe(3);
      expect(response.body.data.balance.onHand).toBe(balanceBefore.onHand + 3);
    });

    it('applies negative adjustment decreasing stock', async () => {
      const idempotencyKey = `adj-neg-${runId}`;

      const balanceBefore =
        await prisma.client.inventoryBalance.findUniqueOrThrow({
          where: {
            warehouseId_productId: {
              warehouseId: warehouseMty02Id,
              productId: prodC03Id,
            },
          },
        });

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/adjustments')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          warehouseId: warehouseMty02Id,
          productId: prodC03Id,
          delta: -2,
          reason: 'Merma por embalaje danado',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.onHandDelta).toBe(-2);
      expect(response.body.data.balance.onHand).toBe(balanceBefore.onHand - 2);
    });

    it('rejects adjustment with delta = 0 with 400 VALIDATION_ERROR', async () => {
      const idempotencyKey = `adj-zero-${runId}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/adjustments')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          warehouseId: warehouseMty02Id,
          productId: prodC03Id,
          delta: 0,
          reason: 'Ajuste en cero no permitido',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects adjustment without reason with 400 VALIDATION_ERROR', async () => {
      const idempotencyKey = `adj-noreason-${runId}`;

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/adjustments')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          warehouseId: warehouseMty02Id,
          productId: prodC03Id,
          delta: 5,
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('rejects negative adjustment exceeding available stock with 409 INSUFFICIENT_STOCK', async () => {
      const idempotencyKey = `adj-excess-${runId}`;

      const balanceBefore =
        await prisma.client.inventoryBalance.findUniqueOrThrow({
          where: {
            warehouseId_productId: {
              warehouseId: warehouseMty02Id,
              productId: prodC03Id,
            },
          },
        });

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/adjustments')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          warehouseId: warehouseMty02Id,
          productId: prodC03Id,
          delta: -(balanceBefore.onHand + 50),
          reason: 'Intento de merma excesiva',
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('INSUFFICIENT_STOCK');
    });
  });

  describe('Minimum Stock Configuration & Alerts', () => {
    it('configures minimum stock via PATCH /api/v1/inventory/minimum-stock and updates alert flag', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventory/minimum-stock')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          warehouseId: warehouseMty02Id,
          productId: prodC03Id,
          minimumStock: 100, // higher than available stock, triggers alert
        });

      expect(response.status).toBe(200);
      expect(response.body.data.minimumStock).toBe(100);
      expect(response.body.data.isBelowMinimum).toBe(true);

      // Verify that alertOnly=true lists it
      const alertRes = await request(app.getHttpServer())
        .get(`/api/v1/inventory?warehouseId=${warehouseMty02Id}&alertOnly=true`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(alertRes.status).toBe(200);
      const alertBalances = alertRes.body.data as TestBalanceItem[];
      expect(alertBalances.some((b) => b.product.id === prodC03Id)).toBe(true);
    });

    it('updates minimum stock via PATCH /api/v1/inventory/:id/minimum-stock', async () => {
      const current = await prisma.client.inventoryBalance.findUniqueOrThrow({
        where: {
          warehouseId_productId: {
            warehouseId: warehouseMty02Id,
            productId: prodC03Id,
          },
        },
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/inventory/${current.id}/minimum-stock`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          minimumStock: 5,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.minimumStock).toBe(5);
      expect(response.body.data.isBelowMinimum).toBe(false);
    });
  });

  describe('Movements Kardex (GET /api/v1/movements)', () => {
    it('lists movements with pagination, product and warehouse details, and actor', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/movements')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.meta).toMatchObject({
        page: 1,
        pageSize: 20,
      });

      const item = response.body.data[0];
      expect(item.id).toBeDefined();
      expect(item.onHandDelta).toBeDefined();
      expect(item.balance).toBeDefined();
      expect(item.balance.product).toBeDefined();
      expect(item.balance.warehouse).toBeDefined();
      expect(item.operation).toBeDefined();
      expect(item.operation.actor).toBeDefined();
    });

    it('filters movements by productId and operationType', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/movements?productId=${prodA01Id}&type=ENTRY`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);

      const movements = response.body.data as TestMovementItem[];
      expect(
        movements.every(
          (m) =>
            m.operation.type === 'ENTRY' && m.balance.productId === prodA01Id,
        ),
      ).toBe(true);
    });
  });

  describe('Concurrency & Serializable Isolation (ADR-003, RN-020)', () => {
    it('handles concurrent exits consistently without negative balances or race conditions', async () => {
      // 1. Initial entry of 15 items in warehouseMty01 for prodC03
      const seedKey = `concurrent-init-${runId}`;
      const entryRes = await request(app.getHttpServer())
        .post('/api/v1/inventory/entries')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', seedKey)
        .send({
          warehouseId: warehouseMty01Id,
          productId: prodC03Id,
          quantity: 15,
          reason: 'Lote para prueba de concurrencia',
        });
      expect(entryRes.status).toBe(201);
      const balanceBeforeConcurrency = entryRes.body.data.balance.onHand;
      const reservedBeforeConcurrency = entryRes.body.data.balance.reserved;

      // 2. Launch 5 parallel exits of 4 units each (Total 20 requested, but only 15 available)
      const requestCount = 5;
      const exitQuantity = 4;

      const promises = Array.from({ length: requestCount }, (_, i) =>
        request(app.getHttpServer())
          .post('/api/v1/inventory/exits')
          .set('Authorization', `Bearer ${operatorToken}`)
          .set('X-Organization-Id', ownerOrgId)
          .set('Idempotency-Key', `concurrent-exit-${runId}-${i}`)
          .send({
            warehouseId: warehouseMty01Id,
            productId: prodC03Id,
            quantity: exitQuantity,
            reason: `Salida concurrente ${i}`,
          }),
      );

      const results = await Promise.all(promises);

      let successCount = 0;
      let conflictCount = 0;

      for (const res of results) {
        if (res.status === 201) {
          successCount++;
        } else if (res.status === 409) {
          conflictCount++;
          expect(['INSUFFICIENT_STOCK', 'CONCURRENT_MODIFICATION']).toContain(
            res.body.code,
          );
        } else {
          // Unexpected error
          expect(res.status).toBe(201);
        }
      }

      expect(successCount).toBeGreaterThanOrEqual(1);
      expect(conflictCount).toBeGreaterThanOrEqual(1);

      // Check mathematical invariant on final balance
      const finalBalance =
        await prisma.client.inventoryBalance.findUniqueOrThrow({
          where: {
            warehouseId_productId: {
              warehouseId: warehouseMty01Id,
              productId: prodC03Id,
            },
          },
        });

      const expectedOnHand =
        balanceBeforeConcurrency - successCount * exitQuantity;
      expect(finalBalance.onHand).toBe(expectedOnHand);
      expect(finalBalance.onHand).toBeGreaterThanOrEqual(
        reservedBeforeConcurrency,
      );
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    it('allows OPERATOR to perform inventory entries and exits', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/entries')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', `rbac-op-${runId}`)
        .send({
          warehouseId: warehouseMty01Id,
          productId: prodA01Id,
          quantity: 1,
          reason: 'RBAC Operator test',
        });

      expect(response.status).toBe(201);
    });

    it('rejects VIEWER from performing inventory entries with 403 FORBIDDEN', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventory/entries')
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .set('Idempotency-Key', `rbac-viewer-entry-${runId}`)
        .send({
          warehouseId: warehouseMty01Id,
          productId: prodA01Id,
          quantity: 1,
          reason: 'RBAC Viewer test',
        });

      expect(response.status).toBe(403);
    });

    it('rejects OPERATOR from configuring minimum stock with 403 FORBIDDEN (requires CATALOG_WRITE)', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventory/minimum-stock')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          warehouseId: warehouseMty01Id,
          productId: prodA01Id,
          minimumStock: 50,
        });

      expect(response.status).toBe(403);
    });

    it('rejects VIEWER from configuring minimum stock with 403 FORBIDDEN', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventory/minimum-stock')
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          warehouseId: warehouseMty01Id,
          productId: prodA01Id,
          minimumStock: 50,
        });

      expect(response.status).toBe(403);
    });

    it('allows VIEWER to read inventory and movements', async () => {
      const invRes = await request(app.getHttpServer())
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(invRes.status).toBe(200);

      const movRes = await request(app.getHttpServer())
        .get('/api/v1/movements')
        .set('Authorization', `Bearer ${viewerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(movRes.status).toBe(200);
    });
  });
});
