import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  mode: 'login' | 'register' = 'login';
  loading = false;
  error = '';
  hidePassword = true;

  form = this.fb.group({
    name:     [''],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  switchMode(mode: 'login' | 'register') {
    this.mode = mode;
    this.error = '';
    this.form.reset();
  }

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';

    const { email, password, name } = this.form.value;

    const req$ = this.mode === 'login'
      ? this.auth.login(email!, password!)
      : this.auth.register(email!, password!, name || email!);

    req$.subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error ?? (this.mode === 'login' ? 'Invalid email or password.' : 'Registration failed.');
      },
    });
  }
}
