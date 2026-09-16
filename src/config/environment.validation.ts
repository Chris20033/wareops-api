import Joi from 'joi';

export type AppEnvironment = {
  NODE_ENV: 'development' | 'test' | 'demo' | 'production';
  PORT: number;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  ACCESS_TOKEN_TTL: string;
  REFRESH_TOKEN_TTL: string;
  COOKIE_SECURE: boolean;
  COOKIE_SAME_SITE: 'strict' | 'lax' | 'none';
  WEB_ORIGIN: string;
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'log' | 'debug' | 'verbose';
};

const durationPattern = /^\d+[smhd]$/;

const environmentSchema = Joi.object<AppEnvironment>({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'demo', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  ACCESS_TOKEN_TTL: Joi.string().pattern(durationPattern).required(),
  REFRESH_TOKEN_TTL: Joi.string().pattern(durationPattern).required(),
  COOKIE_SECURE: Joi.boolean().truthy('true').falsy('false').required(),
  COOKIE_SAME_SITE: Joi.string().valid('strict', 'lax', 'none').required(),
  WEB_ORIGIN: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required(),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'log', 'debug', 'verbose')
    .default('log'),
}).unknown(true);

export function validateEnvironment(
  values: Record<string, unknown>,
): AppEnvironment {
  const result: Joi.ValidationResult<AppEnvironment> =
    environmentSchema.validate(values, {
      abortEarly: false,
      convert: true,
    });

  if (result.error) {
    throw new Error(
      `Invalid environment configuration: ${result.error.message}`,
    );
  }

  return result.value;
}
