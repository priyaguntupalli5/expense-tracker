import { Component, OnInit, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
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

@Component({
  selector: 'app-income',
  imports: [
    CurrencyPipe, FormsModule,
    MatTableModule, MatIconModule, MatButtonModule,
    MatTooltipModule, MatCardModule, MatSelectModule, MatFormFieldModule,
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
  columns = ['source', 'title', 'amount', 'actions'];

  selectedMonth = new Date().getMonth() + 1;
  selectedYear  = new Date().getFullYear();

  readonly months = [
    { value: 1,  label: 'January' },   { value: 2,  label: 'February' },
    { value: 3,  label: 'March' },     { value: 4,  label: 'April' },
    { value: 5,  label: 'May' },       { value: 6,  label: 'June' },
    { value: 7,  label: 'July' },      { value: 8,  label: 'August' },
    { value: 9,  label: 'September' }, { value: 10, label: 'October' },
    { value: 11, label: 'November' },  { value: 12, label: 'December' },
  ];
  readonly years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  ngOnInit() { this.load(); }

  onPeriodChange() { this.loadEntries(); }

  get allItems(): Income[] {
    return [...this.templates, ...this.entries];
  }

  get total(): number {
    return this.entries.reduce((s, e) => s + Number(e.amount), 0);
  }

  isTemplateItem(item: Income): boolean {
    return !!(item.isTemplate || (item as any)['template']);
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

  openAdd() {
    const ref = this.dialog.open(IncomeFormComponent, {
      width: '500px', maxWidth: '95vw',
      data: { month: this.selectedMonth, year: this.selectedYear },
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
    const isTpl = this.isTemplateItem(item);
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
