import { Deps } from '../deps.js';
import { State } from '../schema.js';
import {
  IntentClassifierPrompt,
  IntentParser,
  IntentInferenceResult,
} from '../prompts/intentClassifier.js';
import { GREETING_MESSAGE } from '../prompts/greeting.js';
import { NodeName, UiPhase } from '@wellness/dto';
import { AIMessage } from '@langchain/core/messages';

export function makeInferIntentNode({ logger, tools, llm }: Deps) {
  return async function inferIntentNode(state: State): Promise<Partial<State>> {
    logger.info('inferIntentNode: Processing user input');

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

      logger.info('inferIntentNode: Intent classification result', {
        userQuery: state.userQuery,
        rawIntent: parsed.intent,
        confidence: parsed.confidence,
        reason: parsed.reason
      });

      // Check if intent is clearly classified by the LLM
      if (parsed.intent === NodeName.POLICY_QUESTION || parsed.intent === NodeName.OFFER_OPTIONS_AGENT) {
        // Special handling for escalated users asking about offer options policy
        if (state.userEscalated && parsed.intent === NodeName.OFFER_OPTIONS_AGENT) {
          logger.info('inferIntentNode: Escalated user asking about offer options policy', {
            rawIntent: parsed.intent,
            confidence: parsed.confidence,
            userEscalated: state.userEscalated
          });

          const escalationMessage = new AIMessage({
            content: "I understand you're asking about our offer options policy. Since none of the available times worked for you based on our previous interaction, someone from our team will contact you shortly to assist you further.",
            id: `msg_${Date.now()}`,
            additional_kwargs: {
              at: new Date().toISOString(),
            },
          });

          return {
            messages: [...state.messages, escalationMessage],
            intent: undefined, // Clear intent to prevent routing
            
            userQuery: ''
          };
        }

        // Clear intent for escalated users - routing will handle this
        const finalIntent = state.userEscalated ? undefined : parsed.intent;

        logger.info('inferIntentNode: Intent classified successfully', {
          intent: finalIntent,
          rawIntent: parsed.intent,
          confidence: parsed.confidence,
          userEscalated: state.userEscalated
        });

        return {
          intent: finalIntent,
          userQuery: parsed.intent === NodeName.POLICY_QUESTION ? state.userQuery : '' // Keep userQuery for policy questions, clear for others
        };
      } else {
        // Unclear intent - ask user to try again
        logger.info('inferIntentNode: Intent unclear, asking user to try again', {
          intent: parsed.intent,
          confidence: parsed.confidence
        });

        const clarificationMessage = new AIMessage({
          content: "I'm not sure what you're asking about. Could you please try rephrasing your question? For example, you can ask about appointment scheduling or our wellness policies.",
          id: `msg_${Date.now()}`,
          additional_kwargs: {
            at: new Date().toISOString(),
          },
        });

        return {
          messages: [...state.messages, clarificationMessage],
          userQuery: '' // Clear userQuery to avoid cycles
        };
      }
    } catch (error) {
      logger.error('inferIntentNode: Error in intent inference', { error });

      const errorMessage = new AIMessage({
        content: "I'm having trouble understanding your question. Could you please try rephrasing it? You can ask about appointment scheduling or our wellness policies.",
        id: `msg_${Date.now()}`,
        additional_kwargs: {
          at: new Date().toISOString(),
        },
      });

      return {
        messages: [...state.messages, errorMessage],
        userQuery: '' // Clear userQuery to avoid cycles
      };
    }
  };
}
