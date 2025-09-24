import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChatShellComponent } from './components/chat-shell.component';
import { Inject } from '@angular/core';
import { AppConfigService } from './config/app-config.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ChatShellComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  constructor(@Inject(AppConfigService) private readonly _cfg: AppConfigService) {}

  async ngOnInit(): Promise<void> {
    await this._cfg.load();
  }
}
