export type UiPhase = 'Chatting' | 'SelectingTime' | 'ConfirmingTime' | 'Escalated' | 'PolicyQA';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
}

export interface TimeSlot {
  id: string;
  startISO: string;
  endISO: string;
  provider?: string;
}

export interface InterruptPayload {
  kind: 'SelectTime' | 'ConfirmTime';
  slots?: TimeSlot[];
  selectedSlotId?: string;
  reason?: string;
}

export interface ResumeRequest {
  threadId: string;
  response:
    | { kind: 'SelectTime'; slotId: string | 'none' }
    | { kind: 'ConfirmTime'; confirm: boolean };
}
