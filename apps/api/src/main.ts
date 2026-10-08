import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
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
    } catch (_) {}
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  // Permitir comunicación con el frontend (React en puerto 5173 u otros)
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Desactivar ETag para evitar respuestas 304 en llamadas de API de datos dinámicos
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('etag', false);

  // Headers anti-caché y Logger para diagnóstico de peticiones entrantes
  app.use((req: any, res: any, next: any) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const start = Date.now();
    res.on('finish', () => {
      const authHeader = req.headers.authorization;
      const authSummary = !authHeader ? 'SIN_AUTH' : authHeader.startsWith('Bearer ') ? 'BEARER_OK' : 'AUTH_MALFORMADO';
      console.log(`[API ${req.method}] ${req.originalUrl || req.url} -> ${res.statusCode} (${Date.now() - start}ms) [${authSummary}]`);
    });
    next();
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Pastelería Orión ERP API running on http://localhost:${port}/api`);
}

bootstrap();
