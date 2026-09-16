import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/app.setup.js';

@Controller('test-error')
class TestErrorController {
  @Get()
  fail(): never {
    throw new Error('database password=secret stack details');
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('WareOps API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestErrorController],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: false });
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps liveness independent from PostgreSQL and generates requestId', async () => {
    const response = await request(app.getHttpServer()).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: { status: 'ok' },
      requestId: expect.stringMatching(UUID_PATTERN),
    });
    expect(response.headers['x-request-id']).toBe(response.body.requestId);
  });

  it('propagates a valid client requestId', async () => {
    const requestId = '1a54e8aa-9d0f-4f29-8b85-8293496f2536';
    const response = await request(app.getHttpServer())
      .get('/health/live')
      .set('X-Request-Id', requestId);

    expect(response.status).toBe(200);
    expect(response.body.requestId).toBe(requestId);
    expect(response.headers['x-request-id']).toBe(requestId);
  });

  it('rejects an invalid requestId with the global error contract', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/live')
      .set('X-Request-Id', 'not-a-uuid');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      details: { fields: { 'X-Request-Id': ['INVALID_UUID'] } },
      requestId: expect.stringMatching(UUID_PATTERN),
    });
  });

  it('reports the expected readiness state', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready');

    if (process.env.RUN_DATABASE_TESTS === 'true') {
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({
        status: 'ok',
        dependencies: { postgres: 'up' },
      });
    } else {
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        statusCode: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        details: { postgres: 'down' },
      });
    }
  });

  it('does not expose unexpected error details', async () => {
    const response = await request(app.getHttpServer()).get(
      '/api/v1/test-error',
    );

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Ocurrió un error interno.',
    });
    expect(JSON.stringify(response.body)).not.toContain('password=secret');
  });

  it('publishes health routes and shared security schemes in OpenAPI', async () => {
    const response = await request(app.getHttpServer()).get('/docs-json');

    expect(response.status).toBe(200);
    expect(response.body.paths).toHaveProperty('/health/live');
    expect(response.body.paths).toHaveProperty('/health/ready');
    expect(response.body.components.securitySchemes).toMatchObject({
      bearer: expect.any(Object),
      organizationId: expect.any(Object),
      requestId: expect.any(Object),
    });
    expect(
      response.body.paths['/health/ready'].get.responses['503'].content[
        'application/json'
      ].schema,
    ).toEqual({ $ref: '#/components/schemas/ApiErrorResponseDto' });
  });
});
