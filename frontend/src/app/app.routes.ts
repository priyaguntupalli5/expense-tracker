import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ExpenseListComponent } from './components/expense-list/expense-list.component';
import { FixedExpensesComponent } from './components/fixed-expenses/fixed-expenses.component';
import { CategoriesComponent } from './components/categories/categories.component';

export const routes: Routes = [
  { path: '',               redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard',      component: DashboardComponent },
  { path: 'expenses',       component: ExpenseListComponent },
  { path: 'fixed-expenses', component: FixedExpensesComponent },
  { path: 'categories',     component: CategoriesComponent },
];
