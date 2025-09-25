export enum UiPhase {
  Chatting = 'Chatting',
  SelectingTime = 'SelectingTime',
  ConfirmingTime = 'ConfirmingTime',
  Escalated = 'Escalated',
  PolicyQA = 'PolicyQA'
}

export enum NodeName {
  INFER_INTENT = 'infer_intent',
  POLICY_QUESTION = 'policy_question',
  POLICY_ANSWER = 'policy_answer',
  OFFER_OPTIONS_AGENT = 'offer_options_agent',
  OFFER_OPTIONS_TOOLS = 'offer_options_tools',
  OFFER_OPTIONS_FINAL = 'offer_options_final',
  CONFIRM_TIME = 'confirm_time',
  NOTIFY_USER = 'notify_user',
  ESCALATE_HUMAN = 'escalate_human'
}


export interface TimeSlot {
  id: string;
  startISO: string;
  endISO: string;
  provider?: string;
}

export interface AvailabilityResponse {
  slots: TimeSlot[];
}

// Represents a user's currently scheduled appointment that we might reschedule
export interface UserAppointment {
  id?: string;
  startISO: string;
  endISO: string;
  provider: string;
}

export enum InterruptKind {
  StartSuggest = 'StartSuggest',
  SelectTime = 'SelectTime',
  ConfirmTime = 'ConfirmTime',
  None = 'None'
}

export interface InterruptPayload {
  kind: InterruptKind;
  slots?: TimeSlot[];
  selectedSlotId?: string;
  reason?: string;
  requiresUserAction: boolean;
  suggestions?: { key: string; label: string }[]; // for StartSuggest
}

export interface ChatStartRequest {
  threadId?: string;          // if omitted, server creates one
  text: string;               // user's message
}

export interface ChatStartResponse {
  threadId: string;
  accepted: boolean;
}

export interface ResumeRequest {
  threadId: string;
  response:
    | { kind: 'StartSuggest'; chipKey?: 'policy_cancellation' | 'reschedule' }
    | { kind: 'StartSuggest'; text: string }
    | { kind: 'SelectTime'; slotId: string | 'none' }
    | { kind: 'ConfirmTime'; confirm: boolean };
}

// --- Streaming DTOs ---

/**
 * Minimal representation of LangChain serialized messages that our API streams.
 * Example shape received by frontend:
 * { lc:1, type:'constructor', id:['langchain_core','messages','AIMessage'], kwargs:{ content:'hello', id:'msg_..', additional_kwargs:{ at:'..' } } }
 */
export interface LangChainSerializedMessage {
  lc: number;
  type: 'constructor';
  id: string[]; // e.g. ["langchain_core","messages","AIMessage"]
  kwargs: {
    content: string | Array<{ type: string; text?: string }>;
    id?: string;
    additional_kwargs?: MessageAdditional;
    response_metadata?: Record<string, any>;
    tool_calls?: any[];
    invalid_tool_calls?: any[];
  };
}

export interface StreamStateEvent {
  type: 'state';
  data: {
    messages: LangChainSerializedMessage[] | any[]; // any[] to allow backward compatibility with simple message objects
    uiPhase: UiPhase;
    interrupt?: InterruptPayload | null;
    threadId: string;
  };
}

export interface StreamInterruptEvent {
  type: 'interrupt';
  data: InterruptPayload;
}

export interface StreamCompleteEvent {
  type: 'complete';
}

export interface StreamErrorEvent {
  type: 'error';
  error?: string;
}

export interface StreamMessageChunkEvent {
  type: 'message_chunk';
  data: {
    content: string;
    id: string;
    additional_kwargs?: any;
  };
}

export type StreamEvent =
  | StreamStateEvent
  | StreamInterruptEvent
  | StreamCompleteEvent
  | StreamErrorEvent
  | StreamMessageChunkEvent;

// Additional metadata attached to messages from the backend
export interface MessageAdditional {
  at: string;             // ISO timestamp when message was created
  citations?: string[];   // optional list of source URLs or strings
  [key: string]: any;
}
