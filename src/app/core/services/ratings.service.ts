import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Calificacion, CalificarRequest, Boleta } from '../models/rating.model';
import { ENV_ASIS } from '../../config/environment';

@Injectable({ providedIn: 'root' })
export class RatingsService {
  private apiUrl = `${ENV_ASIS.apiUrl}/ratings`;
  constructor(private http: HttpClient) {}

  calificar(data: CalificarRequest): Observable<Calificacion> {
    return this.http.post<Calificacion>(this.apiUrl, data);
  }

  obtenerCalificacionesPorAlumno(
    alumno_id: number,
    grupo_materia_id: number
  ): Observable<Calificacion[]> {
    return this.http.get<Calificacion[]>(
      `${this.apiUrl}/alumno/${alumno_id}/grupoMateria/${grupo_materia_id}`
    );
  }

  obtenerBoleta(alumno_id: number): Observable<Boleta> {
    return this.http.get<Boleta>(`${this.apiUrl}/boleta/${alumno_id}`);
  }
}
