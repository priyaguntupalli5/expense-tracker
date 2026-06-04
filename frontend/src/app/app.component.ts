import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ExpenseFormComponent } from './components/expense-form/expense-form.component';
import { ExpenseService } from './services/expense.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatToolbarModule, MatButtonModule, MatIconModule,
    MatSnackBarModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly dialog = inject(MatDialog);
  private readonly expenseService = inject(ExpenseService);
  private readonly snackBar = inject(MatSnackBar);

  openAddExpense() {
    const ref = this.dialog.open(ExpenseFormComponent, {
      width: '520px',
      maxWidth: '95vw',
    });
    ref.afterClosed().subscribe(saved => {
      if (saved) this.expenseService.notifyRefresh();
    });
  }

  importStatements(files: FileList | null) {
    if (!files?.length) {
      return;
    }
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      this.expenseService.importCsv(text).subscribe(imported => {
        if (!imported.length) {
          this.snackBar.open('No valid expenses were found in this file.', 'OK', { duration: 4000 });
          return;
        }
        this.snackBar.open(`${imported.length} expenses imported successfully.`, 'OK', { duration: 4000 });
        this.expenseService.notifyRefresh();
      });
    };
    reader.onerror = () => {
      this.snackBar.open('Failed to read the uploaded file.', 'OK', { duration: 4000 });
    };
    reader.readAsText(file);
  }
}
