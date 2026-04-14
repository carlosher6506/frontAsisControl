import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RegistroRequest } from '../models/auth.model';
import { ENV_ASIS } from '../../config/environment';

@Injectable({ providedIn: 'root' })
export class RegisterService {
  private apiUrl = `${ENV_ASIS.apiUrl}/auth`;
  constructor(private http: HttpClient) {}

  registro(data: RegistroRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/registro`, data);
  }

  consultarCalificaciones(matricula: string): Observable<any> {
    return this.http.get(`${ENV_ASIS.apiUrl}/students/consulta/${matricula}`);
  }
}
