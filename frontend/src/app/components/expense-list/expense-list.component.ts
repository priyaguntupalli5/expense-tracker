import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, combineLatest, switchMap, takeUntil, merge, startWith, filter } from 'rxjs';
import { ExpenseService } from '../../services/expense.service';
import { SettingsService } from '../../services/settings.service';
import { Expense } from '../../models/expense.model';
import { ExpenseFormComponent } from '../expense-form/expense-form.component';

@Component({
  selector: 'app-expense-list',
  providers: [provideNativeDateAdapter()],
  imports: [
    CurrencyPipe, DatePipe, ReactiveFormsModule,
    MatTableModule, MatIconModule, MatButtonModule,
    MatTooltipModule, MatCardModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule,
    MatCheckboxModule, MatAutocompleteModule,
  ],
  templateUrl: './expense-list.component.html',
  styleUrl: './expense-list.component.scss',
})
export class ExpenseListComponent implements OnInit, OnDestroy {
  private readonly expenseService = inject(ExpenseService);
  private readonly dialog         = inject(MatDialog);
  private readonly snackBar       = inject(MatSnackBar);
  private readonly route          = inject(ActivatedRoute);
  readonly settingsService        = inject(SettingsService);
  private readonly destroy$       = new Subject<void>();

  expenses: Expense[] = [];
  viewingImage: string | null = null;
  titleFilter = '';
  tagFilter = '';
  highlightId: number | null = null;

  // Selection & tag state
  selectionMode = false;
  selectedIds = new Set<number>();
  availableTags: string[] = [];
  readonly tagCtrl = new FormControl<string>('');

  get displayedColumns(): string[] {
    return this.selectionMode
      ? ['select', 'date', 'title', 'category', 'amount', 'actions']
      : ['date', 'title', 'category', 'amount', 'actions'];
  }

  get allSelected(): boolean {
    const ids = this.filteredExpenses.map(e => e.id!);
    return ids.length > 0 && ids.every(id => this.selectedIds.has(id));
  }

  get someSelected(): boolean { return this.selectedIds.size > 0; }

  get filteredTags(): string[] {
    const v = (this.tagCtrl.value ?? '').toLowerCase();
    return v ? this.availableTags.filter(t => t.toLowerCase().includes(v)) : this.availableTags;
  }

  readonly startCtrl    = new FormControl<Date | null>(null);
  readonly endCtrl      = new FormControl<Date | null>(null);
  readonly categoryCtrl = new FormControl<string>('');

  get categories() { return this.expenseService.categories; }

  get filteredExpenses(): Expense[] {
    const cat   = this.categoryCtrl.value;
    const title = this.titleFilter.toLowerCase();
    return this.expenses.filter(e => {
      if (cat && e.category !== cat) return false;
      if (title && !e.title.toLowerCase().includes(title)) return false;
      if (this.tagFilter && e.tag !== this.tagFilter) return false;
      return true;
    });
  }

  clearTitleFilter() { this.titleFilter = ''; }
  clearTagFilter()   { this.tagFilter = ''; }
  filterByTag(tag: string) { this.tagFilter = tag; }

  isCredit(categoryValue: string, subcategory?: string): boolean {
    if (this.expenseService.getCategoryByValue(categoryValue)?.isIncome) return true;
    return (subcategory ?? '').toLowerCase().trim() === 'refunds & credits';
  }

  get total(): number {
    return this.filteredExpenses.reduce((sum, e) =>
      sum + (this.isCredit(e.category, e.subcategory) ? -Number(e.amount) : Number(e.amount)), 0);
  }

  constructor() {
    const now = new Date();
    this.startCtrl.setValue(new Date(now.getFullYear(), now.getMonth(), 1));
    this.endCtrl.setValue(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  }

  ngOnInit() {
    this.expenseService.loadCategories().subscribe();
    this.categoryCtrl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe();

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['title'])      this.titleFilter = params['title'];
      if (params['highlightId']) this.highlightId = Number(params['highlightId']);
      if (params['startDate']) this.startCtrl.setValue(new Date(params['startDate'] + 'T00:00:00'));
      if (params['endDate'])   this.endCtrl.setValue(new Date(params['endDate']   + 'T00:00:00'));
    });

    combineLatest([
      this.startCtrl.valueChanges.pipe(startWith(this.startCtrl.value)),
      this.endCtrl.valueChanges.pipe(startWith(this.endCtrl.value)),
      merge(this.expenseService.onRefresh$).pipe(startWith(null)),
    ]).pipe(
      filter(([start, end]) => !!start && !!end && (start as Date) <= (end as Date)),
      switchMap(([start, end]) =>
        this.expenseService.getByDateRange(
          this.toDateString(start as Date),
          this.toDateString(end as Date),
        )
      ),
      takeUntil(this.destroy$),
    ).subscribe(expenses => {
      this.expenses = expenses;
      if (this.highlightId) this.scrollToRow(this.highlightId);
    });
  }

  private scrollToRow(id: number) {
    setTimeout(() => {
      const el = document.getElementById(`expense-row-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('row--highlighted');
        setTimeout(() => el.classList.remove('row--highlighted'), 3000);
      }
    }, 150);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private toDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  toggleSelectionMode() {
    this.selectionMode = !this.selectionMode;
    if (this.selectionMode) {
      this.expenseService.getTags().subscribe(tags => { this.availableTags = tags.sort(); });
    } else {
      this.selectedIds.clear();
      this.tagCtrl.setValue('');
    }
  }

  toggleSelect(id: number) {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
  }

  isSelected(id: number): boolean { return this.selectedIds.has(id); }

  selectAll() {
    const ids = this.filteredExpenses.map(e => e.id!);
    if (this.allSelected) ids.forEach(id => this.selectedIds.delete(id));
    else ids.forEach(id => this.selectedIds.add(id));
  }

  applyTag() {
    const tag = this.tagCtrl.value?.trim() ?? '';
    const ids = [...this.selectedIds];
    if (!ids.length || !tag) return;
    this.expenseService.bulkTag(ids, tag).subscribe({
      next: () => {
        this.expenses.forEach(e => { if (e.id && this.selectedIds.has(e.id)) e.tag = tag; });
        if (!this.availableTags.includes(tag)) this.availableTags = [...this.availableTags, tag].sort();
        this.snackBar.open(`Label "${tag}" applied to ${ids.length} item(s)`, 'OK', { duration: 3000 });
        this.selectedIds.clear();
        this.tagCtrl.setValue('');
        this.selectionMode = false;
      },
      error: () => this.snackBar.open('Failed to apply label', 'Dismiss', { duration: 3000 }),
    });
  }

  clearSelectedTag() {
    const ids = [...this.selectedIds];
    if (!ids.length) return;
    this.expenseService.bulkTag(ids, null).subscribe({
      next: () => {
        this.expenses.forEach(e => { if (e.id && this.selectedIds.has(e.id)) e.tag = undefined; });
        this.snackBar.open('Label removed', 'OK', { duration: 3000 });
        this.selectedIds.clear();
        this.tagCtrl.setValue('');
        this.selectionMode = false;
      },
      error: () => this.snackBar.open('Failed to remove label', 'Dismiss', { duration: 3000 }),
    });
  }

  cancelSelection() {
    this.selectionMode = false;
    this.selectedIds.clear();
    this.tagCtrl.setValue('');
  }

  openAdd() {
    const ref = this.dialog.open(ExpenseFormComponent, { width: '520px', maxWidth: '95vw' });
    ref.afterClosed().subscribe(saved => { if (saved) this.expenseService.notifyRefresh(); });
  }

  openEdit(expense: Expense) {
    const ref = this.dialog.open(ExpenseFormComponent, {
      width: '520px', maxWidth: '95vw', data: expense,
    });
    ref.afterClosed().subscribe(saved => { if (saved) this.expenseService.notifyRefresh(); });
  }

  confirmDelete(expense: Expense) {
    if (!confirm(`Delete "${expense.title}"?`)) return;
    this.expenseService.delete(expense.id!).subscribe({
      next: () => {
        this.snackBar.open('Expense deleted', 'Dismiss', { duration: 3000 });
        this.expenseService.notifyRefresh();
      },
      error: () => this.snackBar.open('Failed to delete expense', 'Dismiss', { duration: 3000 }),
    });
  }

  getCategoryLabel(value: string) { return this.expenseService.getCategoryByValue(value)?.label ?? value; }
  getCategoryIcon(value: string)  { return this.expenseService.getCategoryByValue(value)?.icon ?? 'more_horiz'; }
  getCategoryColor(value: string) { return this.expenseService.getCategoryByValue(value)?.color ?? '#607d8b'; }
}
