import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, map, Observable, catchError, of } from 'rxjs';
import { DashboardStats } from '../models/dashboard.model';
import { ENV_ASIS } from '../../config/environment';


@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  private apiUrl = ENV_ASIS.apiUrl;

  constructor(private http: HttpClient) {}

  getStats(): Observable<DashboardStats> {
    return forkJoin({
      estudiantes:  this.http.get<any>(`${this.apiUrl}/students`).pipe(catchError(() => of([]))),
      grupos:       this.http.get<any>(`${this.apiUrl}/groups`).pipe(catchError(() => of([]))),
      evaluaciones: this.http.get<any>(`${this.apiUrl}/evaluations`).pipe(catchError(() => of([]))),
      tareas:       this.http.get<any>(`${this.apiUrl}/tasks`).pipe(catchError(() => of([]))),
      usuarios:     this.http.get<any>(`${this.apiUrl}/users`).pipe(catchError(() => of([]))),
    }).pipe(
      map(data => {
        return {
          totalEstudiantes:  Array.isArray(data.estudiantes)  ? data.estudiantes.length  : 0,
          totalGrupos:       Array.isArray(data.grupos)       ? data.grupos.length       : 0,
          totalEvaluaciones: Array.isArray(data.evaluaciones) ? data.evaluaciones.length : 0,
          totalTareas:       Array.isArray(data.tareas)       ? data.tareas.length       : 0,
          totalUsuarios:     Array.isArray(data.usuarios)     ? data.usuarios.length     : 0,
        };
      })
    );
  }
}
