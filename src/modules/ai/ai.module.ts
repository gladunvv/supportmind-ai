import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SearchModule } from '../search/search.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import { MockAiProvider } from './providers/mock-ai.provider';
import { UsageModule } from '../usage/usage.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    AuthModule,
    OrganizationsModule,
    SearchModule,
    UsageModule,
    AuditModule,
  ],
  controllers: [AiController],
  providers: [
    AiService,
    {
      provide: AI_PROVIDER,
      useClass: MockAiProvider,
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiModule {}
