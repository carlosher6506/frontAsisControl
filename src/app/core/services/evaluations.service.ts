import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfiguracionEvaluacion, CrearEvaluacion } from '../models/evaluation.model';
import { ENV_ASIS } from '../../config/environment';

@Injectable({ providedIn: 'root' })
export class EvaluationsService {
  private apiUrl = `${ENV_ASIS.apiUrl}/evaluations`;
  constructor(private http: HttpClient) {}

  obtenerEvaluaciones(): Observable<ConfiguracionEvaluacion[]> {
    return this.http.get<ConfiguracionEvaluacion[]>(this.apiUrl);
  }
  crearEvaluacion(data: CrearEvaluacion): Observable<ConfiguracionEvaluacion> {
    return this.http.post<ConfiguracionEvaluacion>(this.apiUrl, data);
  }
  eliminarEvaluacion(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
