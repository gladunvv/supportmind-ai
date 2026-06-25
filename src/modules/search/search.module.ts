import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [AuthModule, OrganizationsModule, EmbeddingsModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
