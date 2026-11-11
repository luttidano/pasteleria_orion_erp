import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './database/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async checkHealth() {
    const start = Date.now();
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Database healthcheck timeout (2.5s)')), 2500),
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
      const detail = err instanceof Error ? err.message : 'Database connection error';
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'disconnected',
        message: detail,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
