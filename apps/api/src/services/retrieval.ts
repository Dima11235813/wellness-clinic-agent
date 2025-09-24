import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Document } from '@langchain/core/documents';
import { EmbeddingService } from '../utils/embeddings.js';

export interface RetrievedChunk {
  content: string;
  metadata: {
    filename: string;
    pageNumber: number;
    chunkIndex: number;
    docHash: string;
    chunkHash: string;
    ingestedAt: string;
    sourceUrl?: string;
    sourcePageUrl?: string;
  };
  score: number;
}

export interface RetrievalResult {
  query: string;
  chunks: RetrievedChunk[];
  citations: string[];
}

export class RetrievalService {
  private vectorStore: MemoryVectorStore;
  private initialized = false;

  constructor(embeddingService: EmbeddingService) {
    console.log(`Initializing in-memory vector store`);
    this.vectorStore = new MemoryVectorStore(embeddingService.embedder);
  }

  /**
   * Add chunks to the vector store (called by ingestion service)
   */
  async addChunks(chunks: Array<{
    id: string;
    content: string;
    embedding: number[];
    metadata: any;
  }>): Promise<void> {

    const documents = chunks.map(chunk => new Document({
      pageContent: chunk.content,
      metadata: {
        ...chunk.metadata,
        id: chunk.id,
      },
    }));

    await this.vectorStore.addDocuments(documents);
    this.initialized = true;

    console.log(`[RETRIEVAL] ✅ Added ${chunks.length} chunks to vector store`);

    // Log a sample chunk for debugging
    if (chunks.length > 0) {
      const sampleChunk = chunks[0];
      console.log(`[RETRIEVAL] 📄 Sample chunk added: ID=${sampleChunk.id}, Content="${sampleChunk.content.substring(0, 100)}..."`);
      console.log(`[RETRIEVAL] 📄 Sample metadata: Page=${sampleChunk.metadata.pageNumber}, DocHash=${sampleChunk.metadata.docHash.substring(0, 8)}...`);
      console.log(`[RETRIEVAL] 📄 Embedding length: ${sampleChunk.embedding.length}`);
    }
  }


  /**
   * Retrieve relevant chunks for a query using vector similarity search
   */
  async retrieve(query: string, topK: number = 5): Promise<RetrievalResult> {
    console.log(`[RETRIEVAL] 🔍 Starting retrieval for query: "${query}"`);

    if (!this.initialized) {
      console.log(`[RETRIEVAL] ❌ Vector store not initialized`);
      return {
        query,
        chunks: [],
        citations: [],
      };
    }

    try {
      // Use LangChain's built-in similarity search
      const results = await this.vectorStore.similaritySearchWithScore(query, topK);

      console.log(`[RETRIEVAL] Retrieved ${results.length} chunks for query: "${query}"`);

      // Format results
      const chunks: RetrievedChunk[] = results.map(([doc, score]: [any, number]) => ({
        content: doc.pageContent,
        metadata: doc.metadata,
        score: score,
      }));

      // Log the actual returned chunks
      if (chunks.length > 0) {
        console.log(`[RETRIEVAL] 📋 Returned chunks:`);
        chunks.forEach((chunk, i) => {
          console.log(`[RETRIEVAL]   ${i + 1}. Score: ${chunk.score.toFixed(4)}, Page: ${chunk.metadata.pageNumber}, Content: "${chunk.content.substring(0, 100)}..."`);
        });
      } else {
        console.log(`[RETRIEVAL] ⚠️ No chunks returned`);
      }

      const citations = chunks.map(chunk => {
        const url = chunk.metadata.sourcePageUrl || chunk.metadata.sourceUrl;
        if (url) {
          return `${url}`;
        }
        return `Page ${chunk.metadata.pageNumber} (${chunk.metadata.filename})`;
      });

      console.log(`[RETRIEVAL] ✅ Retrieval complete: ${chunks.length} chunks returned for query: "${query}"`);

      return {
        query,
        chunks,
        citations,
      };
    } catch (error) {
      console.error(`[RETRIEVAL] ❌ Error in retrieval for query "${query}":`, error);
      return {
        query,
        chunks: [],
        citations: [],
      };
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{ totalChunks: number; uniqueDocuments: number }> {
    // MemoryVectorStore doesn't expose direct access to documents, so we'll estimate
    // In a real implementation, you might want to track this separately
    const uniqueDocs = new Set();
    let totalChunks = 0;

    try {
      // We can't directly access the internal documents, so we'll use a heuristic
      // For now, return basic stats - this could be improved by tracking separately
      console.log(`[RETRIEVAL] Note: MemoryVectorStore stats are approximated`);
      return {
        totalChunks: 0, // Would need to track this separately
        uniqueDocuments: 0,
      };
    } catch (error) {
      console.error(`[RETRIEVAL] Error getting stats:`, error);
      return {
        totalChunks: 0,
        uniqueDocuments: 0,
      };
    }
  }

  /**
   * Inspect collection contents (for debugging/admin purposes)
   */
  async inspect(limit: number = 10, includeEmbeddings: boolean = false): Promise<{
    totalChunks: number;
    uniqueDocuments: number;
    sampleChunks: Array<{
      id: string;
      content: string;
      metadata: any;
      embedding?: number[];
    }>;
  }> {
    const stats = await this.getStats();

    // MemoryVectorStore doesn't expose internal documents for inspection
    console.log(`[RETRIEVAL] Note: MemoryVectorStore doesn't support direct inspection of stored documents`);

    return {
      ...stats,
      sampleChunks: [],
    };
  }

  /**
   * Search by raw text (for inspection/debugging)
   */
  async searchByText(query: string, limit: number = 5): Promise<{
    query: string;
    results: Array<{
      chunk: any;
      score: number;
    }>;
  }> {
    // MemoryVectorStore doesn't support direct text search
    console.log(`[RETRIEVAL] Note: MemoryVectorStore doesn't support direct text search`);
    return { query, results: [] };
  }
}
