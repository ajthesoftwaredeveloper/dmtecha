import { Injectable } from '@nestjs/common';

/**
 * Intelligent text chunking service.
 * Splits documents into overlapping chunks for embedding generation.
 *
 * Strategy: Split on paragraph boundaries first, then sentence boundaries,
 * with configurable chunk size and overlap for optimal retrieval.
 */
@Injectable()
export class ChunkingService {
  private readonly defaultChunkSize = 1000; // characters
  private readonly defaultOverlap = 200; // characters

  /**
   * Split text into overlapping chunks.
   */
  chunk(text: string, chunkSize = this.defaultChunkSize, overlap = this.defaultOverlap): string[] {
    if (!text.trim()) return [];
    if (text.length <= chunkSize) return [text.trim()];

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + chunkSize, text.length);

      // If we're not at the end, try to break at a natural boundary
      if (end < text.length) {
        end = this.findBreakPoint(text, start, end);
      }

      const chunk = text.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // Move start forward, accounting for overlap
      const step = end - start - overlap;
      start += Math.max(step, 1); // Ensure we always advance
    }

    return chunks;
  }

  /**
   * Find the best break point near the end position.
   * Prefers paragraph breaks > sentence breaks > word breaks.
   */
  private findBreakPoint(text: string, start: number, end: number): number {
    const searchWindow = text.slice(start, end);

    // Try paragraph break (double newline)
    const lastParagraph = searchWindow.lastIndexOf('\n\n');
    if (lastParagraph > searchWindow.length * 0.5) {
      return start + lastParagraph + 2;
    }

    // Try sentence break (. ! ?)
    const sentenceRegex = /[.!?]\s/g;
    let lastSentence = -1;
    let match: RegExpExecArray | null;
    while ((match = sentenceRegex.exec(searchWindow)) !== null) {
      if (match.index > searchWindow.length * 0.5) {
        lastSentence = match.index;
      }
    }
    if (lastSentence > -1) {
      return start + lastSentence + 2;
    }

    // Try word break
    const lastSpace = searchWindow.lastIndexOf(' ');
    if (lastSpace > searchWindow.length * 0.5) {
      return start + lastSpace + 1;
    }

    return end;
  }
}
