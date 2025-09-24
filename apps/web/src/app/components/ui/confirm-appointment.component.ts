import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TimeSlot } from '@wellness/dto';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'ui-confirm-appointment',
  standalone: true,
  imports: [CommonModule, DatePipe, MatCardModule, MatButtonModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <mat-card-title>Confirm Your Appointment</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="choice" *ngIf="slot">
          <div class="when">{{ slot.startISO | date:'EEEE, MMM d' }}</div>
          <div class="time">{{ slot.startISO | date:'h:mm a' }}</div>
          <div class="provider" *ngIf="slot.provider">{{ slot.provider }}</div>
        </div>
      </mat-card-content>
      <mat-card-actions>
        <button mat-raised-button color="primary" (click)="confirm.emit(true)">Yes, Confirm</button>
        <button mat-stroked-button (click)="confirm.emit(false)">Go Back</button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [
    `
    .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
    .title { font-weight: 700; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
    .choice { padding: 14px; border-radius: 12px; background: #eaf2ff; border: 1px solid #cfe0ff; margin-bottom: 10px; }
    .when { font-weight: 600; }
    .time { color: #475569; }
    .provider { color: #2563eb; }
    .actions { display: flex; gap: 10px; }
    .primary { background: linear-gradient(90deg,#1aa6ff,#21d4b4); color: #fff; border: none; padding: 10px 14px; border-radius: 10px; }
    .ghost { background: #fff; border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 10px; }
    `
  ]
})
export class ConfirmAppointmentComponent {
  @Input({ required: true }) slot!: TimeSlot | null;
  @Output() confirm = new EventEmitter<boolean>();
}


