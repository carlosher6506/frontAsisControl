import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NivelAcademico, CrearNivelAcademico, ActualizarNivelAcademico } from '../models/academic-level.model';
import { ENV_ASIS } from '../../config/environment';

@Injectable({ providedIn: 'root' })
export class AcademicLevelsService {

  private apiUrl = `${ENV_ASIS.apiUrl}/academicLevels`;

  constructor(private http: HttpClient) {}

  obtenerNiveles(): Observable<NivelAcademico[]> {
    return this.http.get<NivelAcademico[]>(this.apiUrl);
  }

  crearNivel(data: CrearNivelAcademico): Observable<NivelAcademico> {
    return this.http.post<NivelAcademico>(this.apiUrl, data);
  }

  actualizarNivel(id: number, data: ActualizarNivelAcademico): Observable<NivelAcademico> {
    return this.http.put<NivelAcademico>(`${this.apiUrl}/${id}`, data);
  }

  eliminarNivel(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
