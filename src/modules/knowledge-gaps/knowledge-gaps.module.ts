import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { UsageModule } from '../usage/usage.module';
import { KnowledgeGapsController } from './knowledge-gaps.controller';
import { KnowledgeGapsService } from './knowledge-gaps.service';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    AuthModule,
    OrganizationsModule,
    AuditModule,
    UsageModule,
    WebhooksModule,
  ],
  controllers: [KnowledgeGapsController],
  providers: [KnowledgeGapsService],
  exports: [KnowledgeGapsService],
})
export class KnowledgeGapsModule {}
