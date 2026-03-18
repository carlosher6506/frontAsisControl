import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NivelEducativo, CrearNivelEducativo } from '../models/education-level.model';
import { ENV_ASIS } from '../../config/environment';

@Injectable({ providedIn: 'root' })
export class EducationLevelsService {

  private apiUrl = `${ENV_ASIS.apiUrl}/educationLevels`;

  constructor(private http: HttpClient) {}

  obtenerNiveles(): Observable<NivelEducativo[]> {
    return this.http.get<NivelEducativo[]>(this.apiUrl);
  }

  crearNivel(data: CrearNivelEducativo): Observable<NivelEducativo> {
    return this.http.post<NivelEducativo>(this.apiUrl, data);
  }

  actualizarNivel(id: number, data: CrearNivelEducativo): Observable<NivelEducativo> {
    return this.http.put<NivelEducativo>(`${this.apiUrl}/${id}`, data);
  }

  eliminarNivel(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
