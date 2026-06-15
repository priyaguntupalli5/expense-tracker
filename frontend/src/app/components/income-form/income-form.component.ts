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

const WEEKDAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function ordinal(n: number): string {
  const s = ['th','st','nd','rd']; const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
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
  readonly weekdayOptions    = WEEKDAYS.map((label, i) => ({ value: i + 1, label }));
  readonly dayOfMonthOptions = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: ordinal(i + 1) }));
  readonly monthOptions      = MONTHS.map((label, i) => ({ value: i + 1, label }));

  readonly months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' },
    { value: 3, label: 'March' },   { value: 4, label: 'April' },
    { value: 5, label: 'May' },     { value: 6, label: 'June' },
    { value: 7, label: 'July' },    { value: 8, label: 'August' },
    { value: 9, label: 'September' },{ value: 10, label: 'October' },
    { value: 11, label: 'November' },{ value: 12, label: 'December' },
  ];
  readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  saving = false;

  form = this.fb.group({
    sourceType:  ['SALARY', Validators.required],
    title:       ['', Validators.required],
    amount:      [null as number | null, [Validators.required, Validators.min(0.01)]],
    month:       [new Date().getMonth() + 1, Validators.required],
    year:        [new Date().getFullYear(), Validators.required],
    notes:       [''],
    // recurrence
    isRecurring: [false],
    recurrence:  ['MONTHLY'],
    startDate:   [null as Date | null],
    paymentDay:  [null as number | null],
    paymentMonth:[null as number | null],
  });

  private get dataIsTemplate(): boolean {
    if (!this.data) return false;
    // Handle both "isTemplate" (fixed backend with @JsonProperty) and "template" (Jackson default naming)
    return !!(this.data.isTemplate ?? (this.data as any)['template']);
  }
  get isEditing()   { return !!this.data?.id && !this.dataIsTemplate; }
  get isEditingTpl(){ return !!this.data?.id && this.dataIsTemplate; }
  get isRecurring() { return !!this.form.get('isRecurring')?.value; }
  get recurrence()  { return this.form.get('recurrence')?.value ?? 'MONTHLY'; }
  get isWeekly()    { return this.recurrence === 'WEEKLY' || this.recurrence === 'BIWEEKLY'; }
  get isYearly()    { return this.recurrence === 'YEARLY'; }

  get amountLabel(): string {
    if (!this.isRecurring) return 'Amount';
    const map: Record<string, string> = {
      WEEKLY: 'Weekly amount', BIWEEKLY: 'Biweekly amount',
      MONTHLY: 'Monthly amount', QUARTERLY: 'Quarterly amount', YEARLY: 'Yearly amount',
    };
    return map[this.recurrence] ?? 'Amount';
  }

  ngOnInit() {
    this.form.get('recurrence')!.valueChanges.subscribe(() => {
      this.form.patchValue({ paymentDay: null, paymentMonth: null }, { emitEvent: false });
    });

    if (!this.data) return;
    const patch: Record<string, unknown> = {};
    if (this.data.sourceType  !== undefined) patch['sourceType']  = this.data.sourceType;
    if (this.data.title       !== undefined) patch['title']       = this.data.title;
    if (this.data.amount      !== undefined) patch['amount']      = this.data.amount;
    if (this.data.month       !== undefined) patch['month']       = this.data.month;
    if (this.data.year        !== undefined) patch['year']        = this.data.year;
    if (this.data.notes       !== undefined) patch['notes']       = this.data.notes ?? '';
    if (this.dataIsTemplate) {
      patch['isRecurring']  = true;
      patch['recurrence']   = this.data.recurrence  ?? 'MONTHLY';
      patch['startDate']    = this.data.startDate ? new Date(this.data.startDate + 'T00:00:00') : null;
      patch['paymentDay']   = this.data.paymentDay  ?? null;
      patch['paymentMonth'] = this.data.paymentMonth ?? null;
    }
    this.form.patchValue(patch);
  }

  save() {
    if (this.form.invalid || this.saving) return;
    this.saving = true;
    const v = this.form.value;
    const recurring = v.isRecurring;

    const startDateVal = recurring ? (v.startDate as Date | null) : null;
    const startDateStr = startDateVal instanceof Date
      ? `${startDateVal.getFullYear()}-${String(startDateVal.getMonth() + 1).padStart(2, '0')}-${String(startDateVal.getDate()).padStart(2, '0')}`
      : undefined;

    const income: Income = {
      title:      v.title!,
      amount:     Number(v.amount),
      sourceType: v.sourceType!,
      month:      v.month!,
      year:       v.year!,
      notes:      v.notes || undefined,
      isTemplate: recurring || false,
      recurrence: recurring ? (v.recurrence ?? undefined) : undefined,
      startDate:  startDateStr,
      paymentDay: recurring ? (v.paymentDay ?? undefined) : undefined,
      paymentMonth: (recurring && this.isYearly) ? (v.paymentMonth ?? undefined) : undefined,
    };

    let obs$;
    if (this.isEditingTpl || this.isEditing) {
      obs$ = this.incomeService.update(this.data!.id!, income);
    } else {
      obs$ = this.incomeService.create(income);
    }

    obs$.subscribe({
      next: saved => this.dialogRef.close(saved),
      error: () => { this.saving = false; },
    });
  }

  cancel() { this.dialogRef.close(null); }
}
