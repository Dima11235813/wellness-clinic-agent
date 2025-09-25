import { StateGraph } from "@langchain/langgraph";
import { StateAnnotation } from "./schema.js";
import { NodeName } from "@wellness/dto";
import { Deps } from "./deps.js";


// Import node factories
import { makeInferIntentNode } from "./nodes/inferIntent.js";
import { makePolicyQuestionNode } from "./nodes/policyQuestion.js";
import {
  makeOfferOptionsAgentNode,
  makeOfferOptionsToolsNode,
  makeOfferOptionsFinalNode
} from "./nodes/offerOptions.js";
import { makeConfirmTimeNode } from "./nodes/confirmTime.js";
import { makeNotifyUserNode } from "./nodes/notifyUser.js";
import { makeEscalateHumanNode } from "./nodes/escalateHuman.js";

// Import routing functions
import {
  routeAfterInferIntent,
  routeAfterOfferOptions,
  routeAfterConfirmTime,
  routeAfterOfferOptionsAgent,
} from "./routing.js";

/**
 * Build the LangGraph StateGraph for the Wellness Clinic Agent
 * Uses proper LangGraph patterns with node factories and conditional routing
 */
export function buildGraph(deps: Deps) {
  const builder = new StateGraph(StateAnnotation)
  // Register nodes using factory pattern
  .addNode(NodeName.INFER_INTENT, makeInferIntentNode(deps))
  .addNode(NodeName.POLICY_QUESTION, makePolicyQuestionNode(deps), { ends: [NodeName.INFER_INTENT] })
  .addNode(NodeName.OFFER_OPTIONS_AGENT, makeOfferOptionsAgentNode(deps))
  .addNode(NodeName.OFFER_OPTIONS_TOOLS, makeOfferOptionsToolsNode(deps))
  // OFFER_OPTIONS_FINAL routes via addConditionalEdges below; no ends needed since node does not return goto
  .addNode(NodeName.OFFER_OPTIONS_FINAL, makeOfferOptionsFinalNode(deps))
  // These nodes do not return goto; routing is defined by edges below
  .addNode(NodeName.CONFIRM_TIME, makeConfirmTimeNode(deps))
  .addNode(NodeName.NOTIFY_USER, makeNotifyUserNode(deps))
  .addNode(NodeName.ESCALATE_HUMAN, makeEscalateHumanNode(deps))

  // Define edges
    .addEdge("__start__", NodeName.INFER_INTENT)
    // Conditional routing from INFER_INTENT
    .addConditionalEdges(
      NodeName.INFER_INTENT,
      routeAfterInferIntent(deps),
      [NodeName.POLICY_QUESTION, NodeName.OFFER_OPTIONS_AGENT, "__end__"]
    )
    // Ensure policy flow returns to infer intent after answering
    .addEdge(NodeName.POLICY_QUESTION, NodeName.INFER_INTENT)

    // Scheduling flow with ToolNode pattern
    .addConditionalEdges(
      NodeName.OFFER_OPTIONS_AGENT,
      routeAfterOfferOptionsAgent(deps),
      [NodeName.OFFER_OPTIONS_TOOLS, NodeName.OFFER_OPTIONS_FINAL]
    )
    .addEdge(NodeName.OFFER_OPTIONS_TOOLS, NodeName.OFFER_OPTIONS_FINAL)
    .addConditionalEdges(
      NodeName.OFFER_OPTIONS_FINAL,
      routeAfterOfferOptions(deps),
      [NodeName.ESCALATE_HUMAN, NodeName.CONFIRM_TIME]
    )

    .addConditionalEdges(
      NodeName.CONFIRM_TIME,
      routeAfterConfirmTime(deps),
      [NodeName.NOTIFY_USER, NodeName.OFFER_OPTIONS_AGENT]
    )
    .addEdge(NodeName.NOTIFY_USER, NodeName.INFER_INTENT)
    .addEdge(NodeName.ESCALATE_HUMAN, NodeName.INFER_INTENT);

  return builder;
}
