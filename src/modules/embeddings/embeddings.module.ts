import { Module } from '@nestjs/common';
import { EMBEDDING_PROVIDER } from './providers/embedding-provider.interface';
import { MockEmbeddingProvider } from './providers/mock-embedding.provider';

@Module({
  providers: [
    {
      provide: EMBEDDING_PROVIDER,
      useClass: MockEmbeddingProvider,
    },
  ],
  exports: [EMBEDDING_PROVIDER],
})
export class EmbeddingsModule {}
