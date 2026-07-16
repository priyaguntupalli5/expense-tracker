import { Component, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AsyncPipe } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { ExpenseService } from '../../services/expense.service';
import { Category, Expense } from '../../models/expense.model';

@Component({
  selector: 'app-expense-form',
  providers: [provideNativeDateAdapter()],
  imports: [
    AsyncPipe, ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatAutocompleteModule, MatDatepickerModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './expense-form.component.html',
  styleUrl: './expense-form.component.scss',
})
export class ExpenseFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly expenseService = inject(ExpenseService);
  private readonly dialogRef = inject(MatDialogRef<ExpenseFormComponent>);
  private readonly snackBar = inject(MatSnackBar);
  readonly data: Expense | null = inject(MAT_DIALOG_DATA, { optional: true });

  categories: Category[] = [];
  isEditing = false;
  saving = false;

  private readonly subcategoriesSubject = new BehaviorSubject<string[]>([]);
  filteredSuggestions$!: Observable<string[]>;

  form = this.fb.group({
    category:    ['FOOD', Validators.required],
    title:       ['', [Validators.required, Validators.maxLength(100)]],
    amount:      [null as number | null, [Validators.required, Validators.min(0.01)]],
    subcategory: ['' as string | null],
    date:        [new Date(), Validators.required],
    notes:       [''],
    imageData:   ['' as string | null],
  });

  ngOnInit() {
    // Filtered suggestions react to both title input and subcategory list changes
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
        ...this.data,
        date: new Date(this.data.date + 'T00:00:00'),
        subcategory: this.data.subcategory ?? null,
        imageData: this.data.imageData ?? null,
      });
      if (this.data.category) {
        this.loadSubcategories(this.data.category);
      }
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

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1024;
        const ratio = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        this.form.patchValue({ imageData: canvas.toDataURL('image/jpeg', 0.75) });
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeImage() {
    this.form.patchValue({ imageData: null });
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const d = v.date as Date;
    const expense: Expense = {
      title:       v.title!,
      amount:      v.amount!,
      category:    v.category!,
      subcategory: v.subcategory || undefined,
      date:        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      notes:       v.notes || undefined,
      imageData:   v.imageData || undefined,
    };

    const op = this.isEditing
      ? this.expenseService.update(this.data!.id!, expense)
      : this.expenseService.create(expense);

    op.subscribe({
      next: () => {
        this.snackBar.open(this.isEditing ? 'Expense updated!' : 'Expense added!', 'OK', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: () => {
        this.snackBar.open('Failed to save. Is the backend running?', 'OK', { duration: 4000 });
        this.saving = false;
      },
    });
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
