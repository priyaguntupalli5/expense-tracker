import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
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
import { CraEntry, SLIP_TYPES, slipInfo } from '../../models/cra.model';
import { CraService } from '../../services/cra.service';
import { CraFormComponent } from '../cra-form/cra-form.component';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-cra',
  imports: [
    CurrencyPipe, FormsModule,
    MatTableModule, MatIconModule, MatButtonModule,
    MatTooltipModule, MatCardModule, MatSelectModule, MatFormFieldModule,
  ],
  templateUrl: './cra.component.html',
  styleUrl: './cra.component.scss',
})
export class CraComponent implements OnInit {
  private readonly craService     = inject(CraService);
  private readonly dialog         = inject(MatDialog);
  private readonly snackBar       = inject(MatSnackBar);
  readonly settingsService        = inject(SettingsService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  entries: CraEntry[] = [];
  selectedYear = new Date().getFullYear() - 1;
  readonly years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
  readonly columns = ['person', 'slipType', 'issuer', 'amount', 'taxDeducted', 'notes', 'actions'];
  readonly slipTypes = SLIP_TYPES;

  ngOnInit() { this.load(); }

  load() {
    this.craService.getAll(this.selectedYear).subscribe(e => this.entries = e);
  }

  slipInfo(value: string) { return slipInfo(value); }

  get totalIncome(): number {
    return this.entries
      .filter(e => ['T4','T4A','T4E','T5','T3'].includes(e.slipType))
      .reduce((s, e) => s + Number(e.amount), 0);
  }

  get totalTaxDeducted(): number {
    return this.entries.reduce((s, e) => s + Number(e.taxDeducted ?? 0), 0);
  }

  get totalRrsp(): number {
    return this.entries
      .filter(e => e.slipType === 'RRSP' || e.slipType === 'FHSA')
      .reduce((s, e) => s + Number(e.amount), 0);
  }

  get totalDonations(): number {
    return this.entries
      .filter(e => e.slipType === 'DONATION')
      .reduce((s, e) => s + Number(e.amount), 0);
  }

  openAdd() {
    this.dialog.open(CraFormComponent, { width: '520px', maxWidth: '95vw' })
      .afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  openEdit(entry: CraEntry) {
    this.dialog.open(CraFormComponent, { width: '520px', maxWidth: '95vw', data: entry })
      .afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  confirmDelete(entry: CraEntry) {
    if (!confirm(`Delete ${entry.slipType} from ${entry.issuer}?`)) return;
    this.craService.delete(entry.id!).subscribe({
      next: () => { this.snackBar.open('Entry deleted', 'Dismiss', { duration: 2500 }); this.load(); },
      error: () => this.snackBar.open('Failed to delete', 'Dismiss', { duration: 3000 }),
    });
  }

  exportJson() {
    if (this.entries.length === 0) {
      this.snackBar.open('No entries to export', 'Dismiss', { duration: 2000 });
      return;
    }
    this.craService.exportToFile(this.entries, this.selectedYear);
  }

  triggerImport() { this.fileInput.nativeElement.click(); }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data: CraEntry[] = JSON.parse(reader.result as string);
        if (!Array.isArray(data)) throw new Error();
        // force the selected year onto imported entries
        data.forEach(e => e.taxYear = e.taxYear ?? this.selectedYear);
        this.craService.importEntries(data).subscribe({
          next: () => {
            this.snackBar.open(`${data.length} entries imported`, 'OK', { duration: 3000 });
            this.load();
          },
          error: () => this.snackBar.open('Import failed', 'Dismiss', { duration: 3000 }),
        });
      } catch {
        this.snackBar.open('Invalid file format', 'Dismiss', { duration: 3000 });
      }
      this.fileInput.nativeElement.value = '';
    };
    reader.readAsText(file);
  }
}
