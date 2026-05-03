import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ENV_ASIS } from '../../config/environment';
import { Alumno, CrearAlumno, ActualizarAlumno } from '../models/student.model';


@Injectable({
  providedIn: 'root'
})
export class StudentsService {

  private apiUrl = `${ENV_ASIS.apiUrl}/students`;

  constructor(private http: HttpClient) {}

  obtenerAlumnos(): Observable<Alumno[]> {
    return this.http.get<Alumno[]>(this.apiUrl);
  }

  obtenerAlumnoPorId(id: number): Observable<Alumno> {
    return this.http.get<Alumno>(`${this.apiUrl}/${id}`);
  }

  crearAlumno(data: CrearAlumno): Observable<Alumno> {
    return this.http.post<Alumno>(this.apiUrl, data);
  }

  actualizarAlumno(id: number, data: ActualizarAlumno): Observable<Alumno> {
    return this.http.put<Alumno>(`${this.apiUrl}/${id}`, data);
  }

  eliminarAlumno(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  obtenerAlumnosPorGrupo(grupo_id: number): Observable<Alumno[]> {
    return this.http.get<Alumno[]>(`${this.apiUrl}/grupo/${grupo_id}`);
  }

  obtenerGruposDeAlumno(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${id}/grupos`);
  }
}
