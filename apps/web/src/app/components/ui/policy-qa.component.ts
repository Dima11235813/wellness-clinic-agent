import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'ui-policy-qa',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatChipsModule, MatButtonModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header>
        <mat-card-title>Ask About Our Policies</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p class="sub">I can answer questions about wellness center policies. Try asking about:</p>
        <mat-chip-set class="chips" role="listbox" aria-label="Suggested policy questions">
          <mat-chip *ngFor="let q of suggestions" (click)="ask.emit(q)" clickable>{{ q }}</mat-chip>
        </mat-chip-set>
      </mat-card-content>
      <mat-card-actions>
        <button mat-stroked-button (click)="continue.emit()">Continue Chat</button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [
    `
    .sub { color: #475569; margin: 0 0 8px 0; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
    `
  ]
})
export class PolicyQaComponent {
  @Input({ required: true }) suggestions: string[] = [];
  @Output() ask = new EventEmitter<string>();
  @Output() continue = new EventEmitter<void>();
}


