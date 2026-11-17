import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn) return true;
  // New visitors (e.g. from the portfolio link) go straight into the demo;
  // anyone who has signed in with a real account on this device gets the sign-in page
  router.navigate([auth.hasSignedInBefore ? '/login' : '/demo']);
  return false;
};
