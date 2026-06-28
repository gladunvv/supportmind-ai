import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SearchModule } from '../search/search.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [
    AuthModule,
    OrganizationsModule,
    SearchModule,
    AiModule,
    UsageModule,
  ],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
