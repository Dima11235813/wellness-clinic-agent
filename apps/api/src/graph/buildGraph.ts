import { StateGraph } from "@langchain/langgraph";
import { StateAnnotation } from "./schema.js";
import { NodeName } from "@wellness/dto";
import { Deps } from "./deps.js";
 

// Import node factories
import { makeInferIntentNode } from "./nodes/inferIntent.js";
import { makePolicyQuestionNode } from "./nodes/policyQuestion.js";
import { makeOfferOptionsNode } from "./nodes/offerOptions.js";
import { makeConfirmTimeNode } from "./nodes/confirmTime.js";
import { makeNotifyUserNode } from "./nodes/notifyUser.js";
import { makeEscalateHumanNode } from "./nodes/escalateHuman.js";

// Import routing functions
import {
  routeAfterInferIntent,
  routeAfterOfferOptions,
  routeAfterConfirmTime,
} from "./routing.js";

/**
 * Build the LangGraph StateGraph for the Wellness Clinic Agent
 * Uses proper LangGraph patterns with node factories and conditional routing
 */
export function buildGraph(deps: Deps) {
  const builder = new StateGraph(StateAnnotation)
  // Register nodes using factory pattern
  .addNode(NodeName.INFER_INTENT, makeInferIntentNode(deps))
  .addNode(NodeName.POLICY_QUESTION, makePolicyQuestionNode(deps))
  .addNode(NodeName.OFFER_OPTIONS, makeOfferOptionsNode(deps))
  .addNode(NodeName.CONFIRM_TIME, makeConfirmTimeNode(deps))
  .addNode(NodeName.NOTIFY_USER, makeNotifyUserNode(deps))
  .addNode(NodeName.ESCALATE_HUMAN, makeEscalateHumanNode(deps))
  
  // Define edges
    .addEdge("__start__", NodeName.INFER_INTENT)
    // Conditional routing from INFER_INTENT
    .addConditionalEdges(
      NodeName.INFER_INTENT,
      routeAfterInferIntent(deps),
      [NodeName.POLICY_QUESTION, NodeName.OFFER_OPTIONS, "__end__"]
    )

    // Scheduling flow with conditional routing
    .addConditionalEdges(
      NodeName.OFFER_OPTIONS,
      routeAfterOfferOptions(deps),
      [NodeName.CONFIRM_TIME, NodeName.ESCALATE_HUMAN]
    )
    .addConditionalEdges(
      NodeName.CONFIRM_TIME,
      routeAfterConfirmTime(deps),
      [NodeName.NOTIFY_USER, NodeName.OFFER_OPTIONS]
    )
    .addEdge(NodeName.NOTIFY_USER, NodeName.INFER_INTENT)
    .addEdge(NodeName.ESCALATE_HUMAN, NodeName.INFER_INTENT);

  return builder;
}
