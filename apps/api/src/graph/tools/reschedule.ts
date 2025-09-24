import { calendarService, RescheduleAppointmentArgs } from "../../services/calendar.js";

// Tool argument types - extending the service args with additional context
export interface RescheduleAppointmentToolArgs extends RescheduleAppointmentArgs {
  userKey?: string; // For tracking/logging purposes
  originalSlotId?: string; // Reference to the original appointment slot
}

// Tool implementation for rescheduling appointments
async function rescheduleAppointmentImpl({
  eventId,
  newStartTime,
  newEndTime,
  reason,
  userKey,
  originalSlotId
}: RescheduleAppointmentToolArgs): Promise<{
  success: boolean;
  eventId: string;
  message: string;
  originalSlotId?: string;
}> {
  console.log(`[RESCHEDULE TOOL] Rescheduling appointment for user ${userKey || 'unknown'}`);

  try {
    const result = await calendarService.rescheduleAppointment({
      eventId,
      newStartTime,
      newEndTime,
      reason
    });

    if (result.success) {
      return {
        success: true,
        eventId,
        message: `Appointment successfully rescheduled to ${new Date(newStartTime).toLocaleString()}${reason ? ` (${reason})` : ''}`,
        originalSlotId
      };
    } else {
      return {
        success: false,
        eventId,
        message: "Unable to reschedule appointment due to scheduling conflicts. Please try a different time.",
        originalSlotId
      };
    }
  } catch (error) {
    console.error("[RESCHEDULE TOOL] Error rescheduling appointment:", error);
    return {
      success: false,
      eventId,
      message: "An error occurred while rescheduling the appointment. Please try again or contact support.",
      originalSlotId
    };
  }
}

// Tool definition following LangGraph patterns
export const rescheduleTool = {
  name: "reschedule_appointment",
  description: "Reschedule an existing wellness clinic appointment to a new time. This tool updates the calendar event and handles conflicts. Use this when a user wants to change their appointment time.",
  invoke: rescheduleAppointmentImpl,
};
