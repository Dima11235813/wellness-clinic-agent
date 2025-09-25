import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { calendarService, RescheduleAppointmentArgs } from "../../services/calendar.js";

// Tool argument types - extending the service args with additional context
export interface RescheduleAppointmentToolArgs extends RescheduleAppointmentArgs {
  userKey?: string; // For tracking/logging purposes
  originalSlotId?: string; // Reference to the original appointment slot
}

// Tool argument schema - all fields must be required for OpenAI structured outputs
const rescheduleAppointmentSchema = z.object({
  eventId: z.string().describe("The ID of the existing calendar event to reschedule"),
  newStartTime: z.string().describe("New start time in ISO format"),
  newEndTime: z.string().describe("New end time in ISO format"),
  reason: z.string().nullable().describe("Reason for rescheduling"),
  userKey: z.string().nullable().describe("User identifier for tracking"),
  originalSlotId: z.string().nullable().describe("Reference to the original appointment slot")
});

// Tool implementation for rescheduling appointments
async function rescheduleAppointmentImpl({
  eventId,
  newStartTime,
  newEndTime,
  reason,
  userKey,
  originalSlotId
}: {
  eventId: string;
  newStartTime: string;
  newEndTime: string;
  reason: string | null;
  userKey: string | null;
  originalSlotId: string | null;
}): Promise<{
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
      reason: reason || undefined
    });

    if (result.success) {
      return {
        success: true,
        eventId,
        message: `Appointment successfully rescheduled to ${new Date(newStartTime).toLocaleString()}${reason ? ` (${reason})` : ''}`,
        originalSlotId: originalSlotId || undefined
      };
    } else {
      return {
        success: false,
        eventId,
        message: "Unable to reschedule appointment due to scheduling conflicts. Please try a different time.",
        originalSlotId: originalSlotId || undefined
      };
    }
  } catch (error) {
    console.error("[RESCHEDULE TOOL] Error rescheduling appointment:", error);
    return {
      success: false,
      eventId,
      message: "An error occurred while rescheduling the appointment. Please try again or contact support.",
      originalSlotId: originalSlotId || undefined
    };
  }
}

// Tool definition using LangChain tool pattern
export const rescheduleTool = tool(rescheduleAppointmentImpl, {
  name: "reschedule_appointment",
  description: "Reschedule an existing wellness clinic appointment to a new time. This tool updates the calendar event and handles conflicts. Use this when a user wants to change their appointment time.",
  schema: rescheduleAppointmentSchema,
});
