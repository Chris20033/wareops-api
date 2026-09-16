process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '3000';
process.env.DATABASE_URL ??=
  'postgresql://wareops:wareops@127.0.0.1:1/wareops_test';
process.env.JWT_ACCESS_SECRET ??= 'test-secret-with-at-least-32-characters';
process.env.ACCESS_TOKEN_TTL ??= '15m';
process.env.REFRESH_TOKEN_TTL ??= '7d';
process.env.COOKIE_SECURE ??= 'false';
process.env.COOKIE_SAME_SITE ??= 'lax';
process.env.WEB_ORIGIN ??= 'http://localhost:3001';
process.env.LOG_LEVEL ??= 'error';
