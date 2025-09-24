import { RetrievedChunk } from '../services/retrieval.js';

export interface PolicyQuestionPromptInput {
  userQuery: string;
  context: RetrievedChunk[];
}

export class PolicyQuestionPrompt {
  static noInformationMessage = "I don't have information about that in our policy documents, please call our clinic directly at (555) 123-4567 to speak with a representative who can assist you.";
  /**
   * Build a prompt for answering policy questions with retrieved context
   */
  static build(input: PolicyQuestionPromptInput): string {
    const { userQuery, context } = input;

    // Format context from retrieved chunks
    const contextText = context
      .map(chunk => `[Page ${chunk.metadata.pageNumber}] ${chunk.content}`)
      .join('\n\n');

    const prompt = `You are a helpful assistant for the wellness clinic. Answer the user's question about clinic policies using ONLY the provided context information.

IMPORTANT RULES:
- Answer using ONLY information from the provided context
- If the context doesn't contain information to answer the question, say "${PolicyQuestionPrompt.noInformationMessage}"
- Be concise but complete
- Include specific details like page numbers when relevant
- Do not make up information or use external knowledge

Context from policy documents:
${contextText}

User Question: ${userQuery}

Answer:`;

    return prompt;
  }

  /**
   * Extract answer from LLM response
   */
  static extractAnswer(llmResponse: string): string {
    // Clean up the response - remove any extra formatting
    return llmResponse.trim();
  }

  /**
   * Check if the chunks indicate no information available, either there are no chunks 
   * or the chunks have an average score over below .3
   */
  static hasNoInformation(chunks: RetrievedChunk[]): boolean {
    const averageScore = chunks.reduce((sum, chunk) => sum + chunk.score, 0) / chunks.length;
    return chunks.length === 0 || averageScore < 0.3;
  }
}
