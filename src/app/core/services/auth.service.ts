import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { LoginRequest, LoginResponse } from '../models/auth.model';
import { Usuario } from '../models/user.model';
import { ENV_ASIS } from '../../config/environment';
import { SweetAlertService } from './sweet-alert.service';

const SESSION_DURATION = 60 * 60 * 1000;
const SESSION_WARNING_OFFSET = 5 * 60 * 1000;
const TOKEN_KEY = 'token';
const USER_KEY = 'usuario';
const LOGIN_TIME_KEY = 'login_time';
const WARNING_SHOWN_KEY = 'session_warning_shown';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = ENV_ASIS.apiUrl;
  private warningTimer?: ReturnType<typeof setTimeout>;
  private expirationTimer?: ReturnType<typeof setTimeout>;
  private expiringSession = false;

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly sweetAlert: SweetAlertService,
  ) {
    this.restaurarSesion();
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials).pipe(
      tap(response => this.iniciarSesion(response))
    );
  }

  logout(): void {
    this.limpiarSesion();
  }

  isAuthenticated(): boolean {
    if (!localStorage.getItem(TOKEN_KEY) || this.sesionExpirada()) {
      this.limpiarSesion();
      return false;
    }
    return true;
  }

  sesionExpirada(): boolean {
    if (!localStorage.getItem(TOKEN_KEY)) return true;

    const loginTime = Number(localStorage.getItem(LOGIN_TIME_KEY));
    return !Number.isFinite(loginTime) || loginTime <= 0 ||
      Date.now() >= this.obtenerVencimientoSesion(loginTime);
  }

  expirarSesion(): void {
    if (this.expiringSession) return;
    this.expiringSession = true;
    this.limpiarSesion();
    void this.router.navigate(['/login'], { queryParams: { expired: true } });
  }

  getToken(): string | null {
    return this.isAuthenticated() ? localStorage.getItem(TOKEN_KEY) : null;
  }

  getUsuario(): Usuario | null {
    const usuario = localStorage.getItem(USER_KEY);
    return usuario ? JSON.parse(usuario) : null;
  }

  solicitarReset(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/solicitar-reset`, { email });
  }

  resetPassword(token: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/reset-password`, { token, password });
  }

  verificarEmail(token: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/auth/verificar/${token}`);
  }

  reenviarVerificacion(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/reenviar-verificacion`, { email });
  }

  loginConGoogle(idToken: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/google`, { id_token: idToken }).pipe(
      tap(response => this.iniciarSesion(response))
    );
  }

  loginConGoogleCode(code: string): Observable<LoginResponse> {
    const redirectUri = `${window.location.origin}/auth/callback`;
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/google-callback`, { code, redirect_uri: redirectUri }).pipe(
      tap(response => this.iniciarSesion(response))
    );
  }

  private iniciarSesion(response: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.usuario));
    localStorage.setItem(LOGIN_TIME_KEY, Date.now().toString());
    localStorage.removeItem(WARNING_SHOWN_KEY);
    this.expiringSession = false;
    this.programarSesion();
  }

  private restaurarSesion(): void {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    if (this.sesionExpirada()) {
      this.limpiarSesion();
      return;
    }
    this.programarSesion();
  }

  private programarSesion(): void {
    this.cancelarTemporizadores();
    const loginTime = Number(localStorage.getItem(LOGIN_TIME_KEY));
    const tiempoRestante = this.obtenerVencimientoSesion(loginTime) - Date.now();

    if (tiempoRestante <= 0) {
      this.expirarSesion();
      return;
    }

    const tiempoParaAviso = tiempoRestante - SESSION_WARNING_OFFSET;
    if (tiempoParaAviso > 0 && !localStorage.getItem(WARNING_SHOWN_KEY)) {
      this.warningTimer = setTimeout(() => this.mostrarAvisoDeSesion(), tiempoParaAviso);
    } else if (tiempoRestante <= SESSION_WARNING_OFFSET && !localStorage.getItem(WARNING_SHOWN_KEY)) {
      this.mostrarAvisoDeSesion();
    }

    this.expirationTimer = setTimeout(() => this.expirarSesion(), tiempoRestante);
  }

  private mostrarAvisoDeSesion(): void {
    if (!this.isAuthenticated() || localStorage.getItem(WARNING_SHOWN_KEY)) return;
    localStorage.setItem(WARNING_SHOWN_KEY, 'true');
    this.sweetAlert.warning(
      'La sesión está por terminar',
      'Por seguridad, tu sesión se cerrará automáticamente en 5 minutos.'
    );
  }

  private limpiarSesion(): void {
    this.cancelarTemporizadores();
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LOGIN_TIME_KEY);
    localStorage.removeItem(WARNING_SHOWN_KEY);
  }

  private cancelarTemporizadores(): void {
    if (this.warningTimer) clearTimeout(this.warningTimer);
    if (this.expirationTimer) clearTimeout(this.expirationTimer);
    this.warningTimer = undefined;
    this.expirationTimer = undefined;
  }

  private obtenerVencimientoSesion(loginTime: number): number {
    const vencimientoPorAplicacion = loginTime + SESSION_DURATION;
    const vencimientoJwt = this.obtenerVencimientoJwt();

    return vencimientoJwt
      ? Math.min(vencimientoPorAplicacion, vencimientoJwt)
      : vencimientoPorAplicacion;
  }

  private obtenerVencimientoJwt(): number | null {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    try {
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return null;

      const base64SinRelleno = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
      const base64 = base64SinRelleno.padEnd(Math.ceil(base64SinRelleno.length / 4) * 4, '=');
      const payload = JSON.parse(atob(base64));
      return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch {
      // Si el token no es un JWT válido, se conserva la duración local de una hora.
      return null;
    }
  }
}
