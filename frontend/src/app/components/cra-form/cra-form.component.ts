import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CraEntry, SLIP_TYPES } from '../../models/cra.model';
import { CraService } from '../../services/cra.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-cra-form',
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './cra-form.component.html',
  styleUrl: './cra-form.component.scss',
})
export class CraFormComponent implements OnInit {
  private readonly fb         = inject(FormBuilder);
  private readonly craService = inject(CraService);
  private readonly dialogRef  = inject(MatDialogRef<CraFormComponent>);
  private readonly auth       = inject(AuthService);
  readonly data: CraEntry | null = inject(MAT_DIALOG_DATA, { optional: true });

  readonly slipTypes = SLIP_TYPES;
  readonly currentYear = new Date().getFullYear();
  readonly years = Array.from({ length: 6 }, (_, i) => this.currentYear - i);

  saving = false;
  get isEditing() { return !!this.data?.id; }

  form = this.fb.group({
    taxYear:     [this.currentYear - 1, Validators.required],
    person:      [this.auth.currentUsername ?? '', Validators.required],
    slipType:    ['T4', Validators.required],
    issuer:      ['', [Validators.required, Validators.maxLength(150)]],
    amount:      [null as number | null, [Validators.required, Validators.min(0)]],
    taxDeducted: [null as number | null, Validators.min(0)],
    notes:       ['' as string | null],
  });

  ngOnInit() {
    if (this.data) {
      this.form.patchValue({
        taxYear:     this.data.taxYear,
        person:      this.data.person,
        slipType:    this.data.slipType,
        issuer:      this.data.issuer,
        amount:      this.data.amount as unknown as number,
        taxDeducted: (this.data.taxDeducted ?? null) as unknown as number,
        notes:       this.data.notes ?? null,
      });
    }
  }

  save() {
    if (this.form.invalid || this.saving) return;
    this.saving = true;
    const v = this.form.value;
    const entry: CraEntry = {
      taxYear:     v.taxYear!,
      person:      v.person!,
      slipType:    v.slipType!,
      issuer:      v.issuer!,
      amount:      Number(v.amount),
      taxDeducted: v.taxDeducted != null ? Number(v.taxDeducted) : undefined,
      notes:       v.notes || undefined,
    };
    const op$ = this.isEditing
      ? this.craService.update(this.data!.id!, entry)
      : this.craService.create(entry);

    op$.subscribe({
      next: saved => this.dialogRef.close(saved),
      error: () => { this.saving = false; },
    });
  }

  cancel() { this.dialogRef.close(null); }
}
