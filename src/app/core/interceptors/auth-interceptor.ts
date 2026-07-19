import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, EMPTY, throwError } from 'rxjs';

const SESSION_DURATION = 60 * 60 * 1000;
const RUTAS_PUBLICAS = [
  '/auth/login',
  '/auth/registro',
  '/auth/google',
  '/auth/google-callback',
  '/auth/solicitar-reset',
  '/auth/reset-password',
  '/auth/verificar',
  '/auth/reenviar-verificacion',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const esPublica = RUTAS_PUBLICAS.some(ruta => req.url.includes(ruta));
  if (esPublica) return next(req);

  const token = localStorage.getItem('token');
  const loginTime = Number(localStorage.getItem('login_time'));
  const jwtExpirado = (() => {
    if (!token) return true;
    try {
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return false;
      const base64SinRelleno = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      const base64 = base64SinRelleno.padEnd(Math.ceil(base64SinRelleno.length / 4) * 4, '=');
      const payload = JSON.parse(atob(base64));
      return typeof payload.exp === 'number' && Date.now() >= payload.exp * 1000;
    } catch {
      return false;
    }
  })();
  const sesionExpirada = !token || !Number.isFinite(loginTime) ||
    loginTime <= 0 || Date.now() >= loginTime + SESSION_DURATION || jwtExpirado;

  const expirarSesion = (): void => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    localStorage.removeItem('login_time');
    localStorage.removeItem('session_warning_shown');
    void router.navigate(['/login'], { queryParams: { expired: true } });
  };

  if (sesionExpirada) {
    expirarSesion();
    return EMPTY;
  }

  const authReq = req.clone({
    headers: req.headers.set('Authorization', `Bearer ${token}`)
  });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        expirarSesion();
        return EMPTY;
      }
      return throwError(() => error);
    })
  );
};
