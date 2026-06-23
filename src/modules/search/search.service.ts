import { Inject, Injectable } from '@nestjs/common';
import {
  EMBEDDING_PROVIDER,
  EmbeddingProvider,
} from '../embeddings/providers/embedding-provider.interface';
import { toPgVector } from '../embeddings/utils/vector-sql.util';
import { PrismaService } from '../prisma/prisma.service';
import { SearchDocumentsDto } from './dto/search-documents.dto';

export type SearchResult = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
};

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER)
    private readonly embeddingProvider: EmbeddingProvider,
  ) {}

  async search(
    organizationId: string,
    dto: SearchDocumentsDto,
  ): Promise<SearchResult[]> {
    const embedding = await this.embeddingProvider.embed(dto.query);
    const vector = toPgVector(embedding);

    return this.prisma.$queryRaw<SearchResult[]>`
      SELECT
        dc."id" as "chunkId",
        dc."documentId" as "documentId",
        d."title" as "documentTitle",
        dc."content" as "content",
        1 - (dc."embedding" <=> ${vector}::vector) as "score"
      FROM "document_chunks" dc
      INNER JOIN "documents" d ON d."id" = dc."documentId"
      WHERE
        dc."organizationId" = ${organizationId}
        AND dc."embedding" IS NOT NULL
        AND d."deletedAt" IS NULL
        AND d."status" = 'indexed'
      ORDER BY dc."embedding" <=> ${vector}::vector
      LIMIT 5
    `;
  }
}
