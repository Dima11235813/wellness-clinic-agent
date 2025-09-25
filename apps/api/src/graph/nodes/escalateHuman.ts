import { State } from "../schema.js";
import { Deps } from "../deps.js";
import { UiPhase } from "@wellness/dto";
import { AIMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { escalationTool } from "../tools/escalation.js";

export function makeEscalateHumanNode({ logger }: Deps) {
  return async function escalateHumanNode(state: State): Promise<Command> {
    logger.info("escalateHumanNode: Escalating to human representative");

    let escalationReason = '';

    if (state.twoWeekCapExceeded) {
      escalationReason = 'the requested date is beyond our 2-week scheduling limit';
    } else if (state.availableTimesDoNotWork) {
      escalationReason = 'none of the available times work for you';
    } else if (!state.availableSlots || state.availableSlots.length === 0) {
      escalationReason = 'no appointment slots are currently available';
    } else {
      escalationReason = 'we need additional assistance with your request';
    }

    logger.info("escalateHumanNode: Escalation reason determined", {
      reason: escalationReason,
      twoWeekCapExceeded: state.twoWeekCapExceeded,
      availableTimesDoNotWork: state.availableTimesDoNotWork,
      slotCount: state.availableSlots?.length || 0
    });

    const escalationMessage = new AIMessage({
      content: `I understand that ${escalationReason}. A representative will contact you within 15 minutes to assist with your scheduling needs. In the meantime, I can help answer any questions about our wellness clinic policies. What would you like to know?`,
      id: `msg_${Date.now()}`,
      additional_kwargs: {
        at: new Date().toISOString()
      }
    });

    // Escalate to Slack via ToolNode to follow best practices
    const userKey = state.userKey || state.threadId;
    const toolNode: any = new (ToolNode as any)([escalationTool as any]);
    const toolCallId = `tool_${Date.now()}`;

    const aiToolCallMessage: any = new AIMessage({
      content: "",
      tool_calls: [
        {
          name: "escalate_to_slack",
          args: { userKey, reason: escalationReason },
          id: toolCallId,
          type: "tool_call",
        }
      ]
    });

    try {
      const toolInvocationResult: any = await (toolNode as any).invoke({ messages: [aiToolCallMessage] });
      const resultMessages: any[] = (toolInvocationResult && toolInvocationResult.messages) || [];
      const lastToolMsg: any = resultMessages[resultMessages.length - 1];
      const escalationResult = typeof lastToolMsg?.content === 'string' ? JSON.parse(lastToolMsg.content) : lastToolMsg?.content;

      logger.info("escalateHumanNode: Escalation created in Slack", {
        userKey,
        escalationId: escalationResult?.escalationId,
        reason: escalationReason
      });
    } catch (e) {
      logger.error("escalateHumanNode: Error invoking escalation ToolNode", { error: e });
    }

    return new Command({
      update: {
        messages: [...state.messages, escalationMessage],
        uiPhase: UiPhase.Escalated,
        availableTimesDoNotWork: true,
        userEscalated: true,
      }
    });
  };
}