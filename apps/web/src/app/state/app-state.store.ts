import { Injectable, computed, signal, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UiPhase, InterruptPayload, ResumeRequest, TimeSlot, InterruptKind, ChatStartRequest, ChatStartResponse, StreamEvent, LangChainSerializedMessage, MessageAdditional } from '@wellness/dto';
import { AppConfigService } from '../config/app-config.service';

// Frontend-specific message interface for display
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: string;
  additional?: MessageAdditional;
}

@Injectable({ providedIn: 'root' })
export class AppStateStore {
  readonly apiBase: string;

  readonly isLoading = signal(false);
  readonly threadId = signal<string | null>(null);
  readonly uiPhase = signal<UiPhase>(UiPhase.Chatting);
  readonly messages = signal<ChatMessage[]>([]);
  readonly interrupt = signal<InterruptPayload | null>(null);

  readonly selectedSlot = computed(() => {
    const intr = this.interrupt();
    const availableSlots = (this as any).availableSlots?.() || [];
    if (!intr || !intr.selectedSlotId) {
      return undefined;
    }
    // First try to find in interrupt slots, then fall back to state slots
    return (intr.slots || availableSlots).find((s: TimeSlot) => s.id === intr.selectedSlotId);
  });

  // Add a getter for availableSlots since it's stored in state
  private _availableSlots = signal<TimeSlot[]>([]);
  readonly availableSlots = this._availableSlots.asReadonly();

  /**
   * Computed signal that determines the current UI state based on both uiPhase and interrupt.
   * This ensures the UI stays in sync with backend state changes.
   */
  readonly currentUiState = computed(() => {
    const phase = this.uiPhase();
    const intr = this.interrupt();
    const availableSlots = this.availableSlots();

    // If we have an active interrupt that requires user action, show it
    if (intr && intr.requiresUserAction) {
      return {
        phase,
        interrupt: intr,
        showInterrupt: true,
        showEscalatedPanel: false,
        showPolicyQa: false,
        showSlotSelection: false
      };
    }

    // Handle phase-specific UI states
    const showEscalatedPanel = phase === UiPhase.Escalated;
    const showPolicyQa = phase === UiPhase.PolicyQA;
    const showSlotSelection = phase === UiPhase.SelectingTime && availableSlots && availableSlots.length > 0;

    return {
      phase,
      interrupt: intr,
      showInterrupt: false,
      showEscalatedPanel,
      showPolicyQa,
      showSlotSelection,
      availableSlots
    };
  });

  private currentEventSource: EventSource | null = null;

  constructor(private readonly http: HttpClient, private readonly config: AppConfigService) {
    this.apiBase = this.config.apiBase;

    // Track uiPhase changes for debugging and ensuring UI consistency
    effect(() => {
      const currentPhase = this.uiPhase();
      if (this.isDebug()) {
        console.log(`[AppStateStore] UI Phase changed to: ${currentPhase}`);
      }
      // Could add additional UI state synchronization logic here
    });
  }

  private isDebug(): boolean {
    try {
      const search = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
      return search.has('debug');
    } catch {
      return false;
    }
  }

  bootstrapWelcome(): void {
    if (this.messages().length > 0) return;

    const search = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
    const debug = search.get('debug');

    const baseWelcome: ChatMessage = {
      id: 'welcome',
      role: 'assistant',
      text: 'Welcome to the Wellness Clinic! How can I help you today?',
      at: new Date().toISOString()
    };

    this.messages.set([baseWelcome]);

    // Debug presets for UI design review without backend graph
    if (debug === 'select') {
      const now = Date.now();
      const mkSlot = (i: number): TimeSlot => ({
        id: `slot_${i}`,
        startISO: new Date(now + i * 3_600_000).toISOString(),
        endISO: new Date(now + (i * 3_600_000) + 30 * 60_000).toISOString(),
        provider: i % 2 ? 'Dr. Patel' : 'Dr. Kim'
      });
      this.interrupt.set({
        kind: InterruptKind.SelectTime,
        slots: [mkSlot(1), mkSlot(2), mkSlot(3), mkSlot(5), mkSlot(6)],
        requiresUserAction: true
      });
      this.uiPhase.set(UiPhase.SelectingTime);
    } else if (debug === 'confirm') {
      const start = new Date(Date.now() + 2 * 3_600_000).toISOString();
      const end = new Date(Date.now() + 2 * 3_600_000 + 30 * 60_000).toISOString();
      const slot: TimeSlot = { id: 'slot_choice', startISO: start, endISO: end, provider: 'Dr. Rivera' };
      this.interrupt.set({
        kind: InterruptKind.ConfirmTime,
        slots: [slot],
        selectedSlotId: slot.id,
        requiresUserAction: true
      });
      this.uiPhase.set(UiPhase.ConfirmingTime);
    }
  }

  ask(text: string): void {
    if (!text || text.trim().length === 0) {
      return;
    }
    const trimmed = text.trim();

    // Immediately show the user's message locally
    const userMsgId = `user_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      text: trimmed,
      at: new Date().toISOString()
    };
    this.messages.update(list => [...list, userMsg]);

    // Kick off server-side processing and stream assistant updates
    this.startChat(trimmed);
  }

  selectTime(slotId: string | 'none'): void {
    if (this.isDebug()) {
      const intr = this.interrupt();
      if (!intr) return;
      if (slotId === 'none') {
        // Simulate assistant response: offer more options later
        this.messages.update(list => [...list, { id: `sys_${Date.now()}`, role: 'assistant', text: 'Okay, I’ll look for more options and get back to you.', at: new Date().toISOString() }]);
        this.interrupt.set(null);
        this.setUiPhase(UiPhase.Chatting);
        return;
      }
      this.interrupt.set({ ...intr, selectedSlotId: slotId, kind: InterruptKind.ConfirmTime });
      this.setUiPhase(UiPhase.ConfirmingTime);
      return;
    }

    if (!this.threadId()) return;

    // Clear interrupt to hide the UI immediately on click
    this.interrupt.set(null);

    // Then show user selection message
    if (slotId === 'none') {
      const userMessage: ChatMessage = {
        id: `user_selection_${Date.now()}`,
        role: 'user',
        text: 'None of these times work for me',
        at: new Date().toISOString()
      };
      this.messages.update(list => [...list, userMessage]);
    } else {
      const selectedSlot = this.availableSlots().find(s => s.id === slotId);
      if (selectedSlot) {
        const timeString = new Date(selectedSlot.startISO).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
        const userMessage: ChatMessage = {
          id: `user_selection_${Date.now()}`,
          role: 'user',
          text: `I'd like to schedule for ${timeString}${selectedSlot.provider ? ` with ${selectedSlot.provider}` : ''}`,
          at: new Date().toISOString()
        };
        this.messages.update(list => [...list, userMessage]);
      }
    }

    const payload: ResumeRequest = { threadId: this.threadId()!, response: { kind: 'SelectTime', slotId } };
    this.resume(payload);
  }

  confirmTime(confirm: boolean): void {
    if (this.isDebug()) {
      if (confirm) {
        const chosen = this.selectedSlot();
        const when = chosen ? new Date(chosen.startISO).toLocaleString() : 'your selected time';
        this.messages.update(list => [...list, { id: `sys_${Date.now()}`, role: 'assistant', text: `Great! You’re all set for ${when}.`, at: new Date().toISOString() }]);
        this.interrupt.set(null);
        this.setUiPhase(UiPhase.Chatting);
      } else {
        const intr = this.interrupt();
        if (intr?.slots && intr.slots.length) {
          this.interrupt.set({ kind: InterruptKind.SelectTime, slots: intr.slots, requiresUserAction: true });
          this.setUiPhase(UiPhase.SelectingTime);
        }
      }
      return;
    }

    if (!this.threadId()) return;

    // Clear interrupt to hide the UI immediately on click
    this.interrupt.set(null);

    // Then show user confirmation message
    if (confirm) {
      const selectedSlot = this.selectedSlot();
      if (selectedSlot) {
        const userMessage: ChatMessage = {
          id: `user_confirmation_${Date.now()}`,
          role: 'user',
          text: 'Yes, please confirm this appointment',
          at: new Date().toISOString()
        };
        this.messages.update(list => [...list, userMessage]);
      }
    } else {
      const userMessage: ChatMessage = {
        id: `user_confirmation_${Date.now()}`,
        role: 'user',
        text: 'Let me go back and choose a different time',
        at: new Date().toISOString()
      };
      this.messages.update(list => [...list, userMessage]);
    }

    const payload: ResumeRequest = { threadId: this.threadId()!, response: { kind: 'ConfirmTime', confirm } };
    this.resume(payload);
  }

  private startChat(text: string): void {
    this.isLoading.set(true);

    const request: ChatStartRequest = {
      text,
      threadId: this.threadId() || undefined
    };

    this.http.post<ChatStartResponse>(`${this.apiBase}/api/chat`, request).subscribe({
      next: (response) => {
        this.threadId.set(response.threadId);
        this.openStream(response.threadId);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  private openStream(threadId: string): void {
    // Close any existing stream
    if (this.currentEventSource) {
      try { this.currentEventSource.close(); } catch {}
      this.currentEventSource = null;
    }

    const url = `${this.apiBase}/api/stream?threadId=${encodeURIComponent(threadId)}`;

    const es = new EventSource(url);
    this.currentEventSource = es;

    es.onmessage = (evt: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(evt.data) as StreamEvent;
        if (parsed?.type === 'state') {
          const data = parsed.data;

          // Map LangChain serialized messages (kwargs-based) or our simple ChatMessage objects
          const toChatMessage = (m: any, idx: number): ChatMessage => {
            // Already in ChatMessage shape
            if (m?.role && (m.role === 'user' || m.role === 'assistant') && typeof m?.text === 'string') {
              return m as ChatMessage;
            }

            const maybeLc = m as LangChainSerializedMessage;
            const lcContent = (maybeLc as any)?.kwargs?.content ?? (m as any)?.content;
            const additional = (maybeLc as any)?.kwargs?.additional_kwargs ?? (m as any)?.additional_kwargs;
            const id = (maybeLc as any)?.kwargs?.id ?? m?.id ?? `msg_${idx}_${Date.now()}`;

            // Determine role by LC message id path
            let role: 'user' | 'assistant' = 'assistant';
            const idPath: string[] | undefined = Array.isArray((maybeLc as any)?.id) ? (maybeLc as any).id : undefined;
            if (idPath?.includes('HumanMessage')) {
              role = 'user';
            } else if (idPath?.includes('AIMessage')) {
              role = 'assistant';
            } else {
              // Fallback heuristic
              role = typeof (m as any)?.type === 'string' && (m as any).type === 'human' ? 'user' : 'assistant';
            }

            // Extract text from LC content variants
            let text = '';
            if (typeof lcContent === 'string') {
              text = lcContent;
            } else if (Array.isArray(lcContent)) {
              const first = lcContent[0] as any;
              text = typeof first?.text === 'string' ? first.text : '';
            } else if (lcContent && typeof lcContent === 'object' && 'text' in lcContent) {
              text = (lcContent as any).text ?? '';
            }

            return {
              id,
              role,
              text,
              at: (additional && typeof additional.at === 'string') ? additional.at : new Date().toISOString(),
              additional: additional as MessageAdditional | undefined
            } as ChatMessage;
          };

          const mappedMessages: ChatMessage[] = (data.messages as any[]).map(toChatMessage);

          // Only render assistant messages from the stream to avoid duplicating local user echoes
          const assistantOnly = mappedMessages.filter(m => m.role === 'assistant');

          // Merge new messages with existing ones, avoiding duplicates
          const currentMessages = this.messages();
          const existingIds = new Set(currentMessages.map(msg => msg.id));
          const newMessages = assistantOnly.filter(msg => !existingIds.has(msg.id));

          if (newMessages.length > 0) {
            this.messages.set([...currentMessages, ...newMessages]);
          } else {
            // No-op; we intentionally avoid replacing the list to preserve locally-added user messages
          }
          this.uiPhase.set(data.uiPhase);
          this.interrupt.set((data as any).interrupt ?? null);
          this.threadId.set(data.threadId);
          // Update available slots if present in state
          if ((data as any).availableSlots) {
            this._availableSlots.set((data as any).availableSlots);
          }
        } else if (parsed?.type === 'interrupt') {
          const interruptData = parsed.data as InterruptPayload;
          this.interrupt.set(interruptData);

          // Automatically update UI phase based on interrupt type
          if (interruptData.kind === InterruptKind.ConfirmTime) {
            this.uiPhase.set(UiPhase.ConfirmingTime);
          }
        } else if (parsed?.type === 'complete') {
          this.isLoading.set(false);
          if (this.currentEventSource) {
            try { this.currentEventSource.close(); } catch {}
            this.currentEventSource = null;
          }
        } else if (parsed?.type === 'error') {
          this.isLoading.set(false);
        }
      } catch {
        // ignore parse errors for non-JSON keepalive events
      }
    };

    es.onerror = () => {
      this.isLoading.set(false);
      try { es.close(); } catch {}
      this.currentEventSource = null;
    };
  }

  /**
   * Sets the UI phase and clears any interrupt if transitioning away from interrupt-requiring phases
   */
  setUiPhase(phase: UiPhase): void {
    const previousPhase = this.uiPhase();

    // If transitioning away from interrupt-based phases, clear the interrupt
    if ((previousPhase === UiPhase.SelectingTime || previousPhase === UiPhase.ConfirmingTime) &&
        (phase === UiPhase.Chatting || phase === UiPhase.Escalated || phase === UiPhase.PolicyQA)) {
      this.interrupt.set(null);
    }

    this.uiPhase.set(phase);
  }

  resume(body: ResumeRequest): void {
    this.isLoading.set(true);
    this.http.post(`${this.apiBase}/api/resume`, body).subscribe({
      next: () => {
        this.isLoading.set(false);
        // Optionally re-poke the graph by streaming an empty follow-up if needed.
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }
}


