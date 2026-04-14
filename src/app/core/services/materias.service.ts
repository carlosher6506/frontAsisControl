import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Materia, CrearMateria } from '../models/subjects.model';
import { ENV_ASIS } from '../../config/environment';

@Injectable({ providedIn: 'root' })
export class MateriasService {
  private apiUrl = `${ENV_ASIS.apiUrl}/subjects`;
  constructor(private http: HttpClient) {}

  obtenerMaterias(): Observable<Materia[]> {
    return this.http.get<Materia[]>(this.apiUrl);
  }
  crearMateria(data: CrearMateria): Observable<Materia> {
    return this.http.post<Materia>(this.apiUrl, data);
  }
  actualizarMateria(id: number, data: CrearMateria): Observable<Materia> {
    return this.http.put<Materia>(`${this.apiUrl}/${id}`, data);
  }
  eliminarMateria(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
