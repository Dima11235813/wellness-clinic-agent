// Export all tools
export { availabilityTool } from './availability.js';
export { escalationTool } from './escalation.js';
export { intentInferenceTool, getUserIntent } from './intentInference.js';
export { rescheduleTool } from './reschedule.js';

// Export types
export type { GetAvailabilityArgs } from './availability.js';
export type { EscalateToSlackArgs } from './escalation.js';
export type { InferIntentArgs, IntentResult } from './intentInference.js';
export type { RescheduleAppointmentToolArgs } from './reschedule.js';

// Array of all tools for ToolNode (if we decide to use it later)
import { availabilityTool } from './availability.js';
import { escalationTool } from './escalation.js';
import { intentInferenceTool, getUserIntent } from './intentInference.js';
import { rescheduleTool } from './reschedule.js';

export const tools = [availabilityTool, escalationTool, intentInferenceTool, rescheduleTool];

// Subset of tools meant to be exposed to the LLM for agentic invocation
export const agentTools = [getUserIntent];

// Tools interface for nodes to call tools directly
import { TimeSlot } from "@wellness/dto";
import { IntentResult } from './intentInference.js';

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
    getAvailability: (args: { preferredDate?: string; preferredProvider?: string }) => Promise<TimeSlot[]>
  };
  escalationTool: {
    escalateToSlack: (args: { userKey: string; reason: string }) => Promise<{ success: boolean; escalationId: string }>
  };
  policySearchTool: {
    searchPolicies: (args: { query: string; topK?: number }) => Promise<PolicyDocument[]>
  };
  intentInferenceTool: {
    invoke: (args: { userQuery: string }) => Promise<IntentResult>
  };
  rescheduleTool: {
    rescheduleAppointment: (args: { eventId: string; newStartTime: string; newEndTime: string; reason?: string; userKey?: string; originalSlotId?: string }) => Promise<{ success: boolean; eventId: string; message: string; originalSlotId?: string }>
  };
}

// Note: createTools is not used anymore - tools are created in app.ts createDeps
