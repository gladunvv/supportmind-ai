import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
import { KnowledgeGapsModule } from './modules/knowledge-gaps/knowledge-gaps.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

@Module({
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
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
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
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
    KnowledgeGapsModule,
    WebhooksModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
