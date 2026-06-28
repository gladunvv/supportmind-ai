import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { STORAGE_PROVIDER } from './storage/storage-provider.interface';
import { DocumentIngestionModule } from '../document-ingestion/document-ingestion.module';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [
    AuthModule,
    OrganizationsModule,
    DocumentIngestionModule,
    UsageModule,
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    {
      provide: STORAGE_PROVIDER,
      useClass: LocalStorageProvider,
    },
  ],
})
export class DocumentsModule {}
