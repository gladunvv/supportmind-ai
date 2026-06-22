// src/modules/embeddings/providers/mock-embedding.provider.ts

import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { EmbeddingProvider } from './embedding-provider.interface';

const EMBEDDING_DIMENSION = 1536;

@Injectable()
export class MockEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    return this.createVector(text);
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embed(text)));
  }

  private createVector(text: string): number[] {
    const vector = Array.from({ length: EMBEDDING_DIMENSION }, (_, index) => {
      const hash = createHash('sha256').update(`${text}:${index}`).digest();

      return (hash[0] / 255) * 2 - 1;
    });

    return this.normalize(vector);
  }

  private normalize(vector: number[]): number[] {
    const magnitude = Math.sqrt(
      vector.reduce((sum, value) => sum + value * value, 0),
    );

    if (magnitude === 0) {
      return vector;
    }

    return vector.map((value) => value / magnitude);
  }
}
