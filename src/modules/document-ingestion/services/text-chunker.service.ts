import { Injectable } from '@nestjs/common';

export type TextChunk = {
  content: string;
  chunkIndex: number;
  tokenCount: number;
};

@Injectable()
export class TextChunkerService {
  private readonly maxChunkChars = 1800;
  private readonly overlapChars = 200;

  split(text: string): TextChunk[] {
    const normalizedText = this.normalizeText(text);

    if (!normalizedText) {
      return [];
    }

    const chunks: TextChunk[] = [];
    let start = 0;
    let index = 0;

    while (start < normalizedText.length) {
      const end = Math.min(start + this.maxChunkChars, normalizedText.length);
      const content = normalizedText.slice(start, end).trim();

      if (content) {
        chunks.push({
          content,
          chunkIndex: index,
          tokenCount: this.estimateTokenCount(content),
        });

        index += 1;
      }

      if (end >= normalizedText.length) {
        break;
      }

      start = Math.max(end - this.overlapChars, 0);
    }

    return chunks;
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
