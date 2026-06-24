import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { LoginRequest, LoginResponse } from '../models/auth.model';
import { Usuario } from '../models/user.model';
import { ENV_ASIS } from '../../config/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private apiUrl = ENV_ASIS.apiUrl;

  constructor(private http: HttpClient) {}

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials)
      .pipe(
        tap(response => {
          localStorage.setItem('token', response.token);
          localStorage.setItem('usuario', JSON.stringify(response.usuario));
          localStorage.setItem('login_time', Date.now().toString());
        })
      );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getUsuario(): Usuario | null {
    const usuario = localStorage.getItem('usuario');
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
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/auth/google`, { id_token: idToken })
      .pipe(
        tap(response => {
          localStorage.setItem('token', response.token);
          localStorage.setItem('usuario', JSON.stringify(response.usuario));
          localStorage.setItem('login_time', Date.now().toString());
        })
      );
  }

  loginConGoogleCode(code: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/auth/google-callback`, { code })
      .pipe(
        tap(response => {
          localStorage.setItem('token', response.token);
          localStorage.setItem('usuario', JSON.stringify(response.usuario));
          localStorage.setItem('login_time', Date.now().toString());
        })
      );
  }
}
