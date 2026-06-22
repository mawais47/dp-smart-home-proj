import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated) {
    return true;
  }

  return auth.loadSession().pipe(
    map(user => {
      if (user) {
        return true;
      }
      return router.createUrlTree(['/login']);
    })
  );
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated) {
    return router.createUrlTree(['/dashboard']);
  }

  return auth.loadSession().pipe(
    map(user => (user ? router.createUrlTree(['/dashboard']) : true))
  );
};
