import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExpenseService } from '../../services/expense.service';
import { AssetType, BankAccount } from '../../models/expense.model';

export interface SavingsEntryFormData {
  accounts: BankAccount[];
  month: number;
  year: number;
}

@Component({
  selector: 'app-savings-entry-form',
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatButtonToggleModule, MatProgressSpinnerModule,
  ],
  templateUrl: './savings-entry-form.component.html',
  styleUrl: './savings-entry-form.component.scss',
})
export class SavingsEntryFormComponent {
  private readonly fb             = inject(FormBuilder);
  private readonly expenseService = inject(ExpenseService);
  private readonly dialogRef      = inject(MatDialogRef<SavingsEntryFormComponent>);
  private readonly snackBar       = inject(MatSnackBar);
  readonly data: SavingsEntryFormData = inject(MAT_DIALOG_DATA);

  saving = false;

  form = this.fb.group({
    bankAccountId: [null as number | null, Validators.required],
    type:          ['DEPOSIT' as 'DEPOSIT' | 'WITHDRAWAL', Validators.required],
    assetType:     ['CASH' as AssetType, Validators.required],
    amount:        [null as number | null, [Validators.required, Validators.min(0.01)]],
    note:          ['', Validators.maxLength(255)],
  });

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const amount = v.type === 'WITHDRAWAL' ? -Math.abs(v.amount!) : Math.abs(v.amount!);

    this.expenseService.addSavingsEntry({
      bankAccountId: v.bankAccountId!,
      month: this.data.month,
      year: this.data.year,
      amount,
      assetType: v.assetType!,
      note: v.note || undefined,
    }).subscribe({
      next: () => {
        this.snackBar.open('Entry added', 'Dismiss', { duration: 2000 });
        this.dialogRef.close(true);
      },
      error: () => {
        this.snackBar.open('Failed to add entry', 'Dismiss', { duration: 3000 });
        this.saving = false;
      },
    });
  }

  cancel() { this.dialogRef.close(false); }
}
