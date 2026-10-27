import { Module } from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {PrismaModule} from './database/prisma.module';
import {SupabaseModule} from './common/supabase/supabase.module';
import {InventoryModule} from './modules/inventory/inventory.module';
import {PosModule} from './modules/pos/pos.module';
import {AccountingModule} from './modules/accounting/accounting.module';
import {UsersModule} from './modules/users/users.module';
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
    SupabaseModule,
    InventoryModule,
    PosModule,
    AccountingModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
