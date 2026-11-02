import { Component, OnInit, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepicker, MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { Income } from '../../models/expense.model';
import { IncomeService, SOURCE_TYPES } from '../../services/income.service';
import { SettingsService } from '../../services/settings.service';
import { IncomeFormComponent } from '../income-form/income-form.component';

const RECURRENCE_LABELS: Record<string, string> = {
  WEEKLY: 'Weekly', BIWEEKLY: 'Every 2 weeks',
  MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', YEARLY: 'Yearly',
};

const MONTH_YEAR = { year: 'numeric', month: 'long' } as const;

@Component({
  selector: 'app-income',
  // The month picker shows and edits "November 2026" rather than a full date
  providers: [provideNativeDateAdapter({
    parse:   { dateInput: null },
    display: {
      dateInput: MONTH_YEAR,
      monthYearLabel: { year: 'numeric', month: 'short' },
      dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
      monthYearA11yLabel: MONTH_YEAR,
    },
  })],
  imports: [
    CurrencyPipe, DatePipe,
    MatTableModule, MatIconModule, MatButtonModule,
    MatTooltipModule, MatCardModule, MatFormFieldModule,
    MatDatepickerModule, MatInputModule,
  ],
  templateUrl: './income.component.html',
  styleUrl: './income.component.scss',
})
export class IncomeComponent implements OnInit {
  private readonly incomeService  = inject(IncomeService);
  private readonly dialog         = inject(MatDialog);
  private readonly snackBar       = inject(MatSnackBar);
  readonly settingsService        = inject(SettingsService);

  templates: Income[] = [];
  entries:   Income[] = [];
  columns = ['source', 'title', 'date', 'amount', 'actions'];

  selectedMonth = new Date().getMonth() + 1;
  selectedYear  = new Date().getFullYear();

  get selectedDate(): Date { return new Date(this.selectedYear, this.selectedMonth - 1, 1); }

  /** Recurring templates that have started by the end of the selected month. */
  get activeTemplates(): Income[] {
    const last = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-` +
                 String(new Date(this.selectedYear, this.selectedMonth, 0).getDate()).padStart(2, '0');
    return this.templates.filter(t => !t.startDate || t.startDate <= last);
  }

  ngOnInit() { this.load(); }

  pickMonth(date: Date, picker: MatDatepicker<Date>) {
    picker.close();
    this.setMonth(date);
  }

  shiftMonth(delta: number) {
    this.setMonth(new Date(this.selectedYear, this.selectedMonth - 1 + delta, 1));
  }

  private setMonth(date: Date) {
    this.selectedMonth = date.getMonth() + 1;
    this.selectedYear  = date.getFullYear();
    this.loadEntries();
  }

  get total(): number {
    return this.entries.reduce((s, e) => s + Number(e.amount), 0);
  }

  displayDate(item: Income): string | null {
    const d = item.paymentDate ?? item.startDate ?? null;
    return d ? d + 'T00:00:00' : null;
  }

  private load() {
    forkJoin([
      this.incomeService.getTemplates(),
      this.incomeService.getAll(this.selectedMonth, this.selectedYear),
    ]).subscribe(([templates, entries]) => {
      this.templates = templates;
      this.entries   = entries;
    });
  }

  private loadEntries() {
    this.incomeService.getAll(this.selectedMonth, this.selectedYear).subscribe(entries => {
      this.entries = entries;
    });
  }

  sourceInfo(value: string) {
    return SOURCE_TYPES.find(s => s.value === value) ?? SOURCE_TYPES[SOURCE_TYPES.length - 1];
  }

  recurrenceLabel(recurrence: string | undefined) {
    return recurrence ? (RECURRENCE_LABELS[recurrence] ?? recurrence) : '';
  }

  openAdd(recurring = false) {
    const data = recurring ? ({ isTemplate: true } as Income) : null;
    const ref = this.dialog.open(IncomeFormComponent, {
      width: '500px', maxWidth: '95vw', data,
    });
    ref.afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  openEdit(item: Income) {
    const ref = this.dialog.open(IncomeFormComponent, {
      width: '500px', maxWidth: '95vw',
      data: item,
    });
    ref.afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  confirmDelete(item: Income) {
    const isTpl = !!(item.isTemplate ?? (item as any)['template']);
    const msg = isTpl
      ? `Delete recurring template "${item.title}"? This will not remove already-generated entries.`
      : `Delete "${item.title}"?`;
    if (!confirm(msg)) return;
    this.incomeService.delete(item.id!).subscribe({
      next: () => {
        this.snackBar.open(isTpl ? 'Template deleted' : 'Income deleted', 'Dismiss', { duration: 3000 });
        this.load();
      },
      error: () => this.snackBar.open('Failed to delete', 'Dismiss', { duration: 3000 }),
    });
  }
}
