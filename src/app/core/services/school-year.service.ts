import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CicloEscolar, CrearCiclo, ActualizarCiclo } from '../models/school-year.model';
import { ENV_ASIS } from '../../config/environment';

@Injectable({ providedIn: 'root' })
export class SchoolYearService {

  private apiUrl = `${ENV_ASIS.apiUrl}/schoolYear`;

  constructor(private http: HttpClient) {}

  obtenerCiclos(): Observable<CicloEscolar[]> {
    return this.http.get<CicloEscolar[]>(this.apiUrl);
  }

  obtenerCicloPorId(id: number): Observable<CicloEscolar> {
    return this.http.get<CicloEscolar>(`${this.apiUrl}/${id}`);
  }

  crearCiclo(data: CrearCiclo): Observable<CicloEscolar> {
    return this.http.post<CicloEscolar>(this.apiUrl, data);
  }

  actualizarCiclo(id: number, data: ActualizarCiclo): Observable<CicloEscolar> {
    return this.http.put<CicloEscolar>(`${this.apiUrl}/${id}`, data);
  }

  eliminarCiclo(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  activarCiclo(id: number): Observable<CicloEscolar> {
    return this.http.patch<CicloEscolar>(`${this.apiUrl}/${id}/activar`, {});
  }
}
