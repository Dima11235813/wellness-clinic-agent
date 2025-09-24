import { State } from '../schema.js';
import { Deps } from '../deps.js';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { Command } from '@langchain/langgraph';
import { NodeName, UiPhase } from '@wellness/dto';
import { PolicyQuestionPrompt } from '../../prompts/policyQuestion.js';
import { PolicyValidationPrompt } from '../../prompts/policyValidation.js';

export function makePolicyQuestionNode({ logger, llm, retrievalService }: Deps) {
  return async function policyQuestionNode(state: State): Promise<Command> {
    logger.info('policyQuestionNode: Processing policy question');

    if (state.userQuery) {
      const userQuery = state.userQuery;

      // Add a "thinking" message to show we're researching
      const thinkingMessage = new AIMessage({
        content: "Let me research that policy question for you...",
        id: `msg_${Date.now()}_thinking`,
        additional_kwargs: {
          at: new Date().toISOString(),
        },
      });

      // Use vector search to find relevant policy documents
      logger.info('policyQuestionNode: Searching for relevant policy documents', {
        query: userQuery,
      });

      const retrievalResult = await retrievalService.retrieve(userQuery, 5);

      logger.info('policyQuestionNode: Retrieval results', {
        query: userQuery,
        chunksFound: retrievalResult.chunks.length,
        citations: retrievalResult.citations,
      });

      if (retrievalResult.chunks.length === 0) {
        logger.warn('policyQuestionNode: No relevant policy documents found', {
          query: userQuery,
        });

        // No relevant data found - redirect back to beginning
        const noDataAiMessage = new AIMessage({
          content: PolicyQuestionPrompt.noInformationMessage,
          id: `msg_${Date.now()}`,
          additional_kwargs: {
            at: new Date().toISOString(),
          },
        });

        return new Command({
          update: {
            messages: [...state.messages, thinkingMessage, noDataAiMessage],
            // Keep userQuery for conversation history
            uiPhase: UiPhase.Chatting,
          },
        });
      }

      // Found relevant documents - generate answer using structured prompt
      logger.info('policyQuestionNode: Found relevant documents, generating answer', {
        query: userQuery,
        chunksFound: retrievalResult.chunks.length,
      });

      // Build policy question prompt
      const questionPrompt = PolicyQuestionPrompt.build({
        userQuery,
        context: retrievalResult.chunks,
      });

      // Generate answer using LLM
      const llmResponse = await llm.invoke([
        { role: 'system', content: 'You are a helpful assistant for the wellness clinic.' },
        { role: 'user', content: questionPrompt },
      ]);

      const rawAnswer = llmResponse.content as string;
      const cleanAnswer = PolicyQuestionPrompt.extractAnswer(rawAnswer);
      //const hasNoInformation = PolicyQuestionPrompt.hasNoInformation(retrievalResult.chunks);
      logger.info('policyQuestionNode: Generated raw answer', {
        query: userQuery,
        rawAnswerLength: rawAnswer.length,
        cleanAnswerLength: cleanAnswer.length,
        //hasNoInformation: hasNoInformation,
      });

      // Check if the answer indicates no information is available
      // if (hasNoInformation) {
      //   logger.warn('policyQuestionNode: Answer indicates no information available', {
      //     query: userQuery,
      //     answer: cleanAnswer,
      //   });

      //   const noInfoMessage = new AIMessage({
      //     content:
      //       "I don't have specific information about that in our policy documents. For detailed policy questions, please call our clinic directly at (555) 123-4567 to speak with a representative.",
      //     id: `msg_${Date.now()}`,
      //     additional_kwargs: {
      //       at: new Date().toISOString(),
      //       cleanAnswer: cleanAnswer,
      //     },
      //   });

      //   return new Command({
      //     update: {
      //       messages: [...state.messages, noInfoMessage],
      //       // Keep userQuery for conversation history
      //       uiPhase: 'Chatting',
      //       cleanAnswer: cleanAnswer,
      //     },
      //   });
      // }

      // Validate the answer using LLM as judge
      logger.info('policyQuestionNode: Validating answer with LLM judge', {
        query: userQuery,
        answerLength: cleanAnswer.length,
      });

      const validationPrompt = PolicyValidationPrompt.build({
        userQuery,
        context: retrievalResult.chunks,
        proposedAnswer: cleanAnswer,
      });

      const validationResponse = await llm.invoke([
        { role: 'system', content: 'You are an expert validator for policy answers.' },
        { role: 'user', content: validationPrompt },
      ]);

      const validationResult = PolicyValidationPrompt.parseValidationResult(
        validationResponse.content as string,
      );

      logger.info('policyQuestionNode: Validation result', {
        query: userQuery,
        isValid: validationResult.isValid,
        confidence: validationResult.confidence,
        reasoning: validationResult.reasoning,
      });
      const shouldRejectAnswer = PolicyValidationPrompt.shouldRejectAnswer(validationResult);
      logger.info('policyQuestionNode: Should reject answer due to low confidence', {
        query: userQuery,
        shouldRejectAnswer: shouldRejectAnswer,
        confidence: validationResult.confidence,
        validationResult: validationResult,
      });
      // Check if validation indicates we should rewrite the answer more conservatively
      if (shouldRejectAnswer) {
        logger.warn('policyQuestionNode: Answer validation failed, rewriting with conservative approach', {
          query: userQuery,
          validation: validationResult,
        });

        // Rewrite the answer using a more conservative approach that only uses retrieved context
        const conservativeSystem = `You are a helpful assistant for a university wellness clinic. Answer policy-related questions using ONLY the provided context from our policy documents.

CRITICAL INSTRUCTIONS:
- Only use information explicitly stated in the provided context
- If the context doesn't contain enough information to fully answer the question, clearly state what information is available and what is not
- Do not make assumptions or inferences beyond what's explicitly stated
- Be conservative and precise - it's better to provide limited but accurate information than potentially incorrect information
- If the question cannot be fully answered from the context, recommend consulting clinic staff

Context from policy documents:
${retrievalResult.chunks.map(chunk =>
  `Document: Policy Section (Page ${chunk.metadata.pageNumber})\nContent: ${chunk.content}\nRelevance Score: ${chunk.score.toFixed(2)}`
).join('\n\n')}`;

        const conservativeMessages = [
          new HumanMessage({ content: `${conservativeSystem}\n\nUser question: ${userQuery}\n\nPlease provide a conservative answer using only the information available in the context above.` })
        ];

        logger.info('policyQuestionNode: Rewriting answer with conservative approach');
        const conservativeAi = await llm.invoke(conservativeMessages);

        const conservativeAnswer = typeof conservativeAi.content === 'string'
          ? conservativeAi.content
          : Array.isArray(conservativeAi.content)
          ? conservativeAi.content.map((c: any) => (typeof c === 'string' ? c : c.text || '')).join('\n')
          : '';

        logger.info('policyQuestionNode: Conservative answer generated', {
          query: userQuery,
          conservativeAnswerLength: conservativeAnswer.length,
        });

        const conservativeMessage = new AIMessage({
          content: conservativeAnswer,
          id: `msg_${Date.now()}`,
          additional_kwargs: {
            at: new Date().toISOString(),
            citations: retrievalResult.citations,
            validationNote: 'This answer was generated using a conservative approach due to validation concerns.'
          },
        });

        return new Command({
          update: {
            messages: [...state.messages, thinkingMessage, conservativeMessage],
            // Keep userQuery for conversation history
            uiPhase: UiPhase.Chatting,
            retrievedDocs: retrievalResult.chunks,
          },
        });
      }

      // Answer passed validation - return it to user
      const answerMessage = new AIMessage({
        content: cleanAnswer,
        id: `msg_${Date.now()}`,
        additional_kwargs: {
          at: new Date().toISOString(),
          citations: retrievalResult.citations
        },
      });

      logger.info('policyQuestionNode: ✅ Answer validated and approved', {
        query: userQuery,
        answerLength: cleanAnswer.length,
        citations: retrievalResult.citations.length,
        validatedAswer: cleanAnswer,
      });

      return new Command({
        update: {
          messages: [...state.messages, thinkingMessage, answerMessage],
          uiPhase: UiPhase.Chatting,
          // Keep userQuery for conversation history
          retrievedDocs: [],
          validatedAswer: '',
        },
      });
    }

    logger.info('policyQuestionNode: No user message found');
    // Persist the state
    return new Command({
      goto: NodeName.INFER_INTENT,
      update: {
        uiPhase: UiPhase.Chatting,
      },
    });
  };
}
