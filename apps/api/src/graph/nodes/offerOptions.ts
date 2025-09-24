import { State } from "../schema.js";
import { TimeSlot, UiPhase } from "@wellness/dto";
import { Deps } from "../deps.js";
import { AIMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";

export function makeOfferOptionsNode({ logger, tools }: Deps) {
  return async function offerOptionsNode(state: State): Promise<Command> {
    logger.info("offerOptionsNode: Fetching available time slots as tool node");

    let fetchedSlots: TimeSlot[] | undefined;

    // Fetch available slots if not already in state
    if (!state.availableSlots || state.availableSlots.length === 0) {
      logger.info("offerOptionsNode: Fetching available slots");
      try {
        fetchedSlots = await tools.availabilityTool.getAvailability({
          preferredDate: state.preferredDate,
          preferredProvider: state.preferredProvider
        });

        if (!fetchedSlots || fetchedSlots.length === 0) {
          logger.warn("offerOptionsNode: No slots available after fetch");
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

        logger.info(`offerOptionsNode: Found ${fetchedSlots.length} available slots`, {
          slots: fetchedSlots.map(slot => ({
            id: slot.id,
            provider: slot.provider,
            startISO: slot.startISO,
            endISO: slot.endISO
          }))
        });

      } catch (error) {
        logger.error("offerOptionsNode: Error fetching availability", { error: error instanceof Error ? error.message : String(error) });
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
    }

    // Determine which slots to use (fetched or existing)
    const allSlots = fetchedSlots || state.availableSlots || [];

    // Limit to first 9 slots for better UX
    const slotsToUse = allSlots.slice(0, 9);

    // Format slots for display in message
    const slotDescriptions = slotsToUse.map(slot => {
      const time = new Date(slot.startISO).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
      return `• ${time} with ${slot.provider}`;
    }).join('\n');

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

    logger.info("offerOptionsNode: Presenting slots to user", {
      slotCount: slotsToUse.length,
      slotsToDisplay: slotsToUse.map(slot => ({
        id: slot.id,
        provider: slot.provider,
        startISO: slot.startISO,
        endISO: slot.endISO
      }))
    });

    // Return command with state updates and slots data for frontend
    // The UI will update to SelectingTime phase and display slots
    // Then confirmTime node will handle the interrupt for user selection
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