import { State } from "../schema.js";
import { TimeSlot, UiPhase } from "@wellness/dto";
import { Deps } from "../deps.js";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { availabilityTool } from "../tools/availability.js";

/**
 * Agent node that calls the LLM with availability tool bound
 * This follows the ToolNode pattern from LangGraph docs
 */
export function makeOfferOptionsAgentNode({ logger, llm }: Deps) {
  return async function offerOptionsAgentNode(state: State) {
    logger.info("offerOptionsAgentNode: Calling LLM with availability tool");

    // Bind the availability tool to the LLM
    const llmWithTools = (llm as any).bindTools([availabilityTool]);

    // Create a human message asking the LLM to find availability
    const humanMessage = new HumanMessage({
      content: `Find available appointment times for this user. Use their preferred date (${state.preferredDate || 'any date'}) and provider (${state.preferredProvider || 'any provider'}).`
    });

    // Call the LLM with the tool
    const response = await llmWithTools.invoke([humanMessage]);

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
  return async function offerOptionsToolsNode(state: State) {
    logger.info("offerOptionsToolsNode: Executing tool calls");

    const { messages } = state;
    const lastMessage = messages[messages.length - 1];

    // Check if there are tool calls to execute
    if (!lastMessage || !("tool_calls" in lastMessage) || !(lastMessage as any).tool_calls?.length) {
      logger.warn("offerOptionsToolsNode: No tool calls found in last message");
      throw new Error("No tool calls to execute");
    }

    // Execute the tool calls (in this case, just availability tool)
    const toolResults = [];

    for (const toolCall of (lastMessage as any).tool_calls) {
      if (toolCall.name === "get_availability") {
        try {
          logger.info("offerOptionsToolsNode: Calling availability tool", { args: toolCall.args });
          const result = await availabilityTool.invoke(toolCall.args);
          toolResults.push({
            tool_call_id: toolCall.id,
            content: JSON.stringify(result), // ToolNode expects string content
            name: toolCall.name
          });
        } catch (error) {
          logger.error("offerOptionsToolsNode: Error executing availability tool", {
            error: error instanceof Error ? error.message : String(error)
          });
          toolResults.push({
            tool_call_id: toolCall.id,
            content: "Error fetching availability",
            name: toolCall.name
          });
        }
      }
    }

    // Create ToolMessage objects
    const toolMessages = toolResults.map(result => new ToolMessage({
      tool_call_id: result.tool_call_id,
      content: result.content,
      name: result.name
    }));

    return {
      messages: toolMessages
    };
  };
}

/**
 * Final processing node that formats the results and updates UI state
 * This processes the tool results and creates the final message for the user
 */
export function makeOfferOptionsFinalNode({ logger }: Deps) {
  return async function offerOptionsFinalNode(state: State): Promise<Command> {
    logger.info("offerOptionsFinalNode: Processing tool results");

    const { messages } = state;

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

    // Parse the tool results
    let slots: TimeSlot[] = [];
    try {
      slots = JSON.parse(lastToolMessage.content as string);
    } catch (error) {
      logger.error("offerOptionsFinalNode: Failed to parse tool results", { content: lastToolMessage.content });
      const errorMessage = new AIMessage({
        content: "I encountered an error processing availability data. Would you like me to escalate this to our clinic staff?",
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

    // Return command with state updates and slots data for frontend
    return new Command({
      update: {
        messages: [...state.messages, fetchingMessage],
        uiPhase: UiPhase.SelectingTime,
        availableSlots: slotsToUse,
        escalationNeeded: false,
        availableTimesDoNotWork: false
      }
    });
  };
}