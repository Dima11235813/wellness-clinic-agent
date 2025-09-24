import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '../../state/app-state.store';
import { LangChainSerializedMessage } from '@wellness/dto';

@Component({
  selector: 'ui-chat-thread',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="thread">
      <div *ngFor="let m of messages" class="message" [class.user]="getRole(m)==='user'" [class.assistant]="getRole(m)==='assistant'">
        <div class="bubble">
          <div class="text">{{ getText(m) }}</div>
          <div class="meta">
            <span class="time">{{ getTime(m) | date:'shortTime' }}</span>
            <span class="sep" *ngIf="getCitationCount(m) > 0">•</span>
            <span class="cites" *ngIf="getCitationCount(m) > 0">{{ getCitationCount(m) }} source{{ getCitationCount(m) > 1 ? 's' : '' }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
    .thread { display: flex; flex-direction: column; gap: 10px; }
    .message { display: flex; }
    .message.user { justify-content: flex-end; }
    .bubble { max-width: 75%; padding: 10px 12px; border-radius: 16px; background: #f1f5f9; border: 1px solid #e2e8f0; }
    .message.user .bubble { background: #2563eb; color: #fff; border-color: #1d4ed8; }
    .meta { margin-top: 6px; font-size: 12px; color: #64748b; display: flex; gap: 6px; align-items: center; }
    .message.user .meta { color: rgba(255,255,255,0.85); }
    `
  ]
})
export class ChatThreadComponent {
  // Accept either our ChatMessage DTOs or LangChain-serialized messages
  @Input({ required: true }) messages: Array<ChatMessage | LangChainSerializedMessage> = [];

  getRole(m: ChatMessage | LangChainSerializedMessage): 'user' | 'assistant' {
    if ((m as ChatMessage).role && (((m as ChatMessage).role === 'user') || ((m as ChatMessage).role === 'assistant'))) {
      return (m as ChatMessage).role;
    }
    const idPath: string[] | undefined = Array.isArray((m as LangChainSerializedMessage)?.id) ? (m as LangChainSerializedMessage).id : undefined;
    if (idPath?.includes('HumanMessage')) return 'user';
    if (idPath?.includes('AIMessage')) return 'assistant';
    if (typeof (m as any)?.type === 'string' && (m as any).type === 'human') return 'user';
    return 'assistant';
  }

  getText(m: ChatMessage | LangChainSerializedMessage): string {
    if (typeof (m as ChatMessage)?.text === 'string') return (m as ChatMessage).text;
    const lc = m as LangChainSerializedMessage;
    const content = (lc as any)?.kwargs?.content ?? (lc as any)?.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      const first = content[0] as any;
      if (first && typeof first.text === 'string') return first.text;
    }
    if (content && typeof content === 'object' && typeof (content as any).text === 'string') {
      return (content as any).text as string;
    }
    return '';
  }

  getTime(m: ChatMessage | LangChainSerializedMessage): string {
    const addl = (m as any)?.additional ?? (m as any)?.kwargs?.additional_kwargs;
    const at = addl?.at as string | undefined;
    return at ?? new Date().toISOString();
  }

  getCitationCount(m: ChatMessage | LangChainSerializedMessage): number {
    const addl = (m as any)?.additional ?? (m as any)?.kwargs?.additional_kwargs;
    const cites = (addl?.citations as string[] | undefined) || [];
    return Array.isArray(cites) ? cites.length : 0;
  }
}


