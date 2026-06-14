import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly http    = inject(HttpClient);
  private readonly swPush  = inject(SwPush);

  readonly swAvailable = this.swPush.isEnabled;
  readonly enabled = signal(false);

  constructor() {
    // Reflect current subscription state on load
    this.swPush.subscription.subscribe(sub => this.enabled.set(!!sub));
  }

  async enable(): Promise<void> {
    const { publicKey } = await firstValueFrom(
      this.http.get<{ publicKey: string }>(`${API}/push/public-key`)
    );
    if (!publicKey) throw new Error('Notifications not yet configured on the server.');

    const sub = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
    await firstValueFrom(this.http.post(`${API}/push/subscribe`, sub.toJSON()));
    this.enabled.set(true);
  }

  async disable(): Promise<void> {
    const sub = await firstValueFrom(this.swPush.subscription);
    if (sub) {
      await firstValueFrom(
        this.http.delete(`${API}/push/unsubscribe`, { body: { endpoint: sub.endpoint } })
      );
      await sub.unsubscribe();
    }
    this.enabled.set(false);
  }
}
