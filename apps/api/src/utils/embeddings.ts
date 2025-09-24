import { OpenAIEmbeddings } from '@langchain/openai';

export class EmbeddingService {
  private embeddings: OpenAIEmbeddings;

  constructor(apiKey: string) {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: apiKey,
      modelName: 'text-embedding-3-small',
    });
  }

  /**
   * Get the embeddings instance for vector stores
   */
  get embedder(): OpenAIEmbeddings {
    return this.embeddings;
  }

  /**
   * Generate embeddings for a single text
   */
  async embedText(text: string): Promise<number[]> {
    const result = await this.embeddings.embedQuery(text);
    return result;
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    const results = await this.embeddings.embedDocuments(texts);
    return results;
  }
}
