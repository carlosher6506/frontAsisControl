import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

const SESSION_DURATION = 60 * 60 * 1000; // 1 hora en ms

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  if (req.url.includes('/auth/login')) {
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
      return next(req);
    }
  }

  if (token) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next(authReq);
  }

  return next(req);
};
