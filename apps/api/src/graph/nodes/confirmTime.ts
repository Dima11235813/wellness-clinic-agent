import { State } from "../schema.js";
import { InterruptPayload, InterruptKind, UiPhase } from "@wellness/dto";
import { Deps } from "../deps.js";
import { AIMessage } from "@langchain/core/messages";
import { Command, interrupt } from "@langchain/langgraph";

export function makeConfirmTimeNode({ logger, tools }: Deps) {
  return async function confirmTimeNode(state: State): Promise<Command> {
    logger.info("confirmTimeNode: Handling time slot selection and confirmation");

    // If no slot is selected, we need to interrupt to get user selection
    if (!state.selectedSlotId) {
      logger.info("confirmTimeNode: No slot selected, creating interrupt for user selection");

      if (!state.availableSlots || state.availableSlots.length === 0) {
        logger.warn("confirmTimeNode: No available slots to select from");
        return new Command({
          update: {
            uiPhase: UiPhase.SelectingTime,
            escalationNeeded: true
          }
        });
      }

      const interruptPayload: InterruptPayload = {
        kind: InterruptKind.SelectTime,
        slots: state.availableSlots,
        requiresUserAction: true
      };

      logger.info("confirmTimeNode: Creating interrupt for slot selection", {
        slotCount: state.availableSlots.length
      });

      // Create interrupt to pause execution and get user selection
      interrupt(interruptPayload);

      return new Command({
        update: {
          uiPhase: UiPhase.SelectingTime
        }
      });
    }

    // User has selected a slot, proceed with confirmation logic
    if (state.selectedSlotId === 'none') {
      logger.info("confirmTimeNode: User selected 'none of these work', escalating to human");

      const escalationMessage = new AIMessage({
        content: "I understand none of these times work for you. I'll notify a representative to reach out to you directly. In the meantime, feel free to ask me any policy questions you might have.",
        id: `msg_${Date.now()}`,
        additional_kwargs: {
          at: new Date().toISOString()
        }
      });

      return new Command({
        update: {
          messages: [...state.messages, escalationMessage],
          userEscalated: true, // Mark user as escalated to prevent future scheduling
          escalationNeeded: true,
          availableTimesDoNotWork: true,
          selectedSlotId: undefined as any, // Clear the selection
          uiPhase: UiPhase.Escalated // Change to escalated phase
        }
      });
    }

    const selectedSlot = state.availableSlots?.find(slot => slot.id === state.selectedSlotId);
    if (!selectedSlot) {
      logger.warn("confirmTimeNode: Selected slot not found", {
        selectedSlotId: state.selectedSlotId,
        availableSlots: state.availableSlots?.map(s => s.id)
      });
      return new Command({
        update: {
          uiPhase: UiPhase.SelectingTime,
          selectedSlotId: undefined as any // Clear the selection
        }
      });
    }

    // Check if we have a confirmation response from a previous interrupt
    if (state.interrupt?.kind === InterruptKind.ConfirmTime) {
      logger.info("confirmTimeNode: Processing confirmation response");

      // Check if user confirmed or rejected
      const userConfirmed = (state as any).userConfirmed; // This would be set by the resume logic
      if (userConfirmed === false) {
        logger.info("confirmTimeNode: User rejected confirmation");
        return new Command({
          update: {
            uiPhase: UiPhase.SelectingTime,
            escalationNeeded: true, // This will cause routing back to offer_options
            selectedSlotId: undefined as any // Clear the selection
          }
        });
      }

      logger.info("confirmTimeNode: User confirmed selection");

      // If we have an eventId, this is a reschedule - show rescheduling message, then call the reschedule tool
      if (state.eventId && selectedSlot) {
        // Show rescheduling message before calling the tool
        const reschedulingMessage = new AIMessage({
          content: "Rescheduling your appointment...",
          id: `msg_${Date.now()}`,
          additional_kwargs: {
            at: new Date().toISOString()
          }
        });

        logger.info("confirmTimeNode: Calling reschedule tool", {
          eventId: state.eventId,
          newStartTime: selectedSlot.startISO,
          newEndTime: selectedSlot.endISO
        });

        try {
          const rescheduleResult = await tools.rescheduleTool.rescheduleAppointment({
            eventId: state.eventId,
            newStartTime: selectedSlot.startISO,
            newEndTime: selectedSlot.endISO,
            reason: "User requested reschedule via chat",
            originalSlotId: state.selectedSlotId
          });

          if (!rescheduleResult.success) {
            logger.warn("confirmTimeNode: Reschedule failed", {
              eventId: state.eventId,
              message: rescheduleResult.message
            });

            // Create error message and go back to offer options
            const errorMessage = new AIMessage({
              content: `I'm sorry, but I couldn't reschedule your appointment: ${rescheduleResult.message}. Let's try a different time.`,
              id: `msg_${Date.now()}`,
              additional_kwargs: {
                at: new Date().toISOString()
              }
            });

            return new Command({
              update: {
                messages: [...state.messages, errorMessage],
                uiPhase: UiPhase.SelectingTime,
                escalationNeeded: false,
                selectedSlotId: undefined as any // Clear the selection
              }
            });
          }

          logger.info("confirmTimeNode: Reschedule successful", {
            eventId: state.eventId,
            newTime: selectedSlot.startISO
          });

          // Route to notify user with the rescheduling message included
          return new Command({
            update: {
              messages: [...state.messages, reschedulingMessage],
              escalationNeeded: false
            }
          });

        } catch (error) {
          logger.error("confirmTimeNode: Error calling reschedule tool", { error });
          const errorMessage = new AIMessage({
            content: "I encountered an error while rescheduling your appointment. Please try again or contact support.",
            id: `msg_${Date.now()}`,
            additional_kwargs: {
              at: new Date().toISOString()
            }
          });

          return new Command({
            update: {
              messages: [...state.messages, errorMessage],
              uiPhase: UiPhase.SelectingTime,
              escalationNeeded: false,
              selectedSlotId: undefined as any
            }
          });
        }
      }

      return new Command({
        update: {
          escalationNeeded: false
        }
      });
    }

    // Check if user previously declined confirmation
    if (state.escalationNeeded) {
      logger.info("confirmTimeNode: User previously declined confirmation");
      return new Command({
        update: {
          uiPhase: UiPhase.SelectingTime,
          escalationNeeded: false, // Reset for next attempt
          selectedSlotId: undefined as any // Clear the selection
        }
      });
    }

    // Format the selected time for display
    const slotTime = new Date(selectedSlot.startISO);
    const timeString = slotTime.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

    const confirmMessage = new AIMessage({
      content: `Great! I'd like to confirm your appointment for ${timeString} with ${selectedSlot.provider}. Is this correct?`,
      id: `msg_${Date.now()}`,
      additional_kwargs: {
        at: new Date().toISOString(),
        uiPhase: UiPhase.ConfirmingTime
      }
    });

    const interruptPayload: InterruptPayload = {
      kind: InterruptKind.ConfirmTime,
      selectedSlotId: state.selectedSlotId,
      requiresUserAction: true
    };

    logger.info("confirmTimeNode: Creating confirmation interrupt", {
      selectedSlotId: state.selectedSlotId,
      provider: selectedSlot.provider,
      time: timeString
    });

    // Create interrupt to pause execution
    interrupt(interruptPayload);

    // Update state and interrupt execution
    return new Command({
      update: {
        messages: [...state.messages, confirmMessage],
        uiPhase: UiPhase.ConfirmingTime,
        escalationNeeded: false // Reset escalation flag for confirmation flow
      }
    });
  };
}