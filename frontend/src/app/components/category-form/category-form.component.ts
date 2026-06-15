import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExpenseService } from '../../services/expense.service';
import { Category } from '../../models/expense.model';

const COLOR_PALETTE = [
  '#e91e63', '#2196f3', '#ff9800', '#9c27b0', '#4caf50',
  '#00bcd4', '#ff5722', '#f44336', '#3f51b5', '#009688',
  '#8bc34a', '#ffc107', '#795548', '#673ab7', '#00acc1',
];

function randomColor(): string {
  return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
}

export const ICON_OPTIONS = [
  { value: 'restaurant',      label: 'Food' },
  { value: 'directions_car',  label: 'Transport' },
  { value: 'home',            label: 'Home / Housing' },
  { value: 'movie',           label: 'Entertainment' },
  { value: 'local_hospital',  label: 'Health' },
  { value: 'shopping_cart',   label: 'Shopping' },
  { value: 'school',          label: 'Education' },
  { value: 'fitness_center',  label: 'Fitness' },
  { value: 'flight',          label: 'Travel' },
  { value: 'pets',            label: 'Pets' },
  { value: 'child_care',      label: 'Kids' },
  { value: 'subscriptions',   label: 'Subscriptions' },
  { value: 'phone_iphone',    label: 'Phone' },
  { value: 'wifi',            label: 'Internet / Utilities' },
  { value: 'savings',         label: 'Savings' },
  { value: 'attach_money',    label: 'Finance' },
  { value: 'build',           label: 'Repairs' },
  { value: 'volunteer_activism', label: 'Donations' },
  { value: 'more_horiz',      label: 'Other' },
];

@Component({
  selector: 'app-category-form',
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.scss',
})
export class CategoryFormComponent implements OnInit {
  private readonly fb             = inject(FormBuilder);
  private readonly expenseService = inject(ExpenseService);
  private readonly dialogRef      = inject(MatDialogRef<CategoryFormComponent>);
  private readonly snackBar       = inject(MatSnackBar);
  readonly data: Category | null  = inject(MAT_DIALOG_DATA, { optional: true });

  readonly icons = ICON_OPTIONS;
  isEditing = false;
  saving    = false;

  form = this.fb.group({
    label: ['', [Validators.required, Validators.maxLength(50)]],
    icon:  ['more_horiz', Validators.required],
    color: [randomColor(), Validators.required],
  });

  ngOnInit() {
    if (this.data) {
      this.isEditing = true;
      this.form.patchValue({
        label: this.data.label,
        icon:  this.data.icon,
        color: this.data.color,
      });
    }
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const payload = { label: v.label!, icon: v.icon!, color: v.color! };

    const op = this.isEditing
      ? this.expenseService.updateCategory(this.data!.id!, payload)
      : this.expenseService.createCategory(payload);

    op.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEditing ? 'Category updated!' : 'Category added!',
          'OK', { duration: 3000 },
        );
        this.dialogRef.close(true);
      },
      error: (err) => {
        const msg = err?.error?.error ?? 'Failed to save category';
        this.snackBar.open(msg, 'OK', { duration: 5000 });
        this.saving = false;
      },
    });
  }

  cancel() { this.dialogRef.close(false); }
}
