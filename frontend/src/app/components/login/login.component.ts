import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  mode: 'login' | 'register' = 'login';
  registerMode: 'create' | 'join' = 'create';
  loading = false;
  demoLoading = false;
  error = '';
  hidePassword = true;
  newGroupCode = '';
  joinPending = false;

  form = this.fb.group({
    username:  ['', [Validators.required, Validators.minLength(3)]],
    password:  ['', [Validators.required, Validators.minLength(8)]],
    groupName: [''],
    groupCode: ['', [Validators.pattern(/^\d{6}$/)]],
  });

  ngOnInit() {
    if (this.route.snapshot.data['startDemo']) {
      // Already signed in (demo or real): just show the app instead of starting another demo
      if (this.auth.isLoggedIn) this.router.navigate(['/dashboard']);
      else this.startDemo();
    }
  }

  startDemo() {
    this.demoLoading = true;
    this.error = '';
    this.auth.startDemo().subscribe({
      next: () => { this.demoLoading = false; this.router.navigate(['/dashboard']); },
      error: (err) => {
        this.demoLoading = false;
        this.error = err.error?.error ?? 'The demo could not be started. Please try again.';
      },
    });
  }

  switchMode(mode: 'login' | 'register') {
    this.mode = mode;
    this.registerMode = 'create';
    this.error = '';
    this.newGroupCode = '';
    this.joinPending = false;
    this.form.reset();
  }

  switchRegisterMode(m: 'create' | 'join') {
    this.registerMode = m;
    this.error = '';
    this.form.patchValue({ groupName: '', groupCode: '' });
  }

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';

    const { username, password, groupName, groupCode } = this.form.value;

    if (this.mode === 'login') {
      this.auth.login(username!, password!).subscribe({
        next: () => { this.loading = false; this.router.navigate(['/dashboard']); },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.error ?? 'Invalid username or password.';
        },
      });
      return;
    }

    if (this.registerMode === 'create' && !groupName?.trim()) {
      this.error = 'Group name is required.';
      this.loading = false;
      return;
    }
    if (this.registerMode === 'join' && !/^\d{6}$/.test(groupCode ?? '')) {
      this.error = 'Enter a valid 6-digit group code.';
      this.loading = false;
      return;
    }

    this.auth.register(
      username!,
      password!,
      this.registerMode === 'create' ? groupName!.trim() : undefined,
      this.registerMode === 'join'   ? groupCode!.trim() : undefined,
    ).subscribe({
      next: (result) => {
        this.loading = false;
        if (result.pending) {
          this.joinPending = true;
        } else if (this.registerMode === 'create' && this.auth.lastCreatedGroupCode) {
          this.newGroupCode = this.auth.lastCreatedGroupCode;
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error ?? 'Registration failed.';
      },
    });
  }
}
