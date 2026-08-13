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
import { Observable, forkJoin } from 'rxjs';
import { ExpenseService } from '../../services/expense.service';
import { SettingsService } from '../../services/settings.service';
import { BankAccount } from '../../models/expense.model';

export interface BankAccountFormData {
  month: number;
  year: number;
  // present only when editing an existing account
  account?: BankAccount;
  currentCashBalance?: number;
  currentInvestmentBalance?: number;
  currentCashThisMonth?: number;
  currentInvestmentThisMonth?: number;
}

@Component({
  selector: 'app-bank-account-form',
  imports: [
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './bank-account-form.component.html',
  styleUrl: './bank-account-form.component.scss',
})
export class BankAccountFormComponent implements OnInit {
  private readonly fb             = inject(FormBuilder);
  private readonly expenseService = inject(ExpenseService);
  private readonly settingsService = inject(SettingsService);
  private readonly dialogRef      = inject(MatDialogRef<BankAccountFormComponent>);
  private readonly snackBar       = inject(MatSnackBar);
  readonly data: BankAccountFormData | null = inject(MAT_DIALOG_DATA, { optional: true });

  isEditing = false;
  saving    = false;
  members: string[] = [];

  readonly months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' },
    { value: 3, label: 'March' },   { value: 4, label: 'April' },
    { value: 5, label: 'May' },     { value: 6, label: 'June' },
    { value: 7, label: 'July' },    { value: 8, label: 'August' },
    { value: 9, label: 'September' },{ value: 10,label: 'October' },
    { value: 11,label: 'November' },{ value: 12,label: 'December' },
  ];

  form = this.fb.group({
    ownerName:              ['', [Validators.required, Validators.maxLength(50)]],
    accountName:            ['', [Validators.required, Validators.maxLength(100)]],
    cashBalance:            [0, [Validators.required, Validators.min(0)]],
    investmentBalance:      [0, [Validators.required, Validators.min(0)]],
    cashTillDate:           [0, [Validators.required, Validators.min(0)]],
    investmentTillDate:     [0, [Validators.required, Validators.min(0)]],
    cashThisMonth:          [0, [Validators.required]],
    investmentThisMonth:    [0, [Validators.required]],
  });

  ngOnInit() {
    this.settingsService.load().subscribe(s => {
      this.members = s.members;
      if (!this.isEditing && !this.form.get('ownerName')?.value && s.members.length > 0) {
        this.form.patchValue({ ownerName: s.members[0] });
      }
    });

    if (this.data?.account) {
      this.isEditing = true;
      const { account, currentCashBalance, currentInvestmentBalance, currentCashThisMonth, currentInvestmentThisMonth } = this.data;
      this.form.patchValue({
        ownerName:            account.ownerName,
        accountName:          account.accountName,
        cashTillDate:         currentCashBalance,
        investmentTillDate:   currentInvestmentBalance,
        cashThisMonth:        currentCashThisMonth,
        investmentThisMonth:  currentInvestmentThisMonth,
      });
    }
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const { month, year } = this.data!;

    if (this.isEditing) {
      const account = this.data!.account!;
      const updated: BankAccount = {
        ownerName:      v.ownerName!,
        accountName:    v.accountName!,
        openingBalance: account.openingBalance,
      };

      const round = (n: number) => Math.round(n * 100) / 100;

      // Per type: apply the "this month" change first as a normal entry in the
      // selected month (it naturally rolls into Till Date too), then make up
      // whatever's left of the Till Date change with an entry dated the month
      // before — so Till Date and This Month can be edited independently.
      const buildOps = (
        assetType: 'CASH' | 'INVESTMENT',
        currentTillDate: number, newTillDate: number,
        currentThisMonth: number, newThisMonth: number,
      ): Observable<unknown>[] => {
        const ops: Observable<unknown>[] = [];
        const thisMonthDelta = round(newThisMonth - currentThisMonth);
        const tillDateAfterMonthEdit = round(currentTillDate + thisMonthDelta);
        const priorDelta = round(newTillDate - tillDateAfterMonthEdit);

        if (Math.abs(thisMonthDelta) >= 0.01) {
          ops.push(this.expenseService.addSavingsEntry({
            bankAccountId: account.id!, month, year,
            amount: thisMonthDelta, assetType, note: 'Balance adjustment',
          }));
        }
        if (Math.abs(priorDelta) >= 0.01) {
          const prevMonth = month === 1 ? 12 : month - 1;
          const prevYear  = month === 1 ? year - 1 : year;
          ops.push(this.expenseService.addSavingsEntry({
            bankAccountId: account.id!, month: prevMonth, year: prevYear,
            amount: priorDelta, assetType, note: 'Balance adjustment',
          }));
        }
        return ops;
      };

      const ops: Observable<unknown>[] = [
        this.expenseService.updateBankAccount(account.id!, updated),
        ...buildOps('CASH', this.data!.currentCashBalance!, v.cashTillDate ?? 0,
          this.data!.currentCashThisMonth!, v.cashThisMonth ?? 0),
        ...buildOps('INVESTMENT', this.data!.currentInvestmentBalance!, v.investmentTillDate ?? 0,
          this.data!.currentInvestmentThisMonth!, v.investmentThisMonth ?? 0),
      ];

      forkJoin(ops).subscribe({
        next: () => {
          this.snackBar.open('Account updated!', 'OK', { duration: 3000 });
          this.dialogRef.close(true);
        },
        error: () => {
          this.snackBar.open('Failed to save. Is the backend running?', 'OK', { duration: 4000 });
          this.saving = false;
        },
      });
    } else {
      const cash       = v.cashBalance ?? 0;
      const investment = v.investmentBalance ?? 0;

      if (cash <= 0 && investment <= 0) {
        this.snackBar.open('Enter a Cash or Investment balance', 'OK', { duration: 3000 });
        this.saving = false;
        return;
      }

      // One account either way — cash and investment become separately typed
      // entries under it, so the account never has to be split into two rows.
      this.expenseService.createBankAccount({
        ownerName: v.ownerName!, accountName: v.accountName!, openingBalance: 0,
      }).subscribe({
        next: created => {
          const entryOps: Observable<unknown>[] = [];
          if (cash > 0) {
            entryOps.push(this.expenseService.addSavingsEntry({
              bankAccountId: created.id!, month, year,
              amount: cash, assetType: 'CASH', isOpeningBalance: true, note: 'Opening balance',
            }));
          }
          if (investment > 0) {
            entryOps.push(this.expenseService.addSavingsEntry({
              bankAccountId: created.id!, month, year,
              amount: investment, assetType: 'INVESTMENT', isOpeningBalance: true, note: 'Opening balance',
            }));
          }

          (entryOps.length ? forkJoin(entryOps) : forkJoin([])).subscribe({
            next: () => {
              this.snackBar.open('Account added!', 'OK', { duration: 3000 });
              this.dialogRef.close(true);
            },
            error: () => {
              this.snackBar.open('Account created, but balances failed to save', 'OK', { duration: 4000 });
              this.saving = false;
            },
          });
        },
        error: () => {
          this.snackBar.open('Failed to save. Is the backend running?', 'OK', { duration: 4000 });
          this.saving = false;
        },
      });
    }
  }

  cancel() { this.dialogRef.close(false); }
}
