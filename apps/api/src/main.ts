import { NestFactory } from '@nestjs/core';
import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

import * as path from 'path';
import * as fs from 'fs';

// Asegurar carga de variables de entorno desde la raíz del monorepo
for (const envPath of [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
]) {
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
      break;
    } catch {
      // Ignorar si ya fue cargado o el formato no aplica en este entorno
    }
  }
}

function buildAllowedCorsOrigins(): Set<string> {
  const configuredRaw = [
    process.env.CORS_ORIGINS,
    process.env.FRONTEND_URL,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(',');

  const origins = new Set(
    configuredRaw
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean),
  );

  if (process.env.NODE_ENV !== 'production') {
    for (const devOrigin of [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
      'http://localhost:3000',
    ]) {
      origins.add(devOrigin);
    }
  }

  return origins;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cabeceras de protección estándar (CSP, HSTS, no-sniff, etc.)
  app.use(helmet());

  // Confianza en proxies inversos (para Cloudflare / Nginx / Docker)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Prefijo global para las rutas: /api/inventory, etc.
  app.setGlobalPrefix('api');

  // Validación automática de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Allowlist explícita de orígenes CORS con credenciales habilitadas
  const allowedOrigins = buildAllowedCorsOrigins();
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const normalized = origin.trim().replace(/\/$/, '');
      if (allowedOrigins.has(normalized)) {
        callback(null, true);
        return;
      }
      callback(new ForbiddenException('Origin not allowed by CORS policy'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
    exposedHeaders: ['Idempotent-Replayed'],
  });

  // Desactivar ETag para evitar respuestas 304 en llamadas de API de datos dinámicos
  expressApp.set('etag', false);

  // Headers anti-caché y Logger para diagnóstico de peticiones entrantes
  app.use((req: any, res: any, next: any) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const start = Date.now();
    res.on('finish', () => {
      const url = req.originalUrl || req.url || '';
      if (url.startsWith('/api/health') && res.statusCode < 400) {
        return;
      }
      const authHeader = req.headers.authorization;
      const authSummary = !authHeader ? 'SIN_AUTH' : authHeader.startsWith('Bearer ') ? 'BEARER_OK' : 'AUTH_MALFORMADO';
      console.log(`[API ${req.method}] ${url} -> ${res.statusCode} (${Date.now() - start}ms) [${authSummary}]`);
    });
    next();
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Pastelería Orión ERP API running on http://localhost:${port}/api`);
}

void bootstrap();
