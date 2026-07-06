import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SearchModule } from '../search/search.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { UsageModule } from '../usage/usage.module';
import { AuditModule } from '../audit/audit.module';
import { KnowledgeGapsModule } from '../knowledge-gaps/knowledge-gaps.module';

@Module({
  imports: [
    AuthModule,
    OrganizationsModule,
    SearchModule,
    AiModule,
    UsageModule,
    AuditModule,
    KnowledgeGapsModule,
  ],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
