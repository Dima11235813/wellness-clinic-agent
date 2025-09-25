import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { TimeSlot } from "@wellness/dto";

// Tool argument schema
const getAvailabilitySchema = z.object({
  preferredDate: z.string().optional().describe("Preferred date for the appointment (ISO string)"),
  preferredProvider: z.string().optional().describe("Preferred healthcare provider name")
});

// Mock implementation for availability checking
async function getAvailabilityImpl({ preferredDate, preferredProvider }: z.infer<typeof getAvailabilitySchema>): Promise<TimeSlot[]> {
  // Simple mock implementation
  const provider = preferredProvider || 'Dr. Smith';
  const slots: TimeSlot[] = [];
  const now = new Date();

  // Generate 5 mock slots over the next few days
  for (let i = 1; i <= 5; i++) {
    const startTime = new Date(now.getTime() + i * 24 * 60 * 60 * 1000 + (9 + i) * 60 * 60 * 1000); // Next i days at 9+i AM
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes later

    slots.push({
      id: `slot_${i}`,
      startISO: startTime.toISOString(),
      endISO: endTime.toISOString(),
      provider
    });
  }

  return slots;
}

// Tool definition using LangChain tool pattern
export const availabilityTool = {
  name: "get_availability",
  description: "Get available appointment slots for wellness clinic. Returns time slots for the next 7 weekdays. This tool simulates database queries to a scheduling system.",
  schema: getAvailabilitySchema,
  invoke: getAvailabilityImpl
};

// Legacy interface for backward compatibility
export interface GetAvailabilityArgs {
  preferredDate?: string;
  preferredProvider?: string;
}
