import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'ui-escalated-panel',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <mat-card-title>Representative Contact</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <div class="notice">
          <mat-icon aria-hidden="true" class="info">call</mat-icon>
          <div>
            <div class="headline">A representative will contact you</div>
            <div class="sub">We'll call you within 15 minutes to help schedule your appointment.</div>
          </div>
        </div>
      </mat-card-content>
      <mat-card-actions>
        <button mat-stroked-button color="primary" (click)="askPolicy.emit()">Ask Policy Questions</button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [
    `
    .notice { display: flex; align-items: flex-start; gap: 12px; border: 1px solid #cbd5e1; border-left: 4px solid #38bdf8; background: #f0f9ff; padding: 12px; border-radius: 10px; color: #0c4a6e; }
    .headline { font-weight: 600; }
    .sub { color: #0369a1; }
    .info { color: #0284c7; }
    `
  ]
})
export class EscalatedPanelComponent {
  @Output() askPolicy = new EventEmitter<void>();
}


