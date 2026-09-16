import { validateEnvironment } from './environment.validation.js';

const validEnvironment = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://wareops:wareops@localhost:5432/wareops',
  JWT_ACCESS_SECRET: 'test-secret-with-at-least-32-characters',
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL: '7d',
  COOKIE_SECURE: 'false',
  COOKIE_SAME_SITE: 'lax',
  WEB_ORIGIN: 'http://localhost:3001',
  LOG_LEVEL: 'log',
};

describe('validateEnvironment', () => {
  it('normalizes a valid configuration', () => {
    const result = validateEnvironment(validEnvironment);

    expect(result.PORT).toBe(3000);
    expect(result.COOKIE_SECURE).toBe(false);
  });

  it('reports all invalid required settings at startup', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        DATABASE_URL: 'not-a-url',
        JWT_ACCESS_SECRET: 'short',
        ACCESS_TOKEN_TTL: 'tomorrow',
      }),
    ).toThrow(/DATABASE_URL.*JWT_ACCESS_SECRET.*ACCESS_TOKEN_TTL/s);
  });
});
