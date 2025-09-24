import { TimeSlot } from "@wellness/dto";
import { calendarService } from "../../services/calendar.js";

// Tool argument types
export interface GetAvailabilityArgs {
  preferredDate?: string;
  preferredProvider?: string;
}

// Tool implementation for availability checking
async function getAvailabilityImpl({ preferredDate, preferredProvider }: GetAvailabilityArgs): Promise<TimeSlot[]> {
  // Use Google Calendar service to get available slots
  return await calendarService.getAvailability({
    preferredDate,
    preferredProvider
  });
}

// Tool definition following LangGraph patterns
export const availabilityTool = {
  name: "get_availability",
  description: "Get available appointment slots for wellness clinic. Returns time slots for the next 7 weekdays. This tool simulates database queries to a scheduling system.",
  invoke: getAvailabilityImpl,
};
