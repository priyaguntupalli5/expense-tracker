import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { SwPush } from '@angular/service-worker';
import { ExpenseService } from './services/expense.service';
import { ExpenseFormComponent } from './components/expense-form/expense-form.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatButtonModule, MatIconModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private readonly dialog         = inject(MatDialog);
  private readonly expenseService = inject(ExpenseService);
  private readonly swPush         = inject(SwPush);
  private readonly router         = inject(Router);

  ngOnInit() {
    if (this.swPush.isEnabled) {
      this.swPush.notificationClicks.subscribe(({ notification }) => {
        const url = (notification as any).data?.url ?? '/';
        this.router.navigateByUrl(url);
      });
    }
  }

  openAddExpense() {
    const ref = this.dialog.open(ExpenseFormComponent, {
      width: '520px',
      maxWidth: '95vw',
    });
    ref.afterClosed().subscribe(saved => {
      if (saved) this.expenseService.notifyRefresh();
    });
  }
}
