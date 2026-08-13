import { Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
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
import { SettingsService } from '../../services/settings.service';
import { AssetType, BankAccount, SavingsBalance } from '../../models/expense.model';

export interface SavingsTransferFormData {
  accounts: BankAccount[];
  balances: SavingsBalance[];
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

// Reads straight from the group being validated rather than the component's
// `form` field — Angular runs this once synchronously while fb.group() is
// still constructing that field, so `this.form` would still be undefined.
function sufficientBalanceValidator(getBalances: () => SavingsBalance[]): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const fromAccountId = group.get('fromAccountId')?.value;
    const assetType = group.get('assetType')?.value;
    const amount = group.get('amount')?.value;
    if (fromAccountId == null || !assetType || amount == null) return null;

    const balance = getBalances().find(b => b.bankAccountId === fromAccountId);
    const max = balance ? (assetType === 'INVESTMENT' ? Number(balance.investmentTillDate) : Number(balance.cashTillDate)) : 0;

    // Compare in whole cents — summed decimals arrive as floats (e.g. 199.99999999999997
    // instead of 200), which would otherwise flag an exact-balance transfer as short.
    const amountCents = Math.round(amount * 100);
    const maxCents = Math.round(max * 100);
    return amountCents > maxCents ? { insufficientBalance: true } : null;
  };
}

@Component({
  selector: 'app-savings-transfer-form',
  imports: [
    CurrencyPipe,
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
  readonly settingsService        = inject(SettingsService);
  readonly data: SavingsTransferFormData = inject(MAT_DIALOG_DATA);

  saving = false;

  form = this.fb.group({
    fromAccountId: [null as number | null, Validators.required],
    toAccountId:   [null as number | null, Validators.required],
    assetType:     ['CASH' as AssetType, Validators.required],
    amount:        [null as number | null, [Validators.required, Validators.min(0.01)]],
    note:          ['', Validators.maxLength(255)],
  }, { validators: [differentAccountsValidator(), sufficientBalanceValidator(() => this.data.balances)] });

  get availableBalance(): number | null {
    const fromAccountId = this.form.get('fromAccountId')?.value;
    const assetType = this.form.get('assetType')?.value;
    if (fromAccountId == null || !assetType) return null;
    const balance = this.data.balances.find(b => b.bankAccountId === fromAccountId);
    if (!balance) return 0;
    return assetType === 'INVESTMENT' ? Number(balance.investmentTillDate) : Number(balance.cashTillDate);
  }

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
      error: (err) => {
        const message = err?.error?.error ?? 'Failed to transfer';
        this.snackBar.open(message, 'Dismiss', { duration: 4000 });
        this.saving = false;
      },
    });
  }

  cancel() { this.dialogRef.close(false); }
}
