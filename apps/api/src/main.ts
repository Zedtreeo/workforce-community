import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { join } from 'path';
import { LoggerService } from './common/logger';
import { auth } from './auth/auth.config';
import { fromNodeHeaders } from 'better-auth/node';
import { PrismaClient } from '@prisma/client';

// Single PrismaClient for the /uploads auth middleware (separate from app PrismaService)
const uploadsAuthPrisma = new PrismaClient();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Use our structured logger as the application logger
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // ─── SECURED: /uploads/* — auth + tenant check, then static serve ───
  // Replaces previous app.useStaticAssets(...) which had NO auth.
  // Rule: must have valid session/Bearer, and the path's first segment
  // (= tenantId) must match the requesting user's tenantId.
  // Exception: '__letter-templates__' and 'payroll' are tenant-shared,
  // require auth only (no tenant match).
  // Auth gate runs BEFORE the static handler. If next() is called,
  // useStaticAssets below picks up the request; if we send a 401/403, we stop.
  app.use('/uploads', async (req: any, res: any, next: any) => {
    try {
      let userTenantId: string | undefined;

      // Try 1: Better Auth cookie session (browser)
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (session) {
        userTenantId = (session.user as any).tenantId;
      }

      // Try 2: Bearer token (desktop agent / programmatic)
      if (!userTenantId && req.headers.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.slice(7);
        const dbSession = await uploadsAuthPrisma.session.findFirst({
          where: { token, expiresAt: { gt: new Date() } },
          include: { user: true },
        });
        userTenantId = (dbSession?.user as any)?.tenantId;
      }

      if (!userTenantId) {
        return res.status(401).json({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Authentication required to access uploads',
        });
      }

      // Verify path's tenant segment
      const parts = (req.path || '').split('/').filter(Boolean);
      if (parts.length === 0) {
        return res.status(404).json({ statusCode: 404, error: 'Not Found' });
      }

      // System-wide assets — auth only, no tenant match
      if (parts[0] === '__letter-templates__' || parts[0] === '__agent-builds__' || parts[0] === 'payroll') {
        return next();
      }

      if (parts[0] !== userTenantId) {
        return res.status(403).json({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Cross-tenant access denied',
        });
      }

      return next();
    } catch (err: any) {
      return res.status(401).json({
        statusCode: 401,
        error: 'Unauthorized',
        message: err?.message || 'Auth error',
      });
    }
  });

  // Static file serve (only reached when auth middleware calls next())
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  const config = app.get(ConfigService);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: (config.get('CORS_ORIGINS') || config.get('CORS_ORIGIN') || 'http://localhost:3000').split(',').map((s: string) => s.trim()),
    credentials: true,
  });

    // Swagger / OpenAPI Documentation
  const enableDocs = config.get('ENABLE_DOCS', 'true') === 'true';
  if (enableDocs) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Zedtreeo Workforce API')
      .setDescription(
        'Multi-tenant HR & billing platform (Community Edition).\n\n' +
        '**Authentication:** All endpoints (except `/health` and `/auth`) require a Bearer token.\n\n' +
        '**Tenant Isolation:** Every request is scoped to the authenticated user\'s tenant. ' +
        'Cross-tenant access is not possible.\n\n' +
        '**Rate Limiting:** 60 requests/minute per IP (configurable per-route).',
      )
      .setVersion('1.0.0')
      .setContact('Zedtreeo Workforce', 'https://zedtreeo.com', '')
      .setLicense('AGPL-3.0', 'https://www.gnu.org/licenses/agpl-3.0.html')
      .addServer(`http://localhost:${config.get('PORT', config.get('API_PORT', 4000))}`, 'Local Development')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter the JWT token from /auth/sign-in',
        },
        'bearer',
      )
      .addTag('Health', 'Application health & readiness checks')
      .addTag('Auth', 'Authentication & session management')
      .addTag('Dashboard', 'Admin dashboard statistics')
      .addTag('Employees', 'Employee CRUD & portal access management')
      .addTag('Departments', 'Department management')
      .addTag('Clients', 'Client company management')
      .addTag('Assignments', 'Employee-to-client assignment management')
      .addTag('Attendance', 'Daily attendance tracking & reports')
      .addTag('Leaves', 'Leave types, requests, balances & approvals')
      .addTag('Holidays', 'Holiday calendar & shift type management')
      .addTag('Invoices', 'Invoice generation, tracking & payments')
      .addTag('Payroll', 'Salary structures & payroll processing')
      .addTag('Documents', 'Employee document management & expiry tracking')
      .addTag('Monitoring', 'Desktop agent activity tracking & tamper detection')
      .addTag('Notifications', 'In-app notification management')
      .addTag('Reports', 'Business intelligence & data exports')
      .addTag('Audit', 'Audit trail & compliance logs')
      .addTag('Settings', 'Tenant settings & user management')
      .addTag('Employee Portal', 'Employee self-service portal endpoints')
      .addTag('Client Portal', 'Client-facing portal endpoints')
      .addTag('Tenants', 'Tenant (organization) management — super-admin')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      operationIdFactory: (controllerKey: string, methodKey: string) =>
        `${controllerKey}_${methodKey}`,
    });

    SwaggerModule.setup('docs', app, document, {
      customSiteTitle: 'Zedtreeo Workforce API',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        tagsSorter: 'alpha',
        operationsSorter: 'method',
      },
    });

    // JSON spec endpoint for code generators
    SwaggerModule.setup('docs-json', app, document, {
      jsonDocumentUrl: '/api/v1/docs-json',
    });
  }

  const port = config.get('PORT', config.get('API_PORT', 4000));
  await app.listen(port, '0.0.0.0');
  logger.log(`API running on http://localhost:${port}`, 'Bootstrap');
  if (enableDocs) {
    logger.log(`API docs: http://localhost:${port}/docs`, 'Bootstrap');
  }
}
bootstrap();

