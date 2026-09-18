# WareOps API

Backend de WareOps construido con Node.js 24 LTS, NestJS 11, TypeScript estricto, Prisma ORM 7 y PostgreSQL 18.

## Requisitos

- Node.js 24.x y npm 11.x.
- Docker con Docker Compose para el entorno reproducible.
- PostgreSQL 18 si se ejecuta la API directamente sin Docker.

## Instalación local

```bash
npm ci
cp .env.example .env
npm run db:generate
npm run start:dev
```

En PowerShell, copie el entorno con `Copy-Item .env.example .env`. La configuración se valida antes de iniciar; reemplace los valores locales antes de usar otro entorno y nunca confirme `.env`.

La API queda disponible en `http://localhost:3001`. Las rutas operativas son:

- `GET /health/live`: confirma que el proceso está activo sin consultar PostgreSQL.
- `GET /health/ready`: confirma que PostgreSQL acepta una conexión de Prisma.
- `GET /docs`: interfaz Swagger.
- `GET /docs-json`: documento OpenAPI JSON.

Las futuras rutas de negocio usarán el prefijo `/api/v1`.

## Variables de entorno

| Variable            | Uso                                                             | Ejemplo local                                               |
| ------------------- | --------------------------------------------------------------- | ----------------------------------------------------------- |
| `NODE_ENV`          | Entorno de ejecución: `development`, `test` o `production`.     | `development`                                               |
| `PORT`              | Puerto donde escucha la API al ejecutarse directamente.         | `3001`                                                      |
| `DATABASE_URL`      | URL PostgreSQL consumida por Prisma.                            | `postgresql://wareops:wareops_local@localhost:5432/wareops` |
| `JWT_ACCESS_SECRET` | Secreto de al menos 32 caracteres reservado para autenticación. | Valor ficticio de `.env.example`                            |
| `ACCESS_TOKEN_TTL`  | Vigencia futura del access token.                               | `15m`                                                       |
| `REFRESH_TOKEN_TTL` | Vigencia futura del refresh token.                              | `7d`                                                        |
| `COOKIE_SECURE`     | Exige HTTPS para cookies cuando sea `true`.                     | `false`                                                     |
| `COOKIE_SAME_SITE`  | Política `strict`, `lax` o `none`.                              | `lax`                                                       |
| `WEB_ORIGIN`        | Origen permitido por CORS.                                      | `http://localhost:3000`                                     |
| `LOG_LEVEL`         | Nivel mínimo del logger de Nest.                                | `log`                                                       |

Docker Compose también acepta `API_PORT`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD` para sobrescribir sus valores locales. Ningún valor de `.env.example` es apto para producción.

## Docker Compose

Levante la API y PostgreSQL:

```bash
docker compose up --build -d
docker compose ps
```

Vea los logs estructurados con `docker compose logs -f api` y detenga los servicios con `docker compose down`.

El volumen `postgres_data` conserva la base. `docker compose down -v` también elimina ese volumen y todos sus datos locales; úselo sólo cuando realmente quiera reiniciar la base.

## Prisma

El Sprint 01 no contiene modelos ni una migración vacía. Prisma Client se genera aun sin modelos y la primera migración será creada cuando Sprint 02 introduzca entidades.

```bash
npm run db:validate
npm run db:generate
npm run db:migrate -- --name nombre_descriptivo
npm run db:migrate:deploy
npm run db:seed
```

`db:migrate` es sólo para desarrollo. Las migraciones se generan desde `schema.prisma`, no se editan manualmente y producción usa `db:migrate:deploy`. El seed actual es intencionalmente vacío.

## Calidad

```bash
npm run format:check
npm run lint
npm test
npm run test:e2e
npm run build
```

Las pruebas e2e locales comprueban readiness sin PostgreSQL. Para probar readiness disponible contra la URL configurada, defina `RUN_DATABASE_TESTS=true`; el workflow de pruebas lo hace con un contenedor PostgreSQL efímero.

GitHub Actions ejecuta lint, pruebas y build en workflows separados usando `npm ci` y Node.js 24.
