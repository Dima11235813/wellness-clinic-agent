import { NodeName } from "@wellness/dto";
import { Deps } from "./deps.js";
import { State } from "./schema.js";

/**
 * Routing function after infer intent node - determines if user wants policy help or scheduling
 */
export function routeAfterInferIntent({ logger }: Deps) {
  return (state: State) => {

    logger.info('User intent is', { intent: state.intent });

    if (state.intent !== null) {;
      return state.intent
    }
    logger.info('User intent is unknown, routing to end');
    return "__end__";
  };
}


/**
 * Routing function after offer options
 */
export function routeAfterOfferOptions({ logger }: Deps) {
  return (state: State) => {
    if (state.escalationNeeded) {
      logger.info('User escalated from offer options');
      return NodeName.ESCALATE_HUMAN;
    }

    logger.info('Proceeding to confirm time selection');
    return NodeName.CONFIRM_TIME;
  };
}

/**
 * Routing function after offer options agent node
 * Routes to tools if there are tool calls, otherwise to final processing
 */
export function routeAfterOfferOptionsAgent({ logger }: Deps) {
  return (state: State) => {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];

    if (lastMessage && "tool_calls" in lastMessage && (lastMessage as any).tool_calls && (lastMessage as any).tool_calls.length > 0) {
      logger.info('Agent produced tool calls, routing to tools execution');
      return NodeName.OFFER_OPTIONS_TOOLS;
    }

    logger.info('No tool calls needed, routing directly to final processing');
    return NodeName.OFFER_OPTIONS_FINAL;
  };
}

/**
 * Routing function after confirm time
 */
export function routeAfterConfirmTime({ logger }: Deps) {
  return (state: State) => {
    if (state.escalationNeeded) {
      logger.info('User rejected time confirmation, going back to offer options agent');
      return NodeName.OFFER_OPTIONS_AGENT;
    }

    logger.info('Time confirmed, proceeding to notify user');
    return NodeName.NOTIFY_USER;
  };
}

