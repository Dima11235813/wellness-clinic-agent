import { interrupt, Command } from '@langchain/langgraph';
import { Deps } from '../deps.js';
import { State } from '../schema.js';
import {
  IntentClassifierPrompt,
  IntentParser,
  IntentInferenceResult,
} from '../prompts/intentClassifier.js';
import { GREETING_MESSAGE } from '../prompts/greeting.js';
import { IntentResult } from '../tools.js';
import { NodeName, UiPhase } from '@wellness/dto';
import { AIMessage, HumanMessage, isAIMessage, ToolMessage } from '@langchain/core/messages';

export function makeInferIntentNode({ logger, tools, llm }: Deps) {
  return async function inferIntentNode(state: State): Promise<Partial<State>> {
    logger.info('inferIntentNode: Processing user input with LLM');

    if (!state.userQuery || state.userQuery.trim() === '') {
      logger.info('inferIntentNode: No user query present');

      // Only show greeting on first interaction (when no messages exist)
      const hasExistingMessages = state.messages && state.messages.length > 0;

      if (!hasExistingMessages) {
        logger.info('inferIntentNode: First interaction, showing greeting');
        const welcomeMessage = new AIMessage({
          content: GREETING_MESSAGE,
          id: `msg_${Date.now()}`,
          additional_kwargs: {
            at: new Date().toISOString(),
          },
        });

        return {
          messages: [welcomeMessage],
          uiPhase: UiPhase.Chatting
        };
      } else {
        logger.info('inferIntentNode: Existing conversation, waiting for new user input');
        // Return minimal update - routing will handle ending execution
        return {
          uiPhase: UiPhase.Chatting
        };
      }
    }
    const prompt = await IntentClassifierPrompt.partial({
      formatInstructions: IntentParser.getFormatInstructions(),
    });

    const chain = prompt.pipe(llm).pipe(IntentParser);

    try {
      const parsed = (await chain.invoke({
        userQuery: state.userQuery ?? '',
      })) as IntentInferenceResult;

      const intentResult: IntentResult = {
        intent:
          parsed.intent === NodeName.OFFER_OPTIONS || parsed.intent === NodeName.POLICY_QUESTION
            ? (parsed.intent as IntentResult['intent'])
            : 'unknown',
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0)),
        reason: parsed.reason ?? 'No reason provided',
      };

      logger.info('inferIntentNode: Intent classification result', {
        userQuery: state.userQuery,
        classifiedIntent: intentResult.intent,
        rawIntent: parsed.intent,
        confidence: intentResult.confidence,
        reason: intentResult.reason
      });

      // Create appropriate message based on intent
      let intentMessage: AIMessage;
      if (intentResult.intent === NodeName.OFFER_OPTIONS) {
        intentMessage = new AIMessage({
          content: "I understand you'd like to check available appointment times. Let me look up the available slots for you.",
          id: `msg_${Date.now()}`,
          additional_kwargs: {
            at: new Date().toISOString(),
          },
        });
      } else {
        intentMessage = new AIMessage({
          content: "I understand you're asking about our policies. Let me research that for you.",
          id: `msg_${Date.now()}`,
          additional_kwargs: {
            at: new Date().toISOString(),
          },
        });
      }

      return {
        messages: [...state.messages, intentMessage],
        intent: intentResult.intent === NodeName.OFFER_OPTIONS ? NodeName.OFFER_OPTIONS :
                intentResult.intent === NodeName.POLICY_QUESTION ? NodeName.POLICY_QUESTION :
                NodeName.POLICY_QUESTION,
        uiPhase: intentResult.intent === NodeName.OFFER_OPTIONS ? UiPhase.SelectingTime : UiPhase.Chatting
      };
    } catch (error) {
      logger.error('inferIntentNode: Error in intent inference', { error });
      const errorMessage = new AIMessage({
        content: "I understand you're asking about our policies. Let me research that for you.",
        id: `msg_${Date.now()}`,
        additional_kwargs: {
          at: new Date().toISOString(),
        },
      });
      return {
        messages: [...state.messages, errorMessage],
        intent: NodeName.POLICY_QUESTION,
        uiPhase: UiPhase.Chatting
      };
    }
  };
}
