import { tool } from '@langchain/core/tools';
import { z } from 'zod';

// Tool argument schema - all fields must be required for OpenAI structured outputs
const getAvailabilitySchema = z.object({
  preferredDate: z.string().nullable().describe("Preferred date for the appointment (ISO string)"),
  preferredProvider: z.string().nullable().describe("Preferred healthcare provider name")
});

// Tool implementation (keep types minimal to avoid deep instantiation)
async function getAvailabilityImpl(input: { preferredDate: string | null; preferredProvider: string | null }) {
  const provider = input.preferredProvider || 'Dr. Smith';
  const now = new Date();
  const slots: Array<{ id: string; startISO: string; endISO: string; provider: string }> = [];

  for (let i = 1; i <= 5; i++) {
    const startTime = new Date(now.getTime() + i * 24 * 60 * 60 * 1000 + (9 + i) * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
    slots.push({ id: `slot_${i}`, startISO: startTime.toISOString(), endISO: endTime.toISOString(), provider });
  }

  return slots;
}

// Tool definition using LangChain tool pattern (relax generics to avoid deep instantiation issues)
export const availabilityTool: any = tool(getAvailabilityImpl as any, {
  name: "get_availability",
  description: "Get available appointment slots for wellness clinic. Returns time slots for the next 7 weekdays. This tool simulates database queries to a scheduling system.",
  schema: getAvailabilitySchema,
});

// Legacy interface for backward compatibility
export interface GetAvailabilityArgs {
  preferredDate: string | null;
  preferredProvider: string | null;
}
