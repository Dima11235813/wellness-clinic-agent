import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateStore } from '../state/app-state.store';
import { Inject } from '@angular/core';
import { AppConfigService } from '../config/app-config.service';
import { ChatThreadComponent } from './ui/chat-thread.component';
import { AvailableTimesComponent } from './ui/available-times.component';
import { ConfirmAppointmentComponent } from './ui/confirm-appointment.component';
import { EscalatedPanelComponent } from './ui/escalated-panel.component';
import { PolicyQaComponent } from './ui/policy-qa.component';
import { MOCK_AVAILABLE_SLOTS, MOCK_CHAT_MESSAGES, MOCK_POLICY_SUGGESTIONS } from '@wellness/dto/src/mock';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { UiPhase } from '@wellness/dto';

@Component({
  selector: 'app-chat-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, MatToolbarModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatCardModule, ChatThreadComponent, AvailableTimesComponent, ConfirmAppointmentComponent, EscalatedPanelComponent, PolicyQaComponent],
  template: `
    <div class="chat-shell">
      <mat-toolbar color="primary" class="mat-elevation-z2">
        <span class="title">Wellness Clinic Assistant</span>
        <span class="spacer"></span>
        <button mat-icon-button aria-label="Help">
          <mat-icon>help_outline</mat-icon>
        </button>
      </mat-toolbar>

      <div class="chat-messages" #list>
        <ui-chat-thread [messages]="USE_MOCK_ENDPOINTS ? mockMessages : store.messages()"></ui-chat-thread>
      </div>

      <div class="interrupt">
        @let uiState = store.currentUiState();
        @if (!USE_MOCK_ENDPOINTS) {
          <!-- Handle interrupt-based UI -->
          @if (uiState.showInterrupt && uiState.interrupt) {
            @let intr = uiState.interrupt;
            <ng-container [ngSwitch]="intr.kind">
              <div *ngSwitchCase="'StartSuggest'" class="card">
                <div class="card-title">How can I help you?</div>
                <div class="suggestions">
                  @for (suggestion of intr.suggestions || []; track suggestion.key) {
                    <button mat-stroked-button (click)="onSuggestionClick(suggestion.key)">
                      {{ suggestion.label }}
                    </button>
                  }
                </div>
              </div>
              <div *ngSwitchCase="'SelectTime'" class="card">
                <ui-available-times [slots]="intr.slots || []" (select)="store.selectTime($event)"></ui-available-times>
              </div>
              <div *ngSwitchCase="'ConfirmTime'" class="card">
                <ui-confirm-appointment [slot]="store.selectedSlot() || null" (confirm)="store.confirmTime($event)"></ui-confirm-appointment>
              </div>
            </ng-container>
          }

          <!-- Handle phase-based UI that doesn't require interrupts -->
          @if (uiState.showSlotSelection && uiState.availableSlots) {
            <div class="card">
              <ui-available-times [slots]="uiState.availableSlots" (select)="store.selectTime($event)"></ui-available-times>
            </div>
          }

          @if (uiState.showEscalatedPanel) {
            <ui-escalated-panel (askPolicy)="onEscalatedAskPolicy()"></ui-escalated-panel>
          }

          @if (uiState.showPolicyQa) {
            <ui-policy-qa [suggestions]="[]" (ask)="onPolicyQuestion($event)" (continue)="onPolicyContinue()"></ui-policy-qa>
          }
        }

        @if (USE_MOCK_ENDPOINTS && demoPanel === 'select') {
          <div class="card">
            <ui-available-times [slots]="mockSlots" (select)="onMockSelect($event)"></ui-available-times>
          </div>
        }
        @if (USE_MOCK_ENDPOINTS && demoPanel === 'confirm') {
          <div class="card">
            <ui-confirm-appointment [slot]="selectedMockSlot" (confirm)="onMockConfirm($event)"></ui-confirm-appointment>
          </div>
        }
        @if (USE_MOCK_ENDPOINTS && demoPanel === 'escalated') {
          <ui-escalated-panel (askPolicy)="demoPanel='policy'"></ui-escalated-panel>
        }
        @if (USE_MOCK_ENDPOINTS && demoPanel === 'policy') {
          <ui-policy-qa [suggestions]="mockPolicyQs" (ask)="onMockAskPolicy($event)" (continue)="demoPanel='chat'"></ui-policy-qa>
        }
      </div>

      <form class="chat-input" (ngSubmit)="onSubmit()">
        <mat-form-field appearance="outline" class="grow">
          <mat-label>Type your message</mat-label>
          <input matInput [(ngModel)]="draft" name="draft" [disabled]="store.isLoading()" autocomplete="off" />
        </mat-form-field>
        <button mat-raised-button color="primary" type="submit" [disabled]="!draft || store.isLoading()">
          <ng-container *ngIf="!store.isLoading(); else loadingTpl">Send</ng-container>
        </button>
        <ng-template #loadingTpl>
          <span class="loading">
            <mat-icon class="spinner" fontIcon="autorenew"></mat-icon>
            Sending...
          </span>
        </ng-template>
      </form>

      @if (USE_MOCK_ENDPOINTS) {
        <div class="demo-controls">
          <div class="group-title">Demo Controls</div>
          <div class="group">
            <button [class.active]="demoPanel==='chat'" (click)="demoPanel='chat'">Chat</button>
            <button [class.active]="demoPanel==='select'" (click)="demoPanel='select'">Select Time</button>
            <button [class.active]="demoPanel==='confirm'" (click)="demoPanel='confirm'">Confirm</button>
            <button [class.active]="demoPanel==='escalated'" (click)="demoPanel='escalated'">Escalated</button>
            <button [class.active]="demoPanel==='policy'" (click)="demoPanel='policy'">Policy Q&A</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
    .chat-shell { height: 100dvh; max-width: 920px; margin: 0 auto; display: grid; grid-template-rows: auto 1fr auto; gap: 12px; padding: 16px; }
    .title { font-weight: 600; }
    .spacer { flex: 1 1 auto; }
    .chat-messages { overflow: auto; display: flex; flex-direction: column; gap: 10px; padding: 4px 2px; }
    .message { display: flex; }
    .message.user { justify-content: flex-end; }
    .message.assistant { justify-content: flex-start; }
    .bubble { max-width: 75%; padding: 10px 12px; border-radius: 16px; background: #f1f5f9; border: 1px solid #e2e8f0; }
    .message.user .bubble { background: #2563eb; color: white; border-color: #1d4ed8; }
    .chat-input { display: grid; grid-template-columns: 1fr auto; gap: 8px; background: white; border: 1px solid #e2e8f0; padding: 10px; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.04); align-items: center; }
    .grow { width: 100%; }
    .interrupt { position: sticky; bottom: 0; }
    .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; background: white; box-shadow: 0 2px 12px rgba(0,0,0,0.04); margin-bottom: 8px; }
    .card-title { font-weight: 600; margin-bottom: 8px; }
    .slots { display: grid; grid-template-columns: repeat(auto-fill,minmax(220px,1fr)); gap: 8px; }
    .slot { padding: 10px 12px; border-radius: 10px; border: 1px solid #cbd5e1; background: white; text-align: left; }
    .none { margin-top: 6px; background: transparent; border: none; color: #334155; text-decoration: underline; }
    .actions { display: flex; gap: 8px; }
    .primary { background: #16a34a; color: white; border: 1px solid #16a34a; padding: 8px 12px; border-radius: 10px; }
    .ghost { background: white; color: #0f172a; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 10px; }
    .suggestions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
    .suggestions button { padding: 8px 16px; border-radius: 20px; border: 1px solid #cbd5e1; background: white; color: #374151; }
    .demo-controls { margin-top: 10px; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 10px; }
    .group-title { font-weight: 600; margin-bottom: 6px; color: #334155; }
    .group { display: flex; gap: 8px; flex-wrap: wrap; }
    .group button { padding: 6px 10px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; }
    .group button.active { background: #2563eb; border-color: #2563eb; color: #fff; }
    .spinner { animation: spin 1s linear infinite; display: inline-block; }
    @keyframes spin { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } }
    `
  ]
})
export class ChatShellComponent implements OnInit {
  draft = '';
  readonly USE_MOCK_ENDPOINTS = false as const; // kept for backwards compat in template; actual values come from config
  demoPanel: 'chat' | 'select' | 'confirm' | 'escalated' | 'policy' = 'chat';
  mockSlots = MOCK_AVAILABLE_SLOTS;
  mockMessages: { id: string; role: 'user' | 'assistant'; text: string; at: string }[] = MOCK_CHAT_MESSAGES as any;
  mockPolicyQs = MOCK_POLICY_SUGGESTIONS;
  selectedMockSlot: any = null;

  constructor(public readonly store: AppStateStore, @Inject(AppConfigService) public readonly cfg: AppConfigService) {}

  ngOnInit(): void {
    this.store.bootstrapWelcome();
  }

  onSubmit(): void {
    const value = this.draft.trim();
    if (!value) return;
    if (this.USE_MOCK_ENDPOINTS) {
      this.mockMessages = [
        ...this.mockMessages,
        { id: `u_${Date.now()}`, role: 'user' as const, text: value, at: new Date().toISOString() }
      ];
      if (this.demoPanel === 'chat') this.demoPanel = 'select';
    } else {
      // Check if we have an active interrupt that requires user action
      const intr = this.store.interrupt();
      if (intr?.kind === 'StartSuggest' && intr.requiresUserAction) {
        this.onSuggestionText(value);
      } else {
        this.store.ask(value);
      }
    }
    this.draft = '';
  }

  onSuggestionClick(chipKey: string): void {
    if (!this.store.threadId()) return;

    // Clear the interrupt immediately to hide the suggestion UI
    this.store.interrupt.set(null);

    const request = {
      threadId: this.store.threadId()!,
      response: { kind: 'StartSuggest' as const, chipKey: chipKey as 'policy_cancellation' | 'reschedule' }
    };

    this.store.resume(request);
  }

  onSuggestionText(text: string): void {
    if (!this.store.threadId()) return;

    // Clear the interrupt immediately to hide the suggestion UI
    this.store.interrupt.set(null);

    const request = {
      threadId: this.store.threadId()!,
      response: { kind: 'StartSuggest' as const, text }
    };

    this.store.resume(request);
  }

  onMockSelect(id: string | 'none') {
    if (id === 'none') { this.demoPanel = 'chat'; return; }
    this.selectedMockSlot = this.mockSlots.find(s => s.id === id) ?? null;
    this.demoPanel = 'confirm';
  }

  onMockConfirm(confirm: boolean) {
    if (confirm) {
      const when = this.selectedMockSlot ? new Date(this.selectedMockSlot.startISO).toLocaleString() : 'your selected time';
      this.mockMessages = [
        ...this.mockMessages,
        { id: `a_${Date.now()}`, role: 'assistant' as const, text: `Great! You selected ${when}.`, at: new Date().toISOString() }
      ];
      this.demoPanel = 'chat';
    } else {
      this.demoPanel = 'select';
    }
  }

  onMockAskPolicy(q: string) {
    this.mockMessages = [
      ...this.mockMessages,
      { id: `q_${Date.now()}`, role: 'user' as const, text: q, at: new Date().toISOString() }
    ];
  }

  onEscalatedAskPolicy(): void {
    // Transition to policy QA phase
    this.store.setUiPhase(UiPhase.PolicyQA);
  }

  onPolicyQuestion(question: string): void {
    // Handle policy question - could send to backend or handle locally
    this.store.ask(question);
  }

  onPolicyContinue(): void {
    // Return to chatting phase
    this.store.setUiPhase(UiPhase.Chatting);
  }
}


