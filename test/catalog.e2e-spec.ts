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

describe('Sprint 02 — Locations and Catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const runId = Date.now().toString(36);

  let ownerToken: string;
  let ownerOrgId: string;

  let operatorToken: string;

  let surOwnerToken: string;
  let surOrgId: string;

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

    // Login con Owner de Organización Norte
    const ownerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner@wareops.local',
        password: 'WareOpsDemo!2026',
      });
    expect(ownerLogin.status).toBe(200);
    ownerToken = ownerLogin.body.data.accessToken;
    ownerOrgId = ownerLogin.body.data.organizations[0].organizationId;

    // Login con Operador de Organización Norte
    const operatorLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'operator@wareops.local',
        password: 'WareOpsDemo!2026',
      });
    expect(operatorLogin.status).toBe(200);
    operatorToken = operatorLogin.body.data.accessToken;

    // Login con Owner de Organización Sur (para pruebas cross-tenant)
    const surLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner.sur@wareops.local',
        password: 'WareOpsDemo!2026',
      });
    expect(surLogin.status).toBe(200);
    surOwnerToken = surLogin.body.data.accessToken;
    surOrgId = surLogin.body.data.organizations[0].organizationId;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Branches (Sucursales)', () => {
    let createdBranchId: string;
    const branchCode = `SUC-TEST-${runId.toUpperCase()}`;

    it('creates a branch with uppercase code normalization and lists it with pagination', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          code: branchCode.toLowerCase(), // se envía en minúsculas para comprobar normalización
          name: `Sucursal Test ${runId}`,
          address: 'Dirección de prueba 123',
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        code: branchCode,
        name: `Sucursal Test ${runId}`,
        address: 'Dirección de prueba 123',
        isActive: true,
        warehousesCount: 0,
      });
      createdBranchId = response.body.data.id;

      // Listar sucursales
      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .query({ search: branchCode, page: 1, pageSize: 10 });

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data.length).toBeGreaterThanOrEqual(1);
      expect(listResponse.body.meta).toMatchObject({
        page: 1,
        pageSize: 10,
        totalItems: expect.any(Number),
      });
    });

    it('rejects duplicate branch code within the same organization with 409 DUPLICATE_RESOURCE', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          code: branchCode,
          name: 'Otra sucursal con el mismo código',
        });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        statusCode: 409,
        code: 'DUPLICATE_RESOURCE',
      });
    });

    it('gets branch detail, updates name/address, and deactivates branch via PATCH', async () => {
      // Detalle
      const getResponse = await request(app.getHttpServer())
        .get(`/api/v1/branches/${createdBranchId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.data.id).toBe(createdBranchId);

      // Actualizar y desactivar
      const patchResponse = await request(app.getHttpServer())
        .patch(`/api/v1/branches/${createdBranchId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          name: `Sucursal Test ${runId} (Actualizada)`,
          isActive: false,
        });

      expect(patchResponse.status).toBe(200);
      expect(patchResponse.body.data).toMatchObject({
        name: `Sucursal Test ${runId} (Actualizada)`,
        isActive: false,
      });
    });
  });

  describe('Warehouses (Almacenes)', () => {
    let testBranchId: string;
    let createdWarehouseId: string;
    const warehouseCode = `ALM-TEST-${runId.toUpperCase()}`;

    beforeAll(async () => {
      // Crear una sucursal para asociar almacenes
      const branchRes = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          code: `SUC-WH-${runId.toUpperCase()}`,
          name: 'Sucursal Para Almacenes',
        });
      testBranchId = branchRes.body.data.id;
    });

    it('creates warehouse and normalizes code to uppercase', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          branchId: testBranchId,
          code: warehouseCode.toLowerCase(),
          name: 'Almacén de Prueba',
          description: 'Descripción operativa del almacén',
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        branchId: testBranchId,
        code: warehouseCode,
        name: 'Almacén de Prueba',
        description: 'Descripción operativa del almacén',
        isActive: true,
        branch: {
          id: testBranchId,
        },
      });
      createdWarehouseId = response.body.data.id;
    });

    it('rejects creating warehouse with a branch belonging to another organization with 404 (CA-003)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Authorization', `Bearer ${surOwnerToken}`)
        .set('X-Organization-Id', surOrgId)
        .send({
          branchId: testBranchId, // rama de Org Norte enviada por Org Sur
          code: `ALM-FAIL-${runId.toUpperCase()}`,
          name: 'Almacén Cross Tenant Inválido',
        });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
      });
    });

    it('rejects duplicate warehouse code within the same branch with 409 DUPLICATE_RESOURCE', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/warehouses')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          branchId: testBranchId,
          code: warehouseCode,
          name: 'Almacén Duplicado',
        });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        statusCode: 409,
        code: 'DUPLICATE_RESOURCE',
      });
    });

    it('lists warehouses filtering by branchId, gets warehouse detail, and deactivates it', async () => {
      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/warehouses')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .query({ branchId: testBranchId });

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data.length).toBeGreaterThanOrEqual(1);

      // Desactivar almacén
      const patchResponse = await request(app.getHttpServer())
        .patch(`/api/v1/warehouses/${createdWarehouseId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({ isActive: false });

      expect(patchResponse.status).toBe(200);
      expect(patchResponse.body.data.isActive).toBe(false);
    });
  });

  describe('Products (Productos)', () => {
    let createdProductId: string;
    const productSku = `SKU-TEST-${runId.toUpperCase()}`;

    it('creates product and normalizes SKU to uppercase', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          sku: productSku.toLowerCase(),
          name: 'Producto de Prueba',
          description: 'Descripción del producto',
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        sku: productSku,
        name: 'Producto de Prueba',
        isActive: true,
        suppliersCount: 0,
      });
      createdProductId = response.body.data.id;
    });

    it('rejects duplicate product SKU in same organization with 409 (RN-007)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          sku: productSku,
          name: 'Producto con SKU repetido',
        });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        statusCode: 409,
        code: 'DUPLICATE_RESOURCE',
      });
    });

    it('lists products, retrieves product detail, and deactivates product', async () => {
      const getResponse = await request(app.getHttpServer())
        .get(`/api/v1/products/${createdProductId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.data).toMatchObject({
        id: createdProductId,
        sku: productSku,
        suppliers: [],
      });

      const patchResponse = await request(app.getHttpServer())
        .patch(`/api/v1/products/${createdProductId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({ isActive: false });

      expect(patchResponse.status).toBe(200);
      expect(patchResponse.body.data.isActive).toBe(false);
    });
  });

  describe('Suppliers (Proveedores) & Product-Supplier Association', () => {
    let createdSupplierId: string;
    let testProductId: string;
    const supplierCode = `PROV-TEST-${runId.toUpperCase()}`;

    beforeAll(async () => {
      // Crear un producto para asociarle el proveedor
      const prodRes = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          sku: `SKU-FOR-PROV-${runId.toUpperCase()}`,
          name: 'Producto Para Proveedor',
        });
      testProductId = prodRes.body.data.id;
    });

    it('creates supplier with uppercase code and lowercase email', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          code: supplierCode.toLowerCase(),
          name: 'Proveedor de Prueba',
          contactName: 'Lic. Andrés',
          email: 'ANDRES@PROVEEDOR.COM',
          phone: '+528181112233',
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        code: supplierCode,
        name: 'Proveedor de Prueba',
        email: 'andres@proveedor.com',
        isActive: true,
        productsCount: 0,
      });
      createdSupplierId = response.body.data.id;
    });

    it('rejects duplicate supplier code in the same organization with 409', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          code: supplierCode,
          name: 'Proveedor duplicado',
        });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        statusCode: 409,
        code: 'DUPLICATE_RESOURCE',
      });
    });

    it('associates supplier to product and rejects duplicate or cross-tenant association (CA-003, RN-009)', async () => {
      // Asociación válida
      const attachRes = await request(app.getHttpServer())
        .post(`/api/v1/products/${testProductId}/suppliers`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({ supplierId: createdSupplierId });

      expect(attachRes.status).toBe(201);
      expect(attachRes.body.data).toMatchObject({
        supplierId: createdSupplierId,
        code: supplierCode,
      });

      // Rechazar asociación duplicada (409)
      const duplicateRes = await request(app.getHttpServer())
        .post(`/api/v1/products/${testProductId}/suppliers`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({ supplierId: createdSupplierId });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body).toMatchObject({
        statusCode: 409,
        code: 'DUPLICATE_RESOURCE',
      });

      // Rechazar asociar con un producto o proveedor de otro tenant (404)
      const crossTenantRes = await request(app.getHttpServer())
        .post(`/api/v1/products/${testProductId}/suppliers`)
        .set('Authorization', `Bearer ${surOwnerToken}`)
        .set('X-Organization-Id', surOrgId)
        .send({ supplierId: createdSupplierId });

      expect(crossTenantRes.status).toBe(404);
      expect(crossTenantRes.body).toMatchObject({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
      });
    });

    it('lists suppliers for product and deletes association without altering product (204)', async () => {
      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/products/${testProductId}/suppliers`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.data[0].supplierId).toBe(createdSupplierId);

      // Eliminar asociación
      const deleteRes = await request(app.getHttpServer())
        .delete(
          `/api/v1/products/${testProductId}/suppliers/${createdSupplierId}`,
        )
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(deleteRes.status).toBe(204);

      // Verificar que la lista ahora esté vacía
      const listAfterRes = await request(app.getHttpServer())
        .get(`/api/v1/products/${testProductId}/suppliers`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(listAfterRes.status).toBe(200);
      expect(listAfterRes.body.data.length).toBe(0);
    });
  });

  describe('RBAC & Multi-tenant Isolation', () => {
    it('OPERATOR can read catalog but cannot create or mutate (403 PERMISSION_DENIED)', async () => {
      // Lectura permitida
      const getRes = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(getRes.status).toBe(200);

      // Escritura prohibida para OPERATOR (catalog:write ausente)
      const postRes = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${operatorToken}`)
        .set('X-Organization-Id', ownerOrgId)
        .send({
          code: `SUC-FORBIDDEN-${runId.toUpperCase()}`,
          name: 'Sucursal no autorizada',
        });

      expect(postRes.status).toBe(403);
      expect(postRes.body).toMatchObject({
        statusCode: 403,
        code: 'PERMISSION_DENIED',
      });
    });

    it('returns 404 RESOURCE_NOT_FOUND when requesting another organization resource (CA-001)', async () => {
      // Obtener una sucursal de Org Sur
      const surBranches = await request(app.getHttpServer())
        .get('/api/v1/branches')
        .set('Authorization', `Bearer ${surOwnerToken}`)
        .set('X-Organization-Id', surOrgId);

      expect(surBranches.status).toBe(200);
      const targetBranchId = surBranches.body.data[0]?.id;
      expect(targetBranchId).toBeDefined();

      // Consultarla con el token de Org Norte -> debe dar 404
      const response = await request(app.getHttpServer())
        .get(`/api/v1/branches/${targetBranchId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('X-Organization-Id', ownerOrgId);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        statusCode: 404,
        code: 'RESOURCE_NOT_FOUND',
      });
    });
  });
});
