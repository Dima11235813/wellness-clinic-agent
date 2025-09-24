import { State } from "../schema.js";
import { Deps } from "../deps.js";
import { UiPhase } from "@wellness/dto";
import { AIMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { calendarService } from "../../services/calendar.js";

export function makeNotifyUserNode({ logger }: Deps) {
  return async function notifyUserNode(state: State): Promise<Command> {
    logger.info("notifyUserNode: Confirming booking to user");

    if (!state.selectedSlotId || !state.availableSlots) {
      logger.warn("notifyUserNode: No slot to confirm");
      return new Command({ update: {} });
    }

    const selectedSlot = state.availableSlots.find(slot => slot.id === state.selectedSlotId);
    if (!selectedSlot) {
      logger.warn("notifyUserNode: Selected slot not found", {
        selectedSlotId: state.selectedSlotId
      });
      return new Command({ update: {} });
    }

    // Format confirmation message
    const slotTime = new Date(selectedSlot.startISO);
    const timeString = slotTime.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

    // Determine if this is a reschedule or new booking
    const isReschedule = !!state.eventId;
    const actionWord = isReschedule ? 'rescheduled' : 'scheduled';

    const confirmationMessage = new AIMessage({
      content: `Perfect! Your appointment has been ${actionWord} to ${timeString} with ${selectedSlot.provider}. You'll receive a confirmation email shortly. Is there anything else I can help you with regarding policies or appointments?`,
      id: `msg_${Date.now()}`,
      additional_kwargs: {
        at: new Date().toISOString()
      }
    });

    logger.info("notifyUserNode: Booking confirmed", {
      selectedSlotId: state.selectedSlotId,
      provider: selectedSlot.provider,
      time: timeString,
      isReschedule
    });

    // Create the calendar event using Google Calendar service (only for new bookings, not reschedules)
    let event = null;

    if (!isReschedule) {
      try {
        event = await calendarService.createEvent({
        summary: `Wellness Appointment with ${selectedSlot.provider}`,
        start: {
          dateTime: selectedSlot.startISO,
          timeZone: 'America/New_York'
        },
        end: {
          dateTime: selectedSlot.endISO,
          timeZone: 'America/New_York'
        },
        attendees: [{
          email: 'patient@example.com', // In real implementation, this would come from user data
          displayName: 'Patient',
          responseStatus: 'accepted'
        }],
        description: `Wellness clinic appointment scheduled via chat assistant. Provider: ${selectedSlot.provider}`
        });

        logger.info("notifyUserNode: Calendar event created successfully", {
          eventId: event.id,
          startTime: event.start.dateTime
        });

      } catch (error) {
        logger.error("notifyUserNode: Failed to create calendar event", {
          error: error instanceof Error ? error.message : String(error),
          selectedSlotId: state.selectedSlotId
        });

        // Continue with the flow but log the error - in production you might want to escalate
      }
    } else {
      logger.info("notifyUserNode: Skipping calendar creation for reschedule - event already updated");
    }

    return new Command({
      update: {
        messages: [...state.messages, confirmationMessage],
        uiPhase: UiPhase.Chatting,
        userQuery: '', // Clear user query since task is complete
        selectedSlotId: undefined as any, // Clear selected slot
        eventId: undefined as any, // Clear event ID if it was a reschedule
        availableSlots: [], // Clear available slots
        preferredDate: '', // Clear preferences
        preferredProvider: ''
      }
    });
  };
}