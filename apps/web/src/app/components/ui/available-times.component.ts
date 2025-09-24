import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TimeSlot } from '@wellness/dto';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'ui-available-times',
  standalone: true,
  imports: [CommonModule, DatePipe, MatCardModule, MatButtonModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <mat-card-title>Available Appointment Times</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="slots">
          <button mat-stroked-button class="slot" *ngFor="let s of slots" (click)="select.emit(s.id)">
            {{ s.startISO | date:'EEE, MMM d, h:mm a' }}
            <small *ngIf="s.provider">{{ s.provider }}</small>
          </button>
        </div>
      </mat-card-content>
      <mat-card-actions>
        <button mat-button color="primary" (click)="select.emit('none')">None of these work for me</button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [
    `
    .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
    .title { font-weight: 700; color: #0f172a; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
    .slots { display: grid; grid-template-columns: repeat(auto-fill,minmax(260px,1fr)); gap: 10px; }
    .slot { text-align: left; padding: 12px; border: 1px solid #cbd5e1; background: white; border-radius: 12px; }
    .slot small { display: block; color: #475569; margin-top: 4px; }
    .none { margin-top: 10px; width: 100%; background: transparent; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 10px; color: #334155; }
    `
  ]
})
export class AvailableTimesComponent {
  @Input({ required: true }) slots: TimeSlot[] = [];
  @Output() select = new EventEmitter<string | 'none'>();
}


