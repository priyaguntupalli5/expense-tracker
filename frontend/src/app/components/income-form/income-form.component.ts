import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Income } from '../../models/expense.model';
import { IncomeService, SOURCE_TYPES } from '../../services/income.service';

export const INCOME_RECURRENCE_OPTIONS = [
  { value: 'WEEKLY',    label: 'Weekly' },
  { value: 'BIWEEKLY',  label: 'Every 2 weeks' },
  { value: 'MONTHLY',   label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY',    label: 'Yearly' },
];

function toIso(d: Date | null | undefined): string | undefined {
  if (!(d instanceof Date) || isNaN(d.getTime())) return undefined;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-income-form',
  providers: [provideNativeDateAdapter()],
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule,
    MatIconModule, MatSlideToggleModule, MatProgressSpinnerModule,
    MatDatepickerModule,
  ],
  templateUrl: './income-form.component.html',
  styleUrl: './income-form.component.scss',
})
export class IncomeFormComponent implements OnInit {
  private readonly fb            = inject(FormBuilder);
  private readonly incomeService = inject(IncomeService);
  private readonly dialogRef     = inject(MatDialogRef<IncomeFormComponent>);
  readonly data: Income | null   = inject(MAT_DIALOG_DATA, { optional: true });

  readonly sourceTypes       = SOURCE_TYPES;
  readonly recurrenceOptions = INCOME_RECURRENCE_OPTIONS;

  saving = false;

  form = this.fb.group({
    sourceType:  ['SALARY', Validators.required],
    title:       ['', Validators.required],
    amount:      [null as number | null, [Validators.required, Validators.min(0.01)]],
    notes:       [''],
    paymentDate: [null as Date | null],   // for non-recurring entries
    isRecurring: [false],
    recurrence:  ['MONTHLY'],
    startDate:   [null as Date | null],   // for recurring templates (first payment date)
  });

  private get dataIsTemplate(): boolean {
    if (!this.data) return false;
    return !!(this.data.isTemplate ?? (this.data as any)['template']);
  }
  get isEditing()    { return !!this.data?.id && !this.dataIsTemplate; }
  get isEditingTpl() { return !!this.data?.id && this.dataIsTemplate; }
  get isRecurring()  { return !!this.form.get('isRecurring')?.value; }
  get recurrence()   { return this.form.get('recurrence')?.value ?? 'MONTHLY'; }

  get amountLabel(): string {
    if (!this.isRecurring) return 'Amount';
    const map: Record<string, string> = {
      WEEKLY: 'Weekly amount', BIWEEKLY: 'Biweekly amount',
      MONTHLY: 'Monthly amount', QUARTERLY: 'Quarterly amount', YEARLY: 'Yearly amount',
    };
    return map[this.recurrence] ?? 'Amount';
  }

  ngOnInit() {
    if (!this.data) return;
    const patch: Record<string, unknown> = {};
    if (this.data.sourceType !== undefined) patch['sourceType'] = this.data.sourceType;
    if (this.data.title      !== undefined) patch['title']      = this.data.title;
    if (this.data.amount     !== undefined) patch['amount']     = this.data.amount;
    if (this.data.notes      !== undefined) patch['notes']      = this.data.notes ?? '';

    if (this.dataIsTemplate) {
      patch['isRecurring'] = true;
      patch['recurrence']  = this.data.recurrence ?? 'MONTHLY';
      patch['startDate']   = this.data.startDate ? new Date(this.data.startDate + 'T00:00:00') : null;
    } else if (this.data.paymentDate) {
      patch['paymentDate'] = new Date(this.data.paymentDate + 'T00:00:00');
    }
    this.form.patchValue(patch);
  }

  save() {
    if (this.form.invalid || this.saving) return;
    this.saving = true;
    const v = this.form.value;
    const recurring = !!v.isRecurring;

    const income: Income = {
      title:       v.title!,
      amount:      Number(v.amount),
      sourceType:  v.sourceType!,
      notes:       v.notes || undefined,
      isTemplate:  recurring,
      recurrence:  recurring ? (v.recurrence ?? undefined) : undefined,
      startDate:   recurring ? toIso(v.startDate as Date | null) : undefined,
      paymentDate: !recurring ? toIso(v.paymentDate as Date | null) : undefined,
    };

    const obs$ = (this.isEditingTpl || this.isEditing)
      ? this.incomeService.update(this.data!.id!, income)
      : this.incomeService.create(income);

    obs$.subscribe({
      next: saved => this.dialogRef.close(saved),
      error: () => { this.saving = false; },
    });
  }

  cancel() { this.dialogRef.close(null); }
}
