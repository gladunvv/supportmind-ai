import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuditModule } from '../audit/audit.module';
import { SearchModule } from '../search/search.module';
import { UsageModule } from '../usage/usage.module';
import { ExternalApiController } from './external-api.controller';
import { ExternalApiService } from './external-api.service';
import { KnowledgeGapsModule } from '../knowledge-gaps/knowledge-gaps.module';
@Module({
  imports: [
    ApiKeysModule,
    SearchModule,
    AiModule,
    UsageModule,
    AuditModule,
    KnowledgeGapsModule,
  ],
  controllers: [ExternalApiController],
  providers: [ExternalApiService],
})
export class ExternalApiModule {}
