import { Injectable } from '@angular/core';

export interface ClientAppConfig {
  apiBase: string;
  useMockEndpoints?: boolean;
}

const DEFAULTS: ClientAppConfig = {
  apiBase: 'http://localhost:3000',
  useMockEndpoints: false
};

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private _config: ClientAppConfig = { ...DEFAULTS };

  get apiBase(): string { return this._config.apiBase; }
  get useMockEndpoints(): boolean { return !!this._config.useMockEndpoints; }

  async load(): Promise<void> {
    // Try to fetch /config.json from public assets. If it fails, keep defaults.
    try {
      const res = await fetch('/config.json', { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as Partial<ClientAppConfig>;
        this._config = { ...DEFAULTS, ...json } as ClientAppConfig;
      }
    } catch {
      // swallow and use defaults
      this._config = { ...DEFAULTS };
    }

    // Check URL parameters for debug mode
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('debug')) {
        const debugValue = urlParams.get('debug');
        if (debugValue === 'mock') {
          this._config.useMockEndpoints = true;
        }
      }
    }
  }
}


