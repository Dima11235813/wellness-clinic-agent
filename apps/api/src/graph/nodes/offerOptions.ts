import { State } from "../schema.js";
import { TimeSlot, AvailabilityResponse, UiPhase, InterruptPayload, InterruptKind, NodeName } from "@wellness/dto";
import { Deps } from "../deps.js";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { Command, interrupt } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { availabilityTool } from "../tools/availability.js";

/**
 * Agent node that calls the LLM with availability tool bound
 * This follows the ToolNode pattern from LangGraph docs
 */
export function makeOfferOptionsAgentNode({ logger, llm }: Deps) {
  return async function offerOptionsAgentNode(state: State): Promise<Partial<State>> {
    logger.info("offerOptionsAgentNode: Calling LLM with availability tool");

    // Bind the availability tool to the LLM
    const llmWithTools = (llm as any).bindTools([availabilityTool]);

    // Create a human message asking the LLM to find availability
    const humanMessage = new HumanMessage({
      content: `Find available appointment times for this user. Use their preferred date (${state.preferredDate || 'any date'}) and provider (${state.preferredProvider || 'any provider'}).`
    });

    // Include prior conversation for better grounding per ToolNode docs
    // Narrow the message history to a safe size to avoid deep type instantiation
    const priorMessages = (state.messages || []).slice(-10);
    const response = await (llmWithTools as any).invoke([...priorMessages, humanMessage] as any);

    logger.info("offerOptionsAgentNode: LLM response", {
      hasToolCalls: (response as any).tool_calls && (response as any).tool_calls.length > 0,
      toolCalls: (response as any).tool_calls
    });

    return {
      messages: [response]
    };
  };
}

/**
 * Tools node that executes tool calls using ToolNode
 * This follows the ToolNode pattern from LangGraph docs
 */
export function makeOfferOptionsToolsNode({ logger }: Deps) {
  // Create ToolNode with the availability tool; relax generics to avoid deep instantiation issues
  const toolNode: any = new (ToolNode as any)([availabilityTool as any]);

  return async function offerOptionsToolsNode(state: State): Promise<Partial<State>> {
    logger.info("offerOptionsToolsNode: Executing tool calls via ToolNode");

    // ToolNode handles the execution of tool calls automatically
    const result = await (toolNode as any).invoke(state as any);
    return result as Partial<State>;
  };
}

/**
 * Final processing node that formats the results and updates UI state
 * This processes the tool results and creates the final message for the user
 */
export function makeOfferOptionsFinalNode({ logger }: Deps) {
  return async function offerOptionsFinalNode(state: State): Promise<Command> {
    logger.info("offerOptionsFinalNode: Processing tool results");

    const { messages, selectedSlotId } = state;

    // If we have a selectedSlotId, we're resuming from an interrupt
    if (selectedSlotId) {
      logger.info("offerOptionsFinalNode: Resuming from interrupt with selection", {
        selectedSlotId
      });

      if (selectedSlotId === 'none') {
        // User indicated none of the times work - escalate
        logger.info("offerOptionsFinalNode: User selected 'none', escalating");
        return new Command({
          goto: NodeName.ESCALATE_HUMAN
        });
      } else {
        // User selected a time - proceed to confirmation
        logger.info("offerOptionsFinalNode: User selected time, proceeding to confirmation");
        return new Command({
          goto: NodeName.CONFIRM_TIME
        });
      }
    }

    // Find the last tool message with availability results
    const toolMessages = messages.filter(msg => msg._getType() === "tool");
    const lastToolMessage = toolMessages[toolMessages.length - 1];

    if (!lastToolMessage) {
      logger.error("offerOptionsFinalNode: No tool results found");
      const errorMessage = new AIMessage({
        content: "I encountered an error while checking availability. Would you like me to escalate this to our clinic staff?",
        id: `msg_${Date.now()}`,
        additional_kwargs: {
          at: new Date().toISOString()
        }
      });
      return new Command({
        update: {
          messages: [...state.messages, errorMessage],
          availableSlots: [],
          escalationNeeded: true,
          availableTimesDoNotWork: true
        }
      });
    }

    // Parse the tool results - content might be already parsed array or string
    let slots: TimeSlot[] = [];
    try {
      logger.info("offerOptionsFinalNode: Processing tool results", { content: lastToolMessage.content });

      if (Array.isArray(lastToolMessage.content)) {
        // Content is already parsed as an array
        slots = lastToolMessage.content as TimeSlot[];
      } else if (typeof lastToolMessage.content === 'string') {
        // Content is a JSON string that needs parsing
        const parsed = JSON.parse(lastToolMessage.content);
        slots = Array.isArray(parsed) ? parsed : parsed.slots || [];
      } else {
        // Content is an object with slots property
        const response = lastToolMessage.content as AvailabilityResponse;
        slots = response.slots || [];
      }
    } catch (error) {
      logger.error("offerOptionsFinalNode: Failed to process tool results", { content: lastToolMessage.content, error: error instanceof Error ? error.message : String(error) });
      const errorMessage = new AIMessage({
        content: "Our scheduling service is down right now, but you can still ask me questions about our policies.",
        id: `msg_${Date.now()}`,
        additional_kwargs: {
          at: new Date().toISOString()
        }
      });
      return new Command({
        update: {
          messages: [...state.messages, errorMessage],
          availableSlots: [],
          escalationNeeded: true,
          availableTimesDoNotWork: true
        }
      });
    }

    if (!slots || slots.length === 0) {
      logger.warn("offerOptionsFinalNode: No slots available");
      const noSlotsMessage = new AIMessage({
        content: "I'm sorry, but I don't see any available appointment times right now. Would you like me to escalate this to our clinic staff?",
        id: `msg_${Date.now()}`,
        additional_kwargs: {
          at: new Date().toISOString()
        }
      });
      return new Command({
        update: {
          messages: [...state.messages, noSlotsMessage],
          availableSlots: [],
          escalationNeeded: true,
          availableTimesDoNotWork: true
        }
      });
    }

    // Limit to first 9 slots for better UX
    const slotsToUse = slots.slice(0, 9);

    logger.info("offerOptionsFinalNode: Presenting slots to user", {
      slotCount: slotsToUse.length,
      slotsToDisplay: slotsToUse.map(slot => ({
        id: slot.id,
        provider: slot.provider,
        startISO: slot.startISO,
        endISO: slot.endISO
      }))
    });

    // Send initial message about fetching slots, including slot data for UI
    const fetchingMessage = new AIMessage({
      content: `Let me check available appointment times for you...`,
      id: `msg_${Date.now()}`,
      additional_kwargs: {
        at: new Date().toISOString(),
        slots: slotsToUse, // Include slots for frontend to display
        uiPhase: UiPhase.SelectingTime
      }
    });

    // Create interrupt to wait for user to select a time or indicate none work
    const interruptPayload: InterruptPayload = {
      kind: InterruptKind.SelectTime,
      slots: slotsToUse,
      requiresUserAction: true
    };

    logger.info("offerOptionsFinalNode: Creating interrupt for time selection", {
      slotCount: slotsToUse.length
    });

    // Create interrupt to pause execution and get user selection
    // Return command with state updates and interrupt to pause execution
    return new Command({
      update: {
        messages: [...state.messages, fetchingMessage],
        uiPhase: UiPhase.SelectingTime,
        availableSlots: slotsToUse,
        escalationNeeded: false,
        availableTimesDoNotWork: false,
        interrupt: interruptPayload
      }
    });
  };
}