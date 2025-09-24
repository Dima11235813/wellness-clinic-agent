import { RetrievedChunk } from '../services/retrieval.js';

export interface PolicyValidationPromptInput {
  userQuery: string;
  context: RetrievedChunk[];
  proposedAnswer: string;
}

export interface ValidationResult {
  isValid: boolean;
  reasoning: string;
  confidence: number; // 0-1 scale
}

export class PolicyValidationPrompt {
  /**
   * Build a prompt for validating policy answers using LLM as judge
   */
  static build(input: PolicyValidationPromptInput): string {
    const { userQuery, context, proposedAnswer } = input;

    // Format context for validation
    const contextText = context
      .map(chunk => `[Page ${chunk.metadata.pageNumber}] ${chunk.content}`)
      .join('\n\n');

    const prompt = `You are an expert validator for wellness clinic policy answers. Your task is to determine if a proposed answer is fully supported by the provided context.

QUESTION: ${userQuery}

PROPOSED ANSWER: ${proposedAnswer}

CONTEXT FROM POLICY DOCUMENTS:
${contextText}

VALIDATION TASK:
Analyze whether the proposed answer:
1. Is fully supported by information in the context
2. Does not contradict any information in the context
3. Does not include information not present in the context
4. Directly addresses the user's question

Respond with a JSON object in this exact format:
{
  "isValid": boolean,
  "reasoning": "brief explanation of your decision",
  "confidence": number between 0 and 1
}

Examples:
- If answer uses information not in context: {"isValid": false, "reasoning": "Answer includes information not present in the provided context", "confidence": 0.9}
- If answer contradicts context: {"isValid": false, "reasoning": "Answer contradicts information in context", "confidence": 0.95}
- If answer is fully supported: {"isValid": true, "reasoning": "Answer is directly supported by context information", "confidence": 0.85}`;

    return prompt;
  }

  /**
   * Parse validation result from LLM response
   */
  static parseValidationResult(llmResponse: string): ValidationResult {
    try {
      // Try to extract JSON from response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          isValid: false,
          reasoning: 'Failed to parse validation response',
          confidence: 0.0
        };
      }

      const result = JSON.parse(jsonMatch[0]);

      // Validate the result structure
      if (typeof result.isValid !== 'boolean' ||
          typeof result.reasoning !== 'string' ||
          typeof result.confidence !== 'number') {
        throw new Error('Invalid validation result structure');
      }

      return {
        isValid: result.isValid,
        reasoning: result.reasoning,
        confidence: Math.max(0, Math.min(1, result.confidence)) // Clamp to 0-1
      };
    } catch (error) {
      console.error('Failed to parse validation result:', error);
      return {
        isValid: false,
        reasoning: 'Failed to validate answer format',
        confidence: 0.0
      };
    }
  }

  /**
   * Check if validation indicates the answer should be rejected
   */
  static shouldRejectAnswer(validation: ValidationResult): boolean {
    // Reject if invalid or low confidence
    return !validation.isValid || validation.confidence < 0.5;
  }
}
