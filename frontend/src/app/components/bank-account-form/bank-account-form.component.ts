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
import { SettingsService } from '../../services/settings.service';
import { BankAccount } from '../../models/expense.model';

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
  readonly data: BankAccount | null = inject(MAT_DIALOG_DATA, { optional: true });

  isEditing = false;
  saving    = false;
  members: string[] = [];

  form = this.fb.group({
    ownerName:      ['', [Validators.required, Validators.maxLength(50)]],
    accountName:    ['', [Validators.required, Validators.maxLength(100)]],
    openingBalance: [0, [Validators.required, Validators.min(0)]],
  });

  ngOnInit() {
    this.settingsService.load().subscribe(s => {
      this.members = s.members;
      if (!this.isEditing && !this.form.get('ownerName')?.value && s.members.length > 0) {
        this.form.patchValue({ ownerName: s.members[0] });
      }
    });

    if (this.data) {
      this.isEditing = true;
      this.form.patchValue({
        ownerName:      this.data.ownerName,
        accountName:    this.data.accountName,
        openingBalance: this.data.openingBalance ?? 0,
      });
    }
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const account: BankAccount = {
      ownerName:      v.ownerName!,
      accountName:    v.accountName!,
      openingBalance: v.openingBalance ?? 0,
    };

    const op = this.isEditing
      ? this.expenseService.updateBankAccount(this.data!.id!, account)
      : this.expenseService.createBankAccount(account);

    op.subscribe({
      next: () => {
        this.snackBar.open(this.isEditing ? 'Account updated!' : 'Account added!', 'OK', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: () => {
        this.snackBar.open('Failed to save. Is the backend running?', 'OK', { duration: 4000 });
        this.saving = false;
      },
    });
  }

  cancel() { this.dialogRef.close(false); }
}
