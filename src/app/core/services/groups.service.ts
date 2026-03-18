import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Grupo, CrearGrupo, ActualizarGrupo } from '../models/group.model';
import { ENV_ASIS } from '../../config/environment';

@Injectable({ providedIn: 'root' })
export class GroupsService {
  private apiUrl = `${ENV_ASIS.apiUrl}/groups`;
  constructor(private http: HttpClient) {}

  obtenerGrupos(): Observable<Grupo[]> {
    return this.http.get<Grupo[]>(this.apiUrl);
  }

  obtenerGrupoPorId(id: number): Observable<Grupo> {
    return this.http.get<Grupo>(`${this.apiUrl}/${id}`);
  }

  crearGrupo(data: CrearGrupo): Observable<Grupo> {
    return this.http.post<Grupo>(this.apiUrl, data);
  }

  actualizarGrupo(id: number, data: ActualizarGrupo): Observable<Grupo> {
    return this.http.put<Grupo>(`${this.apiUrl}/${id}`, data);
  }

  eliminarGrupo(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
