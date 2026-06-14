import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExpenseService } from '../../services/expense.service';
import { Category, Expense } from '../../models/expense.model';

@Component({
  selector: 'app-expense-form',
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatDatepickerModule, MatNativeDateModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './expense-form.component.html',
  styleUrl: './expense-form.component.scss',
})
export class ExpenseFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly expenseService = inject(ExpenseService);
  private readonly dialogRef = inject(MatDialogRef<ExpenseFormComponent>);
  private readonly snackBar = inject(MatSnackBar);
  readonly data: Expense | null = inject(MAT_DIALOG_DATA, { optional: true });

  categories: Category[] = [];
  isEditing = false;
  saving = false;

  form = this.fb.group({
    title:    ['',    [Validators.required, Validators.maxLength(100)]],
    amount:   [null as number | null, [Validators.required, Validators.min(0.01)]],
    category: ['FOOD', Validators.required],
    date:     [new Date(), Validators.required],
    notes:    [''],
  });

  ngOnInit() {
    this.expenseService.loadCategories().subscribe(cats => {
      this.categories = cats;
      if (!this.isEditing && cats.length > 0) {
        this.form.patchValue({ category: cats[0].value });
      }
    });
    if (this.data) {
      this.isEditing = true;
      this.form.patchValue({
        ...this.data,
        date: new Date(this.data.date),
      });
    }
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const d = v.date as Date;
    const expense: Expense = {
      title:    v.title!,
      amount:   v.amount!,
      category: v.category!,
      date:     `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      notes:    v.notes || undefined,
    };

    const op = this.isEditing
      ? this.expenseService.update(this.data!.id!, expense)
      : this.expenseService.create(expense);

    op.subscribe({
      next: () => {
        this.snackBar.open(this.isEditing ? 'Expense updated!' : 'Expense added!', 'OK', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: () => {
        this.snackBar.open('Failed to save. Is the backend running?', 'OK', { duration: 4000 });
        this.saving = false;
      },
    });
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
