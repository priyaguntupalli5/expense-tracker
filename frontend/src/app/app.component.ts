import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SwPush } from '@angular/service-worker';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatButtonModule, MatIconModule, MatTooltipModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private readonly swPush = inject(SwPush);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  ngOnInit() {
    if (this.swPush.isEnabled) {
      this.swPush.notificationClicks.subscribe(({ notification }) => {
        const url = (notification as any).data?.url ?? '/';
        this.router.navigateByUrl(url);
      });
    }
  }
}
