import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExpenseService } from '../../services/expense.service';
import { FixedExpense, CATEGORIES } from '../../models/expense.model';

@Component({
  selector: 'app-fixed-expense-form',
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
  ],
  templateUrl: './fixed-expense-form.component.html',
  styleUrl: './fixed-expense-form.component.scss',
})
export class FixedExpenseFormComponent implements OnInit {
  private readonly fb             = inject(FormBuilder);
  private readonly expenseService = inject(ExpenseService);
  private readonly dialogRef      = inject(MatDialogRef<FixedExpenseFormComponent>);
  private readonly snackBar       = inject(MatSnackBar);
  readonly data: FixedExpense | null = inject(MAT_DIALOG_DATA, { optional: true });

  readonly categories = CATEGORIES;
  isEditing = false;

  form = this.fb.group({
    title:    ['', [Validators.required, Validators.maxLength(100)]],
    amount:   [null as number | null, [Validators.required, Validators.min(0.01)]],
    category: ['HOUSING', Validators.required],
    notes:    [''],
  });

  ngOnInit() {
    if (this.data) {
      this.isEditing = true;
      this.form.patchValue(this.data);
    }
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.value;
    const expense: FixedExpense = {
      title:    v.title!,
      amount:   v.amount!,
      category: v.category!,
      notes:    v.notes || undefined,
    };

    if (this.isEditing) {
      this.expenseService.updateFixedExpense(this.data!.id!, expense);
    } else {
      this.expenseService.createFixedExpense(expense);
    }

    this.snackBar.open(
      this.isEditing ? 'Fixed expense updated!' : 'Fixed expense added!',
      'OK',
      { duration: 3000 },
    );
    this.dialogRef.close(true);
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
