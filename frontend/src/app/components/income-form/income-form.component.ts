import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Income } from '../../models/expense.model';
import { IncomeService, SOURCE_TYPES } from '../../services/income.service';

@Component({
  selector: 'app-income-form',
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './income-form.component.html',
  styleUrl: './income-form.component.scss',
})
export class IncomeFormComponent implements OnInit {
  private readonly fb            = inject(FormBuilder);
  private readonly incomeService = inject(IncomeService);
  private readonly dialogRef     = inject(MatDialogRef<IncomeFormComponent>);
  readonly data: Income | null   = inject(MAT_DIALOG_DATA, { optional: true });

  readonly sourceTypes = SOURCE_TYPES;
  saving = false;

  readonly months = [
    { value: 1,  label: 'January' },   { value: 2,  label: 'February' },
    { value: 3,  label: 'March' },     { value: 4,  label: 'April' },
    { value: 5,  label: 'May' },       { value: 6,  label: 'June' },
    { value: 7,  label: 'July' },      { value: 8,  label: 'August' },
    { value: 9,  label: 'September' }, { value: 10, label: 'October' },
    { value: 11, label: 'November' },  { value: 12, label: 'December' },
  ];

  readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  form = this.fb.group({
    title:      ['', Validators.required],
    amount:     [null as number | null, [Validators.required, Validators.min(0.01)]],
    sourceType: ['SALARY', Validators.required],
    month:      [new Date().getMonth() + 1, Validators.required],
    year:       [new Date().getFullYear(), Validators.required],
    notes:      [''],
  });

  get isEditing() { return !!this.data?.id; }

  ngOnInit() {
    if (!this.data) return;
    const patch: Record<string, unknown> = {};
    if (this.data.title      !== undefined) patch['title']      = this.data.title;
    if (this.data.amount     !== undefined) patch['amount']     = this.data.amount;
    if (this.data.sourceType !== undefined) patch['sourceType'] = this.data.sourceType;
    if (this.data.month      !== undefined) patch['month']      = this.data.month;
    if (this.data.year       !== undefined) patch['year']       = this.data.year;
    if (this.data.notes      !== undefined) patch['notes']      = this.data.notes ?? '';
    this.form.patchValue(patch);
  }

  save() {
    if (this.form.invalid || this.saving) return;
    this.saving = true;
    const v = this.form.value;
    const income: Income = {
      title:      v.title!,
      amount:     Number(v.amount),
      sourceType: v.sourceType!,
      month:      v.month!,
      year:       v.year!,
      notes:      v.notes || undefined,
    };

    const obs$ = this.isEditing
      ? this.incomeService.update(this.data!.id!, income)
      : this.incomeService.create(income);

    obs$.subscribe({
      next: saved => this.dialogRef.close(saved),
      error: () => { this.saving = false; },
    });
  }

  cancel() { this.dialogRef.close(null); }
}
