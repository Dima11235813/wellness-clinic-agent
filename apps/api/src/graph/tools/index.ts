// Export all tools
export { availabilityTool } from './availability.js';
export { escalationTool } from './escalation.js';
export { rescheduleTool } from './reschedule.js';

// Export types
export type { GetAvailabilityArgs } from './availability.js';
export type { EscalateToSlackArgs } from './escalation.js';
export type { RescheduleAppointmentToolArgs } from './reschedule.js';

// Array of all tools for ToolNode (if we decide to use it later)
import { availabilityTool } from './availability.js';
import { escalationTool } from './escalation.js';
import { rescheduleTool } from './reschedule.js';

export const tools = [availabilityTool, escalationTool, rescheduleTool];

// Subset of tools meant to be exposed to the LLM for agentic invocation
export const agentTools = [];

// Tools interface for nodes to call tools directly
import { TimeSlot } from "@wellness/dto";

export interface PolicyDocument {
  id: string;
  content: string;
  metadata: {
    title: string;
    source: string;
    page?: number;
  };
  score: number;
}

export interface Tools {
  availabilityTool: {
    getAvailability: (args: { preferredDate: string | null; preferredProvider: string | null }) => Promise<TimeSlot[]>
  };
  escalationTool: {
    escalateToSlack: (args: { userKey: string; reason: string }) => Promise<{ success: boolean; escalationId: string }>
  };
  policySearchTool: {
    searchPolicies: (args: { query: string; topK?: number }) => Promise<PolicyDocument[]>
  };
  rescheduleTool: {
    rescheduleAppointment: (args: { eventId: string; newStartTime: string; newEndTime: string; reason: string | null; userKey: string | null; originalSlotId: string | null }) => Promise<{ success: boolean; eventId: string; message: string; originalSlotId?: string }>
  };
}

// Note: createTools is not used anymore - tools are created in app.ts createDeps
