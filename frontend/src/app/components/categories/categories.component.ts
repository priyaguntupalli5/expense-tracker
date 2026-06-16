import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ExpenseService } from '../../services/expense.service';
import { Category, Subcategory } from '../../models/expense.model';
import { CategoryFormComponent } from '../category-form/category-form.component';

@Component({
  selector: 'app-categories',
  imports: [
    FormsModule,
    MatIconModule, MatButtonModule,
    MatTooltipModule, MatCardModule,
    MatFormFieldModule, MatInputModule,
  ],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss',
})
export class CategoriesComponent implements OnInit {
  private readonly expenseService = inject(ExpenseService);
  private readonly dialog         = inject(MatDialog);
  private readonly snackBar       = inject(MatSnackBar);

  categories: Category[] = [];

  expandedCategory: string | null = null;
  subcategoriesMap: Record<string, Subcategory[] | undefined> = {};
  newSubName: Record<string, string | undefined> = {};
  addingSubcategory: Record<string, boolean> = {};

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

  toggleExpand(categoryValue: string) {
    if (this.expandedCategory === categoryValue) {
      this.expandedCategory = null;
      return;
    }
    this.expandedCategory = categoryValue;
    this.loadSubcategories(categoryValue);
  }

  loadSubcategories(categoryValue: string) {
    this.expenseService.getSubcategoriesFull(categoryValue).subscribe(subs => {
      this.subcategoriesMap[categoryValue] = subs;
    });
  }

  addSubcategory(categoryValue: string) {
    const name = (this.newSubName[categoryValue] ?? '').trim();
    if (!name) return;
    this.addingSubcategory[categoryValue] = true;
    this.expenseService.addSubcategory(categoryValue, name).subscribe({
      next: () => {
        this.newSubName[categoryValue] = '';
        this.addingSubcategory[categoryValue] = false;
        this.loadSubcategories(categoryValue);
      },
      error: (err) => {
        const msg = err?.error?.error ?? 'Failed to add subcategory';
        this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
        this.addingSubcategory[categoryValue] = false;
      },
    });
  }

  removeSubcategory(sub: Subcategory, categoryValue: string) {
    this.expenseService.deleteSubcategory(sub.id).subscribe({
      next: () => this.loadSubcategories(categoryValue),
      error: () => this.snackBar.open('Failed to delete subcategory', 'Dismiss', { duration: 3000 }),
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
    if (category.isShared) {
      this.snackBar.open('Default categories cannot be deleted. Edit to customise for your group.', 'OK', { duration: 4000 });
      return;
    }
    if (!confirm(`Delete category "${category.label}"?`)) return;
    this.expenseService.deleteCategory(category.id!, false).subscribe({
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
