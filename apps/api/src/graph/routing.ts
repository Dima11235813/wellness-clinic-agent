import { NodeName } from "@wellness/dto";
import { Deps } from "./deps.js";
import { State } from "./schema.js";

/**
 * Routing function after infer intent node - determines if user wants policy help or scheduling
 */
export function routeAfterInferIntent({ logger }: Deps) {
  return (state: State) => {
    // If there's no user query, don't route anywhere - end the current execution
    if (!state.userQuery || state.userQuery.trim() === '') {
      logger.info('No user query present, ending current execution');
      return "__end__";
    }

    // If user has escalated, always route to policy questions regardless of intent
    if (state.userEscalated) {
      logger.info('User has previously escalated, routing to policy question');
      return NodeName.POLICY_QUESTION;
    }

    if (state.intent === NodeName.OFFER_OPTIONS) {
      logger.info('User intent is scheduling, routing to offer options');
      return NodeName.OFFER_OPTIONS;
    }
    // For now we only have two options, get options for rescheduleing or
    // getting policy information
    // so we can return the policy question node
    logger.info('User intent is policy question or unknown, routing to policy question');
    return NodeName.POLICY_QUESTION;
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
 * Routing function after confirm time
 */
export function routeAfterConfirmTime({ logger }: Deps) {
  return (state: State) => {
    if (state.escalationNeeded) {
      logger.info('User rejected time confirmation, going back to offer options');
      return NodeName.OFFER_OPTIONS;
    }

    logger.info('Time confirmed, proceeding to notify user');
    return NodeName.NOTIFY_USER;
  };
}

