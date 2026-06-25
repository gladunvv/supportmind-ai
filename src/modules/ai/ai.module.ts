import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SearchModule } from '../search/search.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AI_PROVIDER } from './providers/ai-provider.interface';
import { MockAiProvider } from './providers/mock-ai.provider';

@Module({
  imports: [AuthModule, OrganizationsModule, SearchModule],
  controllers: [AiController],
  providers: [
    AiService,
    {
      provide: AI_PROVIDER,
      useClass: MockAiProvider,
    },
  ],
})
export class AiModule {}
