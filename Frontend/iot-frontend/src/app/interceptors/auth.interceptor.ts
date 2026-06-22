import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const sessionId = auth.sessionId;

  let authReq = req.clone({ withCredentials: true });
  if (sessionId && !req.headers.has('X-Session-ID')) {
    authReq = authReq.clone({
      setHeaders: { 'X-Session-ID': sessionId },
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthCheck = req.url.includes('/api/auth/me') || req.url.includes('/api/auth/login');
      if (error.status === 401 && !isAuthCheck) {
        auth.clearSession();
        if (!router.url.includes('/login')) {
          auth.redirectToLogin();
        }
      }
      return throwError(() => error);
    })
  );
};
