import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { AsyncPipe } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
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

function toIso(d: Date | null | undefined): string | undefined {
  if (!(d instanceof Date) || isNaN(d.getTime())) return undefined;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function endNotBeforeStartValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start = group.get('startDate')?.value as Date | null;
    const end   = group.get('endDate')?.value as Date | null;
    return start && end && end < start ? { endBeforeStart: true } : null;
  };
}

@Component({
  selector: 'app-fixed-expense-form',
  providers: [provideNativeDateAdapter()],
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatAutocompleteModule,
    MatButtonModule, MatIconModule, MatDatepickerModule, MatProgressSpinnerModule,
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

  private readonly subcategoriesSubject = new BehaviorSubject<string[]>([]);
  filteredSuggestions$!: Observable<string[]>;

  form = this.fb.group({
    category:    ['HOUSING', Validators.required],
    title:       ['', [Validators.required, Validators.maxLength(100)]],
    amount:      [null as number | null, [Validators.required, Validators.min(0.01)]],
    recurrence:  ['MONTHLY', Validators.required],
    startDate:   [null as Date | null, Validators.required], // anchors generation and every date calculation
    endDate:     [null as Date | null],
    subcategory: ['' as string | null],
    notes:       ['' as string | null],
  }, { validators: [endNotBeforeStartValidator()] });

  get recurrence(): string { return this.form.get('recurrence')?.value ?? 'MONTHLY'; }

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

    if (this.data) {
      this.isEditing = true;
      this.form.patchValue({
        category:    this.data.category,
        title:       this.data.title,
        amount:      this.data.amount as unknown as number,
        recurrence:  this.data.recurrence  ?? 'MONTHLY',
        startDate:   this.data.startDate ? new Date(this.data.startDate + 'T00:00:00') : null,
        endDate:     this.data.endDate   ? new Date(this.data.endDate   + 'T00:00:00') : null,
        subcategory: this.data.subcategory ?? null,
        notes:       this.data.notes ?? null,
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
      title:       v.title!,
      amount:      v.amount!,
      category:    v.category!,
      recurrence:  v.recurrence!,
      startDate:   toIso(v.startDate as Date | null),
      endDate:     toIso(v.endDate as Date | null),
      subcategory: v.subcategory || undefined,
      notes:       v.notes || undefined,
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
      error: (err) => {
        const message = err?.error?.error ?? 'Failed to save. Is the backend running?';
        this.snackBar.open(message, 'OK', { duration: 4000 });
        this.saving = false;
      },
    });
  }

  cancel() { this.dialogRef.close(false); }
}
