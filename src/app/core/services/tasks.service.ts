import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { Tarea, CrearTarea } from '../models/task.model';
import { ENV_ASIS } from '../../config/environment';
import { normalizarTarea } from '../utils/task.utils';

@Injectable({ providedIn: 'root' })
export class TasksService {
  private apiUrl = `${ENV_ASIS.apiUrl}/tasks`;
  constructor(private http: HttpClient) {}

  obtenerTareas(): Observable<Tarea[]> {
    return this.http.get<Tarea[]>(this.apiUrl).pipe(map(tareas => tareas.map(normalizarTarea)));
  }
  obtenerTareasPorGrupoMateria(grupo_materia_id: number): Observable<Tarea[]> {
    return this.http.get<Tarea[]>(`${this.apiUrl}/grupoMateria/${grupo_materia_id}`)
      .pipe(map(tareas => tareas.map(normalizarTarea)));
  }
  crearTarea(data: CrearTarea): Observable<Tarea> {
    return this.http.post<Tarea>(this.apiUrl, data).pipe(map(normalizarTarea));
  }
  actualizarTarea(id: number, data: Partial<CrearTarea>): Observable<Tarea> {
    return this.http.put<Tarea>(`${this.apiUrl}/${id}`, data).pipe(map(normalizarTarea));
  }
  eliminarTarea(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
