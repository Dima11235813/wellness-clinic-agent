import { BaseMessage, BaseMessageLike } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { TimeSlot, UiPhase, NodeName } from "@wellness/dto";

export const StateAnnotation = Annotation.Root({
  // Messages with proper reducer
  messages: Annotation<BaseMessage[], BaseMessageLike[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // Core conversation state
  threadId: Annotation<string>(),
  uiPhase: Annotation<UiPhase>(),
  interrupt: Annotation<any>(), // TODO: Define proper interrupt type

  // Business logic state
  userQuery: Annotation<string>(),
  intent: Annotation<NodeName.POLICY_QUESTION | NodeName.OFFER_OPTIONS | 'unknown'>(),
  // Gate future rescheduling attempts if the user has escalated before
  userEscalated: Annotation<boolean>(),
  userKey: Annotation<string>(),
  userChoice: Annotation<any>(), // Store user's interrupt response

  // Scheduling state
  preferredDate: Annotation<string>(),
  preferredProvider: Annotation<string>(),
  availableSlots: Annotation<TimeSlot[]>({
    default: () => [],
    reducer: (left, right) => right, // Replace with new value, don't concatenate
  }),
  selectedSlotId: Annotation<string>(),
  eventId: Annotation<string>(), // For rescheduling existing appointments

  // Policy state
  retrievedDocs: Annotation<any[]>(),
  // NOTE: Typo preserved to match existing downstream usage
  validatedAswer: Annotation<string>(),

  // Flags
  availableTimesDoNotWork: Annotation<boolean>(),
  twoWeekCapExceeded: Annotation<boolean>(),
  escalationNeeded: Annotation<boolean>(),
});

export type State = typeof StateAnnotation.State;
