import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { MembersModule } from './modules/members/members.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { BullModule } from '@nestjs/bullmq';
import { DocumentIngestionModule } from './modules/document-ingestion/document-ingestion.module';
import { SearchModule } from './modules/search/search.module';
import { AiModule } from './modules/ai/ai.module';
import { SupportModule } from './modules/support/support.module';
import { UsageModule } from './modules/usage/usage.module';
import { AuditModule } from './modules/audit/audit.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    OrganizationsModule,
    MembersModule,
    DocumentsModule,
    DocumentIngestionModule,
    SearchModule,
    AiModule,
    SupportModule,
    UsageModule,
    AuditModule,
    ApiKeysModule,
  ],
})
export class AppModule {}
