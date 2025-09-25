import { UiPhase, TimeSlot, NodeName } from '@wellness/dto';

export interface GraphState {
  // Core conversation state - now using LangChain BaseMessage types
  messages: any[]; // Will be BaseMessage[] from LangChain
  threadId: string;

  // UI state that mirrors frontend
  uiPhase: UiPhase;
  interrupt?: any; // LangGraph interrupt value

  // Business logic state
  userQuery?: string;
  intent?: typeof NodeName.POLICY_QUESTION | typeof NodeName.OFFER_OPTIONS_AGENT | 'unknown';
  userChoice?: any; // Store user's interrupt response

  // Scheduling state
  preferredDate?: string;
  /** TODO in the future after planning a db tool user to retrieve providers for logged in user */
  preferredProvider?: string;
  availableSlots?: TimeSlot[];
  selectedSlotId?: string;
  eventId?: string; // For rescheduling existing appointments

  // Policy state
  retrievedDocs?: any[];
  validatedAswer?: string;

  // Flags
  availableTimesDoNotWork?: boolean;
  twoWeekCapExceeded?: boolean;
  escalationNeeded?: boolean;
}

export const initialState: Partial<GraphState> = {
  messages: [],
  uiPhase: UiPhase.Chatting,
  availableTimesDoNotWork: false,
  twoWeekCapExceeded: false,
  escalationNeeded: false,
};
