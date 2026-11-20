import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './database/prisma.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  async checkHealth() {
    const start = Date.now();
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database healthcheck timeout 5s)')), 5000),
        ),
      ]);
      this.prisma.isAvailable = true;
      return {
        status: 'ok',
        database: 'connected',
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      this.prisma.isAvailable = false;
      this.logger.error(
        'Database health check failed',
        err instanceof Error ? err.stack : String(err),
      );
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'disconnected',
        message: 'Base de datos temporalmente no disponible.',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
