import { TimeSlot } from "@wellness/dto";
import { createMockUserAppointment, generateMockAvailability } from "@wellness/dto/src/mock";
import { calendarService } from "../../services/calendar.js";

// Tool argument types
export interface GetAvailabilityArgs {
  preferredDate?: string;
  preferredProvider?: string;
}

// Tool implementation for availability checking
async function getAvailabilityImpl({ preferredDate, preferredProvider }: GetAvailabilityArgs): Promise<TimeSlot[]> {
  // Default to mock generation until Google Calendar tool is implemented
  const provider = preferredProvider || 'Dr. Smith';
  const appt = createMockUserAppointment(provider);
  return generateMockAvailability(appt, 5, 3);
}

// Tool definition following LangGraph patterns
export const availabilityTool = {
  name: "get_availability",
  description: "Get available appointment slots for wellness clinic. Returns time slots for the next 7 weekdays. This tool simulates database queries to a scheduling system.",
  invoke: getAvailabilityImpl,
};
