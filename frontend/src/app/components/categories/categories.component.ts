import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExpenseService } from '../../services/expense.service';
import { Category } from '../../models/expense.model';
import { CategoryFormComponent } from '../category-form/category-form.component';

@Component({
  selector: 'app-categories',
  imports: [
    MatIconModule, MatButtonModule,
    MatTooltipModule, MatCardModule,
  ],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss',
})
export class CategoriesComponent implements OnInit {
  private readonly expenseService = inject(ExpenseService);
  private readonly dialog         = inject(MatDialog);
  private readonly snackBar       = inject(MatSnackBar);

  categories: Category[] = [];

  ngOnInit() {
    this.load();
  }

  private load() {
    this.expenseService.loadCategories().subscribe(cats => {
      this.categories = [...cats].sort((a, b) => {
        if (a.value === 'OTHER') return 1;
        if (b.value === 'OTHER') return -1;
        return a.label.localeCompare(b.label);
      });
    });
  }

  openAdd() {
    const ref = this.dialog.open(CategoryFormComponent, { width: '440px', maxWidth: '95vw' });
    ref.afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  openEdit(category: Category) {
    const ref = this.dialog.open(CategoryFormComponent, {
      width: '440px',
      maxWidth: '95vw',
      data: category,
    });
    ref.afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  confirmDelete(category: Category) {
    if (!confirm(`Delete category "${category.label}"?`)) return;
    this.expenseService.deleteCategory(category.id!).subscribe({
      next: () => {
        this.snackBar.open('Category deleted', 'Dismiss', { duration: 3000 });
        this.load();
      },
      error: (err) => {
        const msg = err?.error?.error ?? 'Failed to delete category';
        this.snackBar.open(msg, 'Dismiss', { duration: 5000 });
      },
    });
  }
}
