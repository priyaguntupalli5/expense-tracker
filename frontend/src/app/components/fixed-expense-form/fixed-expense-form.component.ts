import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AsyncPipe } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { ExpenseService } from '../../services/expense.service';
import { Category, FixedExpense } from '../../models/expense.model';

export const RECURRENCE_OPTIONS = [
  { value: 'WEEKLY',    label: 'Weekly' },
  { value: 'BIWEEKLY',  label: 'Every 2 weeks' },
  { value: 'MONTHLY',   label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY',    label: 'Yearly' },
];

export const WEEKDAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function ordinal(n: number): string {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

@Component({
  selector: 'app-fixed-expense-form',
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatAutocompleteModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './fixed-expense-form.component.html',
  styleUrl: './fixed-expense-form.component.scss',
})
export class FixedExpenseFormComponent implements OnInit {
  private readonly fb             = inject(FormBuilder);
  private readonly expenseService = inject(ExpenseService);
  private readonly dialogRef      = inject(MatDialogRef<FixedExpenseFormComponent>);
  private readonly snackBar       = inject(MatSnackBar);
  readonly data: FixedExpense | null = inject(MAT_DIALOG_DATA, { optional: true });

  categories: Category[] = [];
  isEditing = false;
  saving    = false;

  readonly recurrenceOptions = RECURRENCE_OPTIONS;
  readonly weekdays = WEEKDAYS;
  readonly months   = MONTHS;

  readonly dayOfMonthOptions = Array.from({ length: 31 }, (_, i) => ({
    value: i + 1, label: ordinal(i + 1),
  }));
  readonly weekdayOptions = WEEKDAYS.map((label, i) => ({ value: i + 1, label }));
  readonly monthOptions   = MONTHS.map((label, i) => ({ value: i + 1, label }));

  private readonly subcategoriesSubject = new BehaviorSubject<string[]>([]);
  filteredSuggestions$!: Observable<string[]>;

  form = this.fb.group({
    category:     ['HOUSING', Validators.required],
    title:        ['', [Validators.required, Validators.maxLength(100)]],
    amount:       [null as number | null, [Validators.required, Validators.min(0.01)]],
    recurrence:   ['MONTHLY', Validators.required],
    paymentDay:   [null as number | null],
    paymentMonth: [null as number | null],
    startDate:    ['' as string],
    subcategory:  ['' as string | null],
    notes:        [''],
  });

  get recurrence(): string { return this.form.get('recurrence')?.value ?? 'MONTHLY'; }
  get isWeekly(): boolean { return this.recurrence === 'WEEKLY' || this.recurrence === 'BIWEEKLY'; }
  get isYearly(): boolean { return this.recurrence === 'YEARLY'; }

  get amountLabel(): string {
    const map: Record<string, string> = {
      WEEKLY: 'Weekly amount', BIWEEKLY: 'Biweekly amount',
      MONTHLY: 'Monthly amount', QUARTERLY: 'Quarterly amount', YEARLY: 'Yearly amount',
    };
    return map[this.recurrence] ?? 'Amount';
  }

  ngOnInit() {
    this.filteredSuggestions$ = combineLatest([
      this.form.get('title')!.valueChanges.pipe(startWith(this.form.get('title')!.value ?? '')),
      this.subcategoriesSubject,
    ]).pipe(
      map(([typed, subs]) => {
        const lower = (typed ?? '').toLowerCase().trim();
        if (!lower) return subs;
        return subs.filter(s => s.toLowerCase().includes(lower));
      })
    );

    this.expenseService.loadCategories().subscribe(cats => {
      this.categories = cats;
      if (!this.isEditing && cats.length > 0) {
        this.form.patchValue({ category: cats[0].value });
        this.loadSubcategories(cats[0].value);
      }
    });

    this.form.get('category')!.valueChanges.subscribe(val => {
      if (val) {
        this.form.patchValue({ subcategory: null }, { emitEvent: false });
        this.loadSubcategories(val);
      }
    });

    // Reset day/month pickers when recurrence type changes
    this.form.get('recurrence')!.valueChanges.subscribe(() => {
      this.form.patchValue({ paymentDay: null, paymentMonth: null }, { emitEvent: false });
    });

    if (this.data) {
      this.isEditing = true;
      this.form.patchValue({
        ...this.data,
        recurrence:   this.data.recurrence   ?? 'MONTHLY',
        paymentDay:   this.data.paymentDay   ?? null,
        paymentMonth: this.data.paymentMonth ?? null,
        startDate:    this.data.startDate    ?? '',
        subcategory:  this.data.subcategory  ?? null,
      });
      if (this.data.category) this.loadSubcategories(this.data.category);
    }
  }

  private loadSubcategories(categoryValue: string) {
    this.expenseService.getSubcategories(categoryValue).subscribe(subs => {
      this.subcategoriesSubject.next(subs);
    });
  }

  onSuggestionSelected(event: MatAutocompleteSelectedEvent) {
    this.form.patchValue({ subcategory: event.option.value }, { emitEvent: false });
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const expense: FixedExpense = {
      title:        v.title!,
      amount:       v.amount!,
      category:     v.category!,
      recurrence:   v.recurrence!,
      paymentDay:   v.paymentDay   ?? undefined,
      paymentMonth: this.isYearly ? (v.paymentMonth ?? undefined) : undefined,
      startDate:    v.startDate    || undefined,
      subcategory:  v.subcategory  || undefined,
      notes:        v.notes        || undefined,
    };

    const op = this.isEditing
      ? this.expenseService.updateFixedExpense(this.data!.id!, expense)
      : this.expenseService.createFixedExpense(expense);

    op.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEditing ? 'Fixed expense updated!' : 'Fixed expense added!',
          'OK', { duration: 3000 },
        );
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
