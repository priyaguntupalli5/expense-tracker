import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ExpenseListComponent } from './components/expense-list/expense-list.component';
import { FixedExpensesComponent } from './components/fixed-expenses/fixed-expenses.component';
import { CategoriesComponent } from './components/categories/categories.component';
import { SettingsComponent } from './components/settings/settings.component';
import { IncomeComponent } from './components/income/income.component';
import { CraComponent } from './components/cra/cra.component';
import { LoginComponent } from './components/login/login.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login',          component: LoginComponent },
  { path: '',               redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard',      component: DashboardComponent,      canActivate: [authGuard] },
  { path: 'income',         component: IncomeComponent,          canActivate: [authGuard] },
  { path: 'expenses',       component: ExpenseListComponent,     canActivate: [authGuard] },
  { path: 'fixed-expenses', component: FixedExpensesComponent,   canActivate: [authGuard] },
  { path: 'categories',     component: CategoriesComponent,      canActivate: [authGuard] },
  { path: 'cra',            component: CraComponent,             canActivate: [authGuard] },
  { path: 'settings',       component: SettingsComponent,        canActivate: [authGuard] },
];
