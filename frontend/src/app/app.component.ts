import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { ExpenseFormComponent } from './components/expense-form/expense-form.component';
import { ExpenseService } from './services/expense.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatButtonModule, MatIconModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly dialog = inject(MatDialog);
  private readonly expenseService = inject(ExpenseService);

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
