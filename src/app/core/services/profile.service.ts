import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PerfilMaestro } from '../models/profile.model';
import { ENV_ASIS } from '../../config/environment';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private apiUrl = `${ENV_ASIS.apiUrl}/profile`;
  constructor(private http: HttpClient) {}

  obtenerPerfil(): Observable<PerfilMaestro> {
    return this.http.get<PerfilMaestro>(this.apiUrl);
  }

  guardarPerfil(data: PerfilMaestro): Observable<PerfilMaestro> {
    return this.http.post<PerfilMaestro>(this.apiUrl, data);
  }
}
