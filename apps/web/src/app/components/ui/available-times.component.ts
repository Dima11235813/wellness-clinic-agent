import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TimeSlot } from '@wellness/dto';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'ui-available-times',
  standalone: true,
  imports: [CommonModule, DatePipe, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <mat-card-title>
          <span class="title">
            <mat-icon class="title-icon" aria-hidden="true">event</mat-icon>
            Available Appointment Times
          </span>
        </mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="days">
          <div class="day" *ngFor="let g of groupedByDay">
            <div class="day-heading">{{ g.date | date:'EEEE, MMM d' }}</div>
            <div class="slots">
              <button mat-stroked-button class="slot" *ngFor="let s of g.slots; trackBy: trackBySlotId" (click)="select.emit(s.id)" [attr.aria-label]="'Select ' + (s.startISO | date:'h:mm a') + ' appointment time'">
                <div class="time">
                  <mat-icon fontIcon="schedule" aria-hidden="true">schedule</mat-icon>
                  <span>{{ s.startISO | date:'h:mm a' }}</span>
                </div>
                <div class="provider" *ngIf="s.provider">{{ s.provider }}</div>
              </button>
            </div>
          </div>
        </div>
      </mat-card-content>
      <mat-card-actions>
        <button mat-stroked-button class="none" (click)="select.emit('none')">None of these work for me</button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [
    `
    .title { font-weight: 700; color: #2563eb; display: inline-flex; align-items: center; gap: 8px; font-size: 20px; }
    .title-icon { color: #2563eb; }
    .days { display: flex; flex-direction: column; gap: 16px; margin-top: 4px; }
    .day { padding-top: 2px; }
    .day-heading { font-weight: 600; color: #475569; margin: 6px 0 10px; font-size: 13px; }
    .slots { display: grid; grid-template-columns: repeat(2,minmax(240px,1fr)); gap: 16px; }
    @media (max-width: 640px) { .slots { grid-template-columns: 1fr; } }
    .slot { text-align: left; padding: 12px 14px; border: 1px solid #e2e8f0; background: #fff; border-radius: 12px; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
    .time { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; color: #0f172a; font-size: 16px; }
    .time mat-icon { font-size: 18px; height: 18px; width: 18px; line-height: 18px; color: #475569; }
    .provider { font-size: 12px; color: #64748b; }
    .none { margin-top: 10px; width: 100%; justify-content: center; color: #334155; border-color: #e2e8f0; background: #fff; border-radius: 10px; }
    .none:hover { background: #f8fafc; }
    `
  ]
})
export class AvailableTimesComponent {
  @Input({ required: true }) slots: TimeSlot[] = [];
  @Output() select = new EventEmitter<string | 'none'>();

  trackBySlotId(index: number, slot: TimeSlot): string { return slot.id; }

  get groupedByDay(): { date: Date; slots: TimeSlot[] }[] {
    const byDay = new Map<string, { date: Date; slots: TimeSlot[] }>();
    const sorted = [...this.slots].sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());
    for (const slot of sorted) {
      const d = new Date(slot.startISO);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!byDay.has(key)) {
        byDay.set(key, { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), slots: [] });
      }
      byDay.get(key)!.slots.push(slot);
    }
    return Array.from(byDay.values());
  }
}


