import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './database/prisma.module';
import { SupabaseModule } from './common/supabase/supabase.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { PosModule } from './modules/pos/pos.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { PosAccountingSyncModule } from './modules/integrations/pos-accounting-sync.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuthGuard } from './common/guards/auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import * as path from 'path';

@Module({
  imports: [
    // Distributed tracing, auto-correlated logs, request/job metrics, error
    // telemetry, alarms, and more — out of the box. Sign up at https://observe.nestjs.com
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../../.env'),
        path.resolve(__dirname, '../../../.env'),
        path.resolve(__dirname, '../../.env'),
        '.env',
        '../../.env',
      ],
    }),
    PrismaModule,
    ScheduleModule.forRoot(),
    SupabaseModule,
    InventoryModule,
    PurchasesModule,
    PosModule,
    AccountingModule,
    PosAccountingSyncModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
