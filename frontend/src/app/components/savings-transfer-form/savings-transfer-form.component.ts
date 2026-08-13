import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ExpenseService } from '../../services/expense.service';
import { AssetType, BankAccount } from '../../models/expense.model';

export interface SavingsTransferFormData {
  accounts: BankAccount[];
  month: number;
  year: number;
}

function differentAccountsValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const from = group.get('fromAccountId')?.value;
    const to = group.get('toAccountId')?.value;
    return from != null && to != null && from === to ? { sameAccount: true } : null;
  };
}

@Component({
  selector: 'app-savings-transfer-form',
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatButtonToggleModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './savings-transfer-form.component.html',
  styleUrl: './savings-transfer-form.component.scss',
})
export class SavingsTransferFormComponent {
  private readonly fb             = inject(FormBuilder);
  private readonly expenseService = inject(ExpenseService);
  private readonly dialogRef      = inject(MatDialogRef<SavingsTransferFormComponent>);
  private readonly snackBar       = inject(MatSnackBar);
  readonly data: SavingsTransferFormData = inject(MAT_DIALOG_DATA);

  saving = false;

  form = this.fb.group({
    fromAccountId: [null as number | null, Validators.required],
    toAccountId:   [null as number | null, Validators.required],
    assetType:     ['CASH' as AssetType, Validators.required],
    amount:        [null as number | null, [Validators.required, Validators.min(0.01)]],
    note:          ['', Validators.maxLength(255)],
  }, { validators: differentAccountsValidator() });

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;

    this.expenseService.transferSavings({
      fromAccountId: v.fromAccountId!,
      toAccountId: v.toAccountId!,
      amount: v.amount!,
      assetType: v.assetType!,
      month: this.data.month,
      year: this.data.year,
      note: v.note || undefined,
    }).subscribe({
      next: () => {
        this.snackBar.open('Transfer complete', 'Dismiss', { duration: 2000 });
        this.dialogRef.close(true);
      },
      error: () => {
        this.snackBar.open('Failed to transfer', 'Dismiss', { duration: 3000 });
        this.saving = false;
      },
    });
  }

  cancel() { this.dialogRef.close(false); }
}
