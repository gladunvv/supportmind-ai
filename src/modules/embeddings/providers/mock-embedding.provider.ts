import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { EmbeddingProvider } from './embedding-provider.interface';

const EMBEDDING_DIMENSION = 1536;

@Injectable()
export class MockEmbeddingProvider implements EmbeddingProvider {
  embed(text: string): Promise<number[]> {
    return Promise.resolve(this.createVector(text));
  }

  embedMany(texts: string[]): Promise<number[][]> {
    return Promise.resolve(texts.map((text) => this.createVector(text)));
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
