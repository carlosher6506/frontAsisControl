import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, EMPTY, throwError } from 'rxjs';

const SESSION_DURATION = 60 * 60 * 1000; // 1 hora en ms

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  const rutasPublicas = ['/auth/login', '/auth/registro', '/auth/google', '/auth/google-callback'];
  const esPublica = rutasPublicas.some(ruta => req.url.includes(ruta));

  if (esPublica) {
    return next(req);
  }

  const token = localStorage.getItem('token');
  const loginTime = localStorage.getItem('login_time');

  // Verificar si la sesión expiró
  if (loginTime) {
    const elapsed = Date.now() - Number(loginTime);
    if (elapsed > SESSION_DURATION) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      localStorage.removeItem('login_time');
      router.navigate(['/login'], { queryParams: { expired: true } });
      return EMPTY;
    }
  }

  if (token) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // Token inválido o expirado en el backend
        if (error.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('usuario');
          localStorage.removeItem('login_time');
          router.navigate(['/login'], { queryParams: { expired: true } });
          return EMPTY; // ← cancela, no muestra error
        }
        return throwError(()=>error);
      })
    );
  }

  return next(req);
};
