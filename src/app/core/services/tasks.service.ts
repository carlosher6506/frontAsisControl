import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Tarea, CrearTarea } from '../models/task.model';
import { ENV_ASIS } from '../../config/environment';

@Injectable({ providedIn: 'root' })
export class TasksService {
  private apiUrl = `${ENV_ASIS.apiUrl}/tasks`;
  constructor(private http: HttpClient) {}

  obtenerTareas(): Observable<Tarea[]> {
    return this.http.get<Tarea[]>(this.apiUrl);
  }
  obtenerTareasPorGrupoMateria(grupo_materia_id: number): Observable<Tarea[]> {
    return this.http.get<Tarea[]>(`${this.apiUrl}/grupoMateria/${grupo_materia_id}`);
  }
  crearTarea(data: CrearTarea): Observable<Tarea> {
    return this.http.post<Tarea>(this.apiUrl, data);
  }
  actualizarTarea(id: number, data: Partial<CrearTarea>): Observable<Tarea> {
    return this.http.put<Tarea>(`${this.apiUrl}/${id}`, data);
  }
  eliminarTarea(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
