import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { SettingsService, GroupSettings, JoinRequestItem } from '../../services/settings.service';
import { AuthService } from '../../services/auth.service';

export const CURRENCIES = [
  { code: 'CAD', label: 'CAD – Canadian Dollar' },
  { code: 'USD', label: 'USD – US Dollar' },
  { code: 'EUR', label: 'EUR – Euro' },
  { code: 'GBP', label: 'GBP – British Pound' },
  { code: 'INR', label: 'INR – Indian Rupee' },
  { code: 'AUD', label: 'AUD – Australian Dollar' },
  { code: 'NZD', label: 'NZD – New Zealand Dollar' },
  { code: 'JPY', label: 'JPY – Japanese Yen' },
  { code: 'CHF', label: 'CHF – Swiss Franc' },
  { code: 'SGD', label: 'SGD – Singapore Dollar' },
];

@Component({
  selector: 'app-settings',
  imports: [FormsModule, MatIconModule, MatButtonModule, MatSelectModule, MatFormFieldModule, MatTooltipModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private readonly settingsService = inject(SettingsService);
  private readonly snackBar = inject(MatSnackBar);
  readonly auth = inject(AuthService);
  readonly router = inject(Router);

  readonly currencies = CURRENCIES;

  settings: GroupSettings | null = null;
  joinRequests: JoinRequestItem[] = [];
  loading = true;
  selectedCurrency = this.settingsService.currency;
  currencySaved = false;
  codeCopied = false;

  ngOnInit() {
    this.settingsService.load().subscribe({
      next: s => {
        this.settings = s;
        this.selectedCurrency = s.currency;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
    this.loadJoinRequests();
  }

  private loadJoinRequests() {
    this.settingsService.loadJoinRequests().subscribe({
      next: reqs => this.joinRequests = reqs,
      error: () => {},
    });
  }

  approve(id: number) {
    this.settingsService.approveRequest(id).subscribe({
      next: () => {
        this.snackBar.open('Member approved!', 'OK', { duration: 2500 });
        this.loadJoinRequests();
        this.settingsService.load().subscribe(s => this.settings = s);
      },
      error: err => this.snackBar.open(err.error?.error ?? 'Failed to approve', 'OK', { duration: 3000 }),
    });
  }

  reject(id: number) {
    this.settingsService.rejectRequest(id).subscribe({
      next: () => {
        this.snackBar.open('Request rejected.', 'OK', { duration: 2500 });
        this.loadJoinRequests();
      },
      error: () => this.snackBar.open('Failed to reject', 'OK', { duration: 3000 }),
    });
  }

  removeMember(username: string) {
    if (!confirm(`Remove ${username} from the group?`)) return;
    this.settingsService.removeMember(username).subscribe({
      next: () => {
        this.snackBar.open(`${username} removed.`, 'OK', { duration: 2500 });
        this.settingsService.load().subscribe(s => this.settings = s);
      },
      error: err => this.snackBar.open(err.error?.error ?? 'Failed to remove member', 'OK', { duration: 3000 }),
    });
  }

  copyCode() {
    if (!this.settings?.groupCode) return;
    navigator.clipboard.writeText(this.settings.groupCode).then(() => {
      this.codeCopied = true;
      setTimeout(() => this.codeCopied = false, 2000);
    });
  }

  saveCurrency() {
    this.settingsService.saveCurrency(this.selectedCurrency).subscribe({
      next: () => {
        this.currencySaved = true;
        setTimeout(() => this.currencySaved = false, 2000);
        this.snackBar.open('Currency updated', 'OK', { duration: 2500 });
      },
      error: () => this.snackBar.open('Failed to save currency', 'OK', { duration: 3000 }),
    });
  }

  avatarColor(name: string): string {
    const colors = ['#e91e63', '#1976d2', '#9c27b0', '#00897b', '#f57c00', '#c62828'];
    return colors[name.charCodeAt(0) % colors.length];
  }

  initial(name: string): string { return name.charAt(0).toUpperCase(); }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' });
  }
}
